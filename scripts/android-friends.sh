#!/bin/sh
# Friend challenge links for the generated Android project (slice FC3, docs/specs/friend-challenges.tech.md sections 8 and 10).
# The android/ folder is created fresh on every CI build (npx cap add android), so the patch is written here, and the step
# fails if it did not apply.
# Usage: sh scripts/android-friends.sh android                  (after `npx cap add android`, android-ads.sh and android-d2.sh)
#        sh scripts/android-friends.sh --check-merged android   (after Gradle has built the app: checks the merged manifest)
#
# AndroidManifest.xml: an Android App Links intent filter on the main activity (singleTask in the Capacitor template), so a
# challenge link https://hnchennai.github.io/c/?c=<code> opens the app: scheme https, host hnchennai.github.io, the exact
# path /c/ (the code is in the query, so the page c/index.html answers with HTTP 200 and Android's intent fallback works),
# autoVerify true (Android checks https://hnchennai.github.io/.well-known/assetlinks.json at install). The app reads the
# link with App.getLaunchUrl() (cold start) and appUrlOpen (warm), and src/js/friends.js parseLink accepts only this form.
# Not here (slice FC5): push, its manifest entries and the Firebase config file.
# --check-merged: the manifest Gradle merged from the app and every library still has the verified filter on the main activity.
set -e
fail() { echo "::error::$1"; echo "ANDROID FRIENDS SET-UP FAILED: $1" >&2; exit 1; }
HOST='hnchennai.github.io'
MARK='FC3: challenge links'

# Exit 0 when the file has exactly one main activity and it holds the verified link filter
has_filter() {
  perl -0ne '
    my @acts = /(<activity\b[^>]*?android:name="(?:com\.suresh\.chesscoach)?\.MainActivity"[^>]*>.*?<\/activity>)/sg;
    exit 1 unless @acts == 1;
    for my $f ($acts[0] =~ /(<intent-filter\b[^>]*>.*?<\/intent-filter>)/sg) {
      next unless $f =~ /<intent-filter\b[^>]*android:autoVerify="true"/;
      next unless $f =~ /"android\.intent\.action\.VIEW"/ && $f =~ /"android\.intent\.category\.BROWSABLE"/ && $f =~ /"android\.intent\.category\.DEFAULT"/;
      next unless $f =~ /android:scheme="https"/ && $f =~ /android:host="hnchennai\.github\.io"/ && $f =~ /android:path="\/c\/"/;
      exit 0;
    }
    exit 1;' "$1"
}

if [ "$1" = "--check-merged" ]; then
  A="${2:-android}"
  [ -d "$A/app/build/intermediates" ] || fail "$A/app/build/intermediates not found (run this after the Gradle build)."
  L=$(find "$A/app/build/intermediates" -name AndroidManifest.xml -path '*merged*' ! -path '*androidTest*' ! -path '*UnitTest*' | sort)
  [ -n "$L" ] || fail "No merged AndroidManifest.xml under $A/app/build/intermediates."
  for F in $L; do
    echo "Merged manifest: $F"
    has_filter "$F" || fail "$F has no verified https://$HOST/c/ link filter on the main activity."
  done
  echo "Merged manifest check passed: the challenge link filter (App Links, autoVerify) is on the main activity."
  exit 0
fi

A="${1:-android}"
M="$A/app/src/main/AndroidManifest.xml"
[ -f "$M" ] || fail "$M not found."
N=$(perl -0ne 'my $n = () = /<activity\b[^>]*?android:name="(?:com\.suresh\.chesscoach)?\.MainActivity"/sg; print $n' "$M")
[ "$N" = 1 ] || fail "Expected exactly one MainActivity in $M (found $N)."

if ! grep -qF "$MARK" "$M"; then
  if grep -qF "android:host=\"$HOST\"" "$M"; then fail "$M already names $HOST somewhere else; not adding a second filter."; fi
  FC_FILTER="            <!-- $MARK: https://$HOST/c/?c=<code> opens the app (Android App Links, scripts/android-friends.sh) -->
            <intent-filter android:autoVerify=\"true\">
                <action android:name=\"android.intent.action.VIEW\" />
                <category android:name=\"android.intent.category.DEFAULT\" />
                <category android:name=\"android.intent.category.BROWSABLE\" />
                <data android:scheme=\"https\" android:host=\"$HOST\" android:path=\"/c/\" />
            </intent-filter>" \
  perl -0pi -e 's#(<activity\b[^>]*?android:name="(?:com\.suresh\.chesscoach)?\.MainActivity"[^>]*>.*?)(\n[ \t]*</activity>)#$1\n$ENV{FC_FILTER}$2#s' "$M"
fi

[ "$(grep -cF "$MARK" "$M")" = 1 ] || fail "The challenge link filter is not in $M exactly once."
[ "$(grep -cF "android:host=\"$HOST\"" "$M")" = 1 ] || fail "$M names $HOST more than once."
has_filter "$M" || fail "The challenge link filter is not inside the main activity of $M."
echo "Friends set-up applied: the https://$HOST/c/ App Links filter is on the main activity."
