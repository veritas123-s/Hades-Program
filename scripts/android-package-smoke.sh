#!/usr/bin/env bash
set -euo pipefail
mkdir -p test-results/android-smoke
adb install "$RUNNER_TEMP/test.apk"
adb logcat -c
adb shell am start -W -n com.medstack.app/.MainActivity
sleep 3
adb shell uiautomator dump /sdcard/medstack-layout.xml
adb pull /sdcard/medstack-layout.xml test-results/android-smoke/layout.xml
adb exec-out screencap -p > test-results/android-smoke/launch.png
adb logcat -d -v brief > test-results/android-smoke/logcat.txt
python3 - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET
root = ET.parse('test-results/android-smoke/layout.xml').getroot()
text = ' '.join(node.attrib.get('text', '') for node in root.iter())
assert '医栈通 Medstack' in text, text
assert '医栈事，一站通' in text, text
assert '登录' in text and '邮箱' in text, text
assert not any(name in text.lower() for name in ['hades', 'veritas']), text
log = Path('test-results/android-smoke/logcat.txt').read_text(errors='replace')
assert 'FATAL EXCEPTION' not in log, log[-2000:]
Path('test-results/android-smoke/result.txt').write_text('PASS release APK launch, brand, slogan, login gate, no fatal exception\n')
PY
