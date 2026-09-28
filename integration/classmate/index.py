"""Independent VERITAS reminders. No author accounts, mailbox or personal registry."""
import hashlib
import json
import os
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from veritas_bridge import TZ, timestamp, task_lines, load_feed, NoRedirect
from veritas_sync import handle_http, CosStore, validate_feed


def course_lines(feed, now, mode):
    table = (feed or {}).get('timetable', {})
    choices = [(0, '今日课表'), (1, '提前预习明日课程')] if mode == 'morning' else [(0, '今晚复习今日课程'), (1, '提前预习明日课程')]
    lines = []
    for offset, label in choices:
        day = (now + timedelta(days=offset)).date().isoformat()
        try:
            synced = timestamp(table['verified_at'][day])
            if day not in table['verified_dates'] or not timedelta(0) <= now - synced <= timedelta(days=7):
                raise ValueError()
            courses = table['courses'][day]
            if not isinstance(courses, list):
                raise ValueError()
            lines.append(label + '：')
            if not courses:
                lines.append('已核对的课表缓存显示无课。')
            for course in sorted(courses, key=lambda row: row['start']):
                suffix = '；下课后再复习' if mode == 'evening' and offset == 0 and course['end'] > now.strftime('%H:%M') else ''
                lines.append(f"• {course['name']}｜{course['start']}—{course['end']} {course['room']}{suffix}")
        except (KeyError, ValueError, TypeError):
            lines.append(label + '：没有近期核验的课表，请同步并按实际课程安排。')
    return lines


def send(content, title):
    payload = {'token': os.environ['PUSHPLUS_TOKEN'], 'title': title, 'content': content, 'template': 'txt', 'channel': 'wechat'}
    req = urllib.request.Request('https://www.pushplus.plus/send', data=json.dumps(payload, ensure_ascii=False).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=20) as response:
            raw = response.read(16385)
        if len(raw) > 16384:
            raise ValueError()
        result = json.loads(raw)
        if result.get('code') != 200 or not result.get('data'):
            return {'status': 'push_rejected'}
        return {'status': 'accepted_not_delivery_confirmed'}
    except Exception:
        # A timeout may occur after acceptance. Return rather than raise/retry a push.
        return {'status': 'push_outcome_unknown'}


def main_handler(event, context):
    event = event if isinstance(event, dict) else {}
    # A Function URL request must never be able to trigger a message.
    if any(k in event for k in ('httpMethod', 'requestContext', 'headers', 'path')):
        return handle_http(event)
    if event.get('action') == 'health':
        try:
            raw, _ = CosStore().read()
            feed = json.loads(raw)
            validate_feed(feed)
            return {'status': 'ready', 'sha256': hashlib.sha256(raw).hexdigest()}
        except Exception:
            return {'status': 'storage_unavailable'}
    if event.get('action') == 'test':
        return send('Hades 云提醒连接测试。收到此消息后，请回到应用点击“微信已收到”。', 'Hades｜连接测试')
    if event.get('Type') != 'Timer':
        return {'status': 'ignored'}
    try:
        params = json.loads(event.get('Message') or '{}')
        mode = params.get('mode')
    except (ValueError, TypeError, AttributeError):
        return {'status': 'invalid_timer'}
    if mode not in ('morning', 'evening'):
        return {'status': 'invalid_timer'}
    now = datetime.now(TZ)
    feed, warnings = load_feed(Path(__file__).parent)
    title = 'Hades｜' + ('晨报' if mode == 'morning' else '晚报')
    lines = [f'{title} {now:%Y-%m-%d %H:%M}', '', *warnings, *course_lines(feed, now, mode), '', *task_lines(feed, now)]
    return send('\n'.join(lines), title)
