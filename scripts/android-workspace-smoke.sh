#!/usr/bin/env bash
set -euo pipefail
(cd android && ./gradlew --no-daemon :app:connectedDebugAndroidTest)
mkdir -p test-results/android-workspace
adb pull /sdcard/Android/data/com.medstack.app.debug/files/ui-evidence test-results/android-workspace/
for screen in today tasks schedule focus assistant settings logout; do
  test -s "test-results/android-workspace/ui-evidence/$screen.png"
done
