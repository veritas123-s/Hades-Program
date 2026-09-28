"""Authenticated desktop feed intake, backed by one private COS object.

No message sending, credential logging, public read access, or model API calls.
"""
import hashlib
import hmac
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

MAX_BYTES = 512 * 1024
OBJECT_KEY = '/veritas/veritas-feed.json'


def timestamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('timezone required')
    return result


def validate_feed(feed):
    if not isinstance(feed, dict) or set(feed) != {'schema_version', 'source', 'timezone', 'generated_at', 'timetable', 'tasks', 'rules'}:
        raise ValueError('invalid fields')
    if feed['schema_version'] != 1 or feed['timezone'] != 'Asia/Shanghai':
        raise ValueError('invalid schema')
    generated = timestamp(feed['generated_at'])
    if generated.timestamp() > time.time() + 300:
        raise ValueError('future timestamp')
    if not isinstance(feed['source'], str) or len(feed['source']) > 80:
        raise ValueError('invalid source')
    tasks = feed['tasks']
    if not isinstance(tasks, list) or len(tasks) > 3000:
        raise ValueError('invalid tasks')
    ids = set()
    for task in tasks:
        if not isinstance(task, dict) or set(task) != {'id', 'title', 'project', 'quadrant', 'quadrant_label', 'due', 'due_time', 'reminder', 'estimate_minutes', 'subtasks_total', 'subtasks_done'}:
            raise ValueError('invalid task fields')
        for field, limit in [('id', 160), ('title', 300), ('project', 100), ('quadrant_label', 40)]:
            if not isinstance(task[field], str) or len(task[field]) > limit:
                raise ValueError('invalid task text')
        if not task['id'] or task['id'] in ids or not task['title'].strip() or task['quadrant'] not in ('do', 'plan', 'delegate', 'later'):
            raise ValueError('invalid task')
        ids.add(task['id'])
        if task['due']:
            datetime.strptime(task['due'], '%Y-%m-%d')
        if task['due_time'] and (not task['due'] or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', task['due_time'])):
            raise ValueError('invalid time')
        if task['reminder']:
            datetime.strptime(task['reminder'], '%Y-%m-%dT%H:%M')
        for field in ('estimate_minutes', 'subtasks_total', 'subtasks_done'):
            if not isinstance(task[field], (int, float)) or not 0 <= task[field] <= 100000:
                raise ValueError('invalid count')
    table = feed['timetable']
    if not isinstance(table, dict) or set(table) != {'synced_at', 'verified_dates', 'verified_at', 'courses'}:
        raise ValueError('invalid timetable')
    timestamp(table['synced_at'])
    dates = table['verified_dates']
    if not isinstance(dates, list) or len(dates) > 1000 or len(set(dates)) != len(dates) or set(table['courses']) != set(dates) or set(table['verified_at']) != set(dates):
        raise ValueError('invalid dates')
    for day in dates:
        datetime.strptime(day, '%Y-%m-%d')
        timestamp(table['verified_at'][day])
        courses = table['courses'][day]
        if not isinstance(courses, list) or len(courses) > 100:
            raise ValueError('invalid courses')
        for course in courses:
            if not isinstance(course, dict) or set(course) != {'name', 'start', 'end', 'room'}:
                raise ValueError('invalid course fields')
            if any(not isinstance(course[f], str) or len(course[f]) > 300 for f in ('name', 'room')):
                raise ValueError('invalid course text')
            if any(not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', course[f]) for f in ('start', 'end')) or course['end'] < course['start']:
                raise ValueError('invalid course time')
    expected_rules = {'preview_day_offset': -1, 'review_day_offset': 0, 'morning_time': '08:00', 'evening_time': '21:00', 'ddl_lookahead_days': 3, 'task_freshness_hours': 48}
    if feed['rules'] != expected_rules:
        raise ValueError('invalid rules')
    return generated


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class CosStore:
    def __init__(self):
        self.host = os.environ.get('VERITAS_COS_HOST', '')
        if not re.fullmatch(r'[a-z0-9-]+-\d+\.cos\.ap-shanghai\.myqcloud\.com', self.host):
            raise ValueError('storage not configured')

    def request(self, method, body=None, etag=None):
        secret_id = os.environ['TENCENTCLOUD_SECRETID']
        secret_key = os.environ['TENCENTCLOUD_SECRETKEY']
        token = os.environ['TENCENTCLOUD_SESSIONTOKEN']
        now = int(time.time())
        key_time = f'{now - 30};{now + 120}'
        headers = {'host': self.host, 'x-cos-security-token': token}
        if body is not None:
            headers['content-type'] = 'application/json; charset=utf-8'
        if etag is not None:
            headers['if-match' if etag else 'if-none-match'] = etag or '*'
        names = ';'.join(sorted(headers))
        canonical_headers = '&'.join(urllib.parse.quote(k, safe='') + '=' + urllib.parse.quote(headers[k], safe='') for k in sorted(headers))
        http_string = f'{method.lower()}\n{OBJECT_KEY}\n\n{canonical_headers}\n'
        sign_key = hmac.new(secret_key.encode(), key_time.encode(), hashlib.sha1).hexdigest()
        string_to_sign = f'sha1\n{key_time}\n{hashlib.sha1(http_string.encode()).hexdigest()}\n'
        signature = hmac.new(sign_key.encode(), string_to_sign.encode(), hashlib.sha1).hexdigest()
        headers['authorization'] = f'q-sign-algorithm=sha1&q-ak={secret_id}&q-sign-time={key_time}&q-key-time={key_time}&q-header-list={names}&q-url-param-list=&q-signature={signature}'
        req = urllib.request.Request(f'https://{self.host}{OBJECT_KEY}', data=body, headers=headers, method=method)
        try:
            with urllib.request.build_opener(NoRedirect).open(req, timeout=12) as response:
                data = response.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES:
                    raise ValueError('object too large')
                return data, response.headers.get('ETag', '')
        except urllib.error.HTTPError as error:
            if method == 'GET' and error.code == 404:
                return None, ''
            raise

    def read(self):
        return self.request('GET')

    def write(self, body, etag):
        return self.request('PUT', body, etag)


def load_cloud_feed():
    body, _ = CosStore().read()
    if body is None:
        raise ValueError('feed not uploaded')
    feed = json.loads(body)
    validate_feed(feed)
    return feed


def response(code, body):
    return {'statusCode': code, 'headers': {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}, 'body': json.dumps(body, ensure_ascii=False)}


def handle_http(event, store=None):
    # Every HTTP request ends here. Never fall through to scheduled push logic.
    try:
        method = event.get('httpMethod', '').upper()
        path = event.get('path', '')
        if path != '/veritas-sync' or method not in ('GET', 'POST'):
            return response(404, {'status': 'not_found'})
        body = event.get('body') or ''
        if not isinstance(body, str) or event.get('isBase64Encoded') or len(body.encode()) > MAX_BYTES:
            return response(413, {'status': 'invalid_body'})
        headers = {k.lower(): str(v) for k, v in event.get('headers', {}).items()}
        stamp, nonce, signature = (headers.get(k, '') for k in ('x-veritas-time', 'x-veritas-nonce', 'x-veritas-signature'))
        secret = os.environ.get('VERITAS_SYNC_SECRET', '')
        if not re.fullmatch(r'[a-f0-9]{64}', secret):
            return response(503, {'status': 'not_configured'})
        if not stamp.isdigit() or abs(time.time() - int(stamp)) > 300 or not re.fullmatch(r'[a-f0-9]{32}', nonce) or not re.fullmatch(r'[a-f0-9]{64}', signature):
            return response(401, {'status': 'unauthorized'})
        digest = hashlib.sha256(body.encode()).hexdigest()
        expected = hmac.new(secret.encode(), '\n'.join((stamp, nonce, method, path, digest)).encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            return response(401, {'status': 'unauthorized'})
        store = store or CosStore()
        # Replays are harmless: identical uploads are acknowledged without writes;
        # older generations are rejected. Deploy with maximum concurrency 1
        # to serialize compare/write; COS conditional headers are supplementary.
        previous, etag = store.read()
        if method == 'POST':
            feed = json.loads(body)
            generated = validate_feed(feed)
            if previous:
                existing = json.loads(previous)
                old_time = timestamp(existing['generated_at'])
                if generated < old_time or (generated == old_time and previous != body.encode()):
                    return response(409, {'status': 'stale'})
            if previous != body.encode():
                store.write(body.encode(), etag)
            data = body.encode()
        else:
            if not previous:
                return response(404, {'status': 'no_feed'})
            data = previous
            feed = json.loads(data)
        return response(200, {'status': 'stored', 'sha256': hashlib.sha256(data).hexdigest(), 'generated_at': feed['generated_at'], 'task_count': len(feed['tasks']), 'verified_dates': len(feed['timetable']['verified_dates'])})
    except urllib.error.HTTPError as error:
        return response(409 if error.code == 412 else 503, {'status': 'storage_conflict' if error.code == 412 else 'storage_unavailable'})
    except (ValueError, TypeError, KeyError, AttributeError):
        return response(400, {'status': 'invalid_payload'})
    except Exception:
        return response(503, {'status': 'storage_unavailable'})
