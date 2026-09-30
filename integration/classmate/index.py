"""Independent VERITAS reminders. No author accounts, mailbox or personal registry."""
import hashlib
import json
import os
import smtplib
import ssl
from email.message import EmailMessage
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
    channel = os.environ.get('DELIVERY_CHANNEL') or ('pushplus' if os.environ.get('PUSHPLUS_TOKEN') else 'email')
    if channel == 'email':
        try:
            message = EmailMessage()
            message['From'] = os.environ['SMTP_USER']
            message['To'] = os.environ['EMAIL_TO']
            message['Subject'] = title
            message.set_content(content, charset='utf-8')
            port = int(os.environ.get('SMTP_PORT', '465'))
            tls = ssl.create_default_context()
            if port == 465:
                smtp = smtplib.SMTP_SSL(os.environ['SMTP_HOST'], port, timeout=20, context=tls)
            elif port == 587:
                smtp = smtplib.SMTP(os.environ['SMTP_HOST'], port, timeout=20)
            else:
                return {'status': 'email_rejected'}
            with smtp:
                if port == 587:
                    smtp.ehlo()
                    smtp.starttls(context=tls)
                    smtp.ehlo()
                smtp.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
                refused = smtp.send_message(message)
            return {'status': 'email_rejected' if refused else 'accepted_not_delivery_confirmed'}
        except Exception:
            return {'status': 'email_outcome_unknown'}
    if channel != 'pushplus':
        return {'status': 'invalid_delivery_channel'}
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


def news_lines(feed, now):
    news = (feed or {}).get('campus_news')
    if not news or news.get('date') != now.date().isoformat():
        return ['', '校园快讯：没有当日采集快照，未判定为无新消息。']
    rows = news.get('items', [])
    lines = ['', '当日校园活动（已确认活动日期，非全量覆盖）：']
    if news.get('summary'):
        lines.append(news['summary'])
    else:
        lines.extend(f"• {row['source']}｜{row['title']}\n{row['url']}" for row in rows)
    if not rows:
        lines.append('当前没有已确认在今天举行的活动，请核对各组织原文。')
    missing = [x['source'] for x in news.get('coverage', []) if x['status'] != 'partial']
    if missing:
        lines.append('采集缺口：' + '、'.join(missing))
    lines.append('来源索引可能延迟或遗漏，请同时关注官方渠道。')
    return lines


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
        return send('Hades 云提醒连接测试。收到此消息后，请回到应用点击“已收到”。', 'Hades｜连接测试')
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
    lines = [f'{title} {now:%Y-%m-%d %H:%M}', '', *warnings, *course_lines(feed, now, mode), '', *task_lines(feed, now), *news_lines(feed, now)]
    return send('\n'.join(lines), title)
