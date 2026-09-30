import importlib.util
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from email import policy
from email.parser import BytesParser
from datetime import datetime, timezone, timedelta

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'integration/cloud'))
spec = importlib.util.spec_from_file_location('reminder_runtime', root / 'integration/classmate/index.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)
from veritas_sync import validate_feed

class MailDelivery(unittest.TestCase):
    def test_news_feed_bounds_and_private_urls(self):
        now = datetime.now(timezone.utc).isoformat()
        feed = dict(schema_version=1, source='Hades', timezone='Asia/Shanghai', generated_at=now,
            timetable=dict(synced_at=now, verified_dates=[], verified_at={}, courses={}), tasks=[],
            rules=dict(preview_day_offset=-1, review_day_offset=0, morning_time='08:00', evening_time='21:00', ddl_lookahead_days=3, task_freshness_hours=48))
        validate_feed(feed)
        feed['campus_news'] = dict(date='2026-09-30',collected_at=now,items=[dict(source='学校',title='讲座',url='https://news.sjtu.edu.cn/',excerpt='')],summary='',coverage=[])
        validate_feed(feed)
        for url in ['http://127.0.0.1/', 'https://news.sjtu.edu.cn.evil.example/', 'https://user:secret@news.sjtu.edu.cn/']:
            feed['campus_news']['items'][0]['url'] = url
            with self.assertRaises(ValueError):
                validate_feed(feed)
        feed['campus_news']['items'] = []
        feed['campus_news']['summary'] = 'x' * 12001
        with self.assertRaises(ValueError):
            validate_feed(feed)
    def test_news_snapshot_and_missing_coverage(self):
        now = datetime.now(timezone(timedelta(hours=8)))
        self.assertIn('没有当日采集快照', '\n'.join(runtime.news_lines({},now)))
        news = dict(date=now.date().isoformat(), summary='', items=[dict(source='学校',title='讲座',url='https://news.sjtu.edu.cn/',excerpt='')], coverage=[dict(source='合成公众号',status='unavailable',note='读取失败')])
        lines = '\n'.join(runtime.news_lines({'campus_news':news},now))
        self.assertIn('讲座',lines)
        self.assertIn('采集缺口：合成公众号',lines)
        news['date']='2020-01-01'
        self.assertNotIn('讲座','\n'.join(runtime.news_lines({'campus_news':news},now)))
    def test_tls_and_chinese_message(self):
        env = dict(DELIVERY_CHANNEL='email', SMTP_HOST='smtp.example.com', SMTP_PORT='465', SMTP_USER='sender@example.com', SMTP_PASSWORD='synthetic-only', EMAIL_TO='receiver@example.com')
        with patch.dict(os.environ, env, clear=True), patch.object(runtime.smtplib, 'SMTP_SSL') as smtp, patch.object(runtime.urllib.request, 'build_opener') as push:
            client = smtp.return_value
            client.send_message.return_value = {}
            result = runtime.send('今日课程与截止日期提醒', 'Hades｜校园快讯')
            self.assertEqual(result['status'], 'accepted_not_delivery_confirmed')
            message = client.send_message.call_args.args[0]
            decoded = BytesParser(policy=policy.default).parsebytes(message.as_bytes())
            self.assertEqual(str(decoded['Subject']), 'Hades｜校园快讯')
            self.assertIn('今日课程与截止日期提醒', decoded.get_content())
            smtp.assert_called_once()
            push.assert_not_called()

    def test_failure_does_not_retry_or_claim_delivery(self):
        with patch.dict(os.environ, {'DELIVERY_CHANNEL':'email'}, clear=True), patch.object(runtime.smtplib, 'SMTP_SSL') as smtp:
            self.assertEqual(runtime.send('text', 'title')['status'], 'email_outcome_unknown')
            smtp.assert_not_called()

if __name__ == '__main__':
    unittest.main()
