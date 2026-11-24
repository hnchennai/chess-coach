#!/bin/sh
# Daily puzzle reminder and rating ask set-up for the generated Android project (slice D2, docs/specs/daily-puzzle.product.md,
# DP-D10, DP-D14, DP-D15). The android/ folder is created fresh on every CI build (npx cap add android), so everything is
# written here, and the step fails if any of it did not apply.
# Usage: sh scripts/android-d2.sh android                  (after `npx cap add android` and scripts/android-ads.sh)
#        sh scripts/android-d2.sh --check-merged android   (after Gradle has built the app: checks the merged manifest)
#
# 1. variables.gradle: googleAndroidPlayReviewVersion = '2.0.2', the name @capacitor-community/in-app-review 8.0.0 reads
#    in its android/build.gradle (its default is also 2.0.2; pinned here so a plugin update cannot change it unseen).
# 2. AndroidManifest.xml: SCHEDULE_EXACT_ALARM (asked for by @capacitor/local-notifications) is removed from the app
#    (tools:node="remove"). Reminders are inexact (DP-D15): the app passes isExactNotification: false and allowWhileIdle: true
#    (setAndAllowWhileIdle, which wakes an idle phone and needs no exact-alarm permission).
# 3. The small notification icon: assets/notification/ic_stat_daily.xml (white on transparent) into res/drawable, the name
#    capacitor.config.json gives as plugins.LocalNotifications.smallIcon. Without it Android shows a white square.
# --check-merged: the manifest Gradle merged from the app and every library has no SCHEDULE_EXACT_ALARM or USE_EXACT_ALARM and does have
#    POST_NOTIFICATIONS.
set -e
fail() { echo "::error::$1"; echo "ANDROID D2 SET-UP FAILED: $1" >&2; exit 1; }
REVIEW_VERSION='2.0.2'
EXACT='android.permission.SCHEDULE_EXACT_ALARM'
USE_EXACT='android.permission.USE_EXACT_ALARM'
POST='android.permission.POST_NOTIFICATIONS'

if [ "$1" = "--check-merged" ]; then
  A="${2:-android}"
  [ -d "$A/app/build/intermediates" ] || fail "$A/app/build/intermediates not found (run this after the Gradle build)."
  L=$(find "$A/app/build/intermediates" -name AndroidManifest.xml -path '*merged*' ! -path '*androidTest*' ! -path '*UnitTest*' | sort)
  [ -n "$L" ] || fail "No merged AndroidManifest.xml under $A/app/build/intermediates."
  for F in $L; do
    echo "Merged manifest: $F"
    if grep -q "$EXACT" "$F"; then fail "$F still asks for SCHEDULE_EXACT_ALARM."; fi
    if grep -q "$USE_EXACT" "$F"; then fail "$F asks for USE_EXACT_ALARM."; fi
    grep -q "android:name=\"$POST\"" "$F" || fail "$F does not ask for POST_NOTIFICATIONS."
  done
  echo "Merged manifest check passed: no SCHEDULE_EXACT_ALARM or USE_EXACT_ALARM, POST_NOTIFICATIONS present."
  exit 0
fi

A="${1:-android}"
M="$A/app/src/main/AndroidManifest.xml"
V="$A/variables.gradle"
ICON_SRC="$(dirname "$0")/../assets/notification/ic_stat_daily.xml"
ICON="$A/app/src/main/res/drawable/ic_stat_daily.xml"
[ -f "$M" ] || fail "$M not found."
[ -f "$V" ] || fail "$V not found."
[ -f "$ICON_SRC" ] || fail "$ICON_SRC not found."

# 1. the review library's version (as scripts/android-ads.sh pins the ads libraries)
N=googleAndroidPlayReviewVersion
if ! grep -qE "^[[:space:]]*$N[[:space:]]*=" "$V"; then
  PIN_NAME="$N" PIN_VERSION="$REVIEW_VERSION" perl -0pi -e 's/(\bext\s*\{.*?)(\n\})/$1\n    $ENV{PIN_NAME} = \x27$ENV{PIN_VERSION}\x27$2/s' "$V"
fi
[ "$(grep -cE "^[[:space:]]*$N[[:space:]]*=" "$V")" = 1 ] || fail "$N is not set exactly once in $V."
grep -qE "^[[:space:]]*$N = '$REVIEW_VERSION'\$" "$V" || fail "$N is not pinned to $REVIEW_VERSION in $V."

# 2. no exact alarms: the tools namespace on <manifest>, then the removal line just before </manifest>
if ! grep -q 'xmlns:tools=' "$M"; then
  perl -0pi -e 's#<manifest\b#<manifest xmlns:tools="http://schemas.android.com/tools"#' "$M"
fi
[ "$(grep -o 'xmlns:tools="http://schemas.android.com/tools"' "$M" | wc -l | tr -d ' ')" = 1 ] || fail "The tools namespace is not on <manifest> exactly once."
LINE="<uses-permission android:name=\"$EXACT\" tools:node=\"remove\" />"
if ! grep -qF "$LINE" "$M"; then
  D2_LINE="$LINE" perl -0pi -e 's#</manifest>#    $ENV{D2_LINE}\n</manifest>#' "$M"
fi
[ "$(grep -cF "$LINE" "$M")" = 1 ] || fail "The SCHEDULE_EXACT_ALARM removal is not in the manifest exactly once."
[ "$(grep -c "$EXACT" "$M")" = 1 ] || fail "The manifest names SCHEDULE_EXACT_ALARM somewhere else too."
perl -0ne 'exit(( /<manifest\b[^>]*xmlns:tools=.*SCHEDULE_EXACT_ALARM" tools:node="remove" \/>\s*<\/manifest>\s*$/s ) ? 0 : 1)' "$M" || fail "The removal line is not inside <manifest>."

# 3. the small notification icon
mkdir -p "$(dirname "$ICON")"
cp "$ICON_SRC" "$ICON"
cmp -s "$ICON_SRC" "$ICON" || fail "$ICON is not the icon from assets/notification."
echo "D2 set-up applied: play review $REVIEW_VERSION pinned, SCHEDULE_EXACT_ALARM removed, notification icon in res/drawable."
