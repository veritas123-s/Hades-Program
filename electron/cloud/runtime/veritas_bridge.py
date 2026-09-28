"""AI VERITAS V1.1 feed adapter. Standard library only; never pushes messages."""
import json
import os
import re
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

TZ = timezone(timedelta(hours=8))
MAX_BYTES = 2_000_000


def timestamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Timezone required')
    return result


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Feed redirects are disabled')


def load_feed(directory):
    """Optional private HTTPS source; if configured, failure never falls back to old tasks."""
    url = os.environ.get('VERITAS_FEED_URL', '')
    try:
        if os.environ.get('VERITAS_COS_HOST'):
            import importlib.util
            spec = importlib.util.spec_from_file_location('veritas_sync', Path(directory) / 'veritas_sync.py')
            sync = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(sync)
            return sync.load_cloud_feed(), []
        if url:
            parsed = urlsplit(url)
            if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError('HTTPS required')
            headers = {'Accept': 'application/json'}
            token = os.environ.get('VERITAS_FEED_TOKEN')
            if token:
                headers['Authorization'] = 'Bearer ' + token
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.build_opener(NoRedirect()).open(request, timeout=10) as response:
                raw = response.read(MAX_BYTES + 1)
        else:
            file = Path(directory) / 'veritas-feed.json'
            if not file.exists():
                return None, []
            with file.open('rb') as stream:
                raw = stream.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError('Feed too large')
        feed = json.loads(raw)
        if (feed.get('schema_version') != 1 or feed.get('timezone') != 'Asia/Shanghai'
                or not isinstance(feed.get('tasks'), list) or not isinstance(feed.get('timetable'), dict)):
            raise ValueError('Invalid feed')
        timestamp(feed['generated_at'])
        return feed, []
    except Exception:
        # Do not return URLs, bearer tokens, request errors or raw content.
        return None, ['VERITAS 数据读取失败，请检查同步；无法判断当前任务是否已完成。']


def merge_timetable(legacy, feed, now):
    """Latest confirmed value wins per day, including an explicitly empty day."""
    now = now.astimezone(TZ)
    dates = {}
    for cache in [legacy, (feed or {}).get('timetable', {})]:
        try:
            for day in cache.get('verified_dates', []):
                stamp = timestamp(cache.get('verified_at', {}).get(day, cache.get('synced_at', '')))
                if not re.fullmatch(r'20\d\d-\d\d-\d\d', day) or not timedelta(0) <= now - stamp <= timedelta(days=7):
                    continue
                courses = cache.get('courses', {}).get(day)
                if not isinstance(courses, list):
                    continue
                if day not in dates or stamp >= dates[day][0]:
                    dates[day] = (stamp, courses)
        except (KeyError, ValueError, TypeError, AttributeError):
            continue
    if not dates:
        return legacy  # Existing cache-warning behavior remains intact.
    return {'synced_at': min(v[0] for v in dates.values()).isoformat(),
            'verified_dates': sorted(dates),
            'courses': {day: value[1] for day, value in dates.items()}}


def task_lines(feed, now):
    if feed is None:
        return []
    now = now.astimezone(TZ)
    try:
        generated = timestamp(feed['generated_at'])
        if not timedelta(0) <= now - generated <= timedelta(hours=48):
            return ['VERITAS 任务快照已超过48小时或时间异常，请同步后核对截止事项；不沿用旧待办。']
        tasks = []
        seen = set()
        for task in feed['tasks']:
            if task.get('completedAt') or task.get('deletedAt'):
                continue
            identity = task['id']
            if not isinstance(identity, str) or identity in seen or not isinstance(task['title'], str):
                raise ValueError('Invalid task')
            seen.add(identity)
            due = task.get('due')
            if due:
                datetime.strptime(due, '%Y-%m-%d')
            due_time = task.get('due_time')
            if due_time and (not due or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', due_time)):
                raise ValueError('Invalid time')
            tasks.append(task)
        today = now.date().isoformat()
        horizon = (now + timedelta(days=3)).date().isoformat()
        deadlines = sorted((t for t in tasks if t.get('due') and t['due'] <= horizon),
                           key=lambda t: (t['due'], t.get('due_time') or '99:99'))
        lines = []
        if deadlines:
            lines.append('VERITAS 截止与逾期提醒：')
            for task in deadlines[:20]:
                due, clock = task['due'], task.get('due_time')
                overdue = due < today or (due == today and clock and clock < now.strftime('%H:%M'))
                label = '逾期' if overdue else '今天' if due == today else '临近'
                title = ' '.join(task['title'].split())[:300]
                lines.append(f'• [{label}] {title}｜{due} {clock or "未指定钟点"}')
            if len(deadlines) > 20:
                lines.append(f'另有{len(deadlines)-20}项截止事项，请在VERITAS中查看。')
        urgent = sorted((t for t in tasks if t.get('quadrant') in ('do', 'plan') and t not in deadlines),
                        key=lambda t: t['quadrant'] != 'do')
        if urgent:
            lines.append('四象限重要任务：')
            for task in urgent[:8]:
                label = '重要且紧急' if task['quadrant'] == 'do' else '重要不紧急'
                title = ' '.join(task['title'].split())[:300]
                lines.append(f'• {title}｜{label}')
        if lines:
            lines.append(f'任务快照更新于{generated.astimezone(TZ):%m-%d %H:%M}；按最近同步状态生成。')
        return lines
    except (KeyError, ValueError, TypeError, AttributeError):
        return ['VERITAS 任务格式异常，请同步后核对截止事项。']
