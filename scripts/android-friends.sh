#!/bin/sh
# Friend challenges in the generated Android project (slices FC3 and FC5, docs/specs/friend-challenges.tech.md sections 4, 8
# and 10). The android/ folder is created fresh on every CI build (npx cap add android), so the patches are written here, and
# the step fails if any of them did not apply. Safe to run twice.
# Usage: sh scripts/android-friends.sh android                  (after `npx cap add android`, android-ads.sh and android-d2.sh)
#        sh scripts/android-friends.sh --check-merged android   (after Gradle has built the app: checks the merged manifest)
#
# FC3, AndroidManifest.xml: an Android App Links intent filter on the main activity (singleTask in the Capacitor template), so a
# challenge link https://hnchennai.github.io/c/?c=<code> opens the app: scheme https, host hnchennai.github.io, the exact
# path /c/ (the code is in the query, so the page c/index.html answers with HTTP 200 and Android's intent fallback works),
# autoVerify true (Android checks https://hnchennai.github.io/.well-known/assetlinks.json at install). The app reads the
# link with App.getLaunchUrl() (cold start) and appUrlOpen (warm), and src/js/friends.js parseLink accepts only this form.
# FC5, push (@capacitor/push-notifications 8.1.3, which links com.google.firebase:firebase-messaging):
# 1. config/google-services.json (public client config, FC-D20: project chess-coach-100, app com.suresh.chesscoach) is copied
#    to android/app/. The Capacitor 8 template's app/build.gradle already applies the Google services Gradle plugin when that
#    file exists (classpath com.google.gms:google-services in the root build.gradle); the plugin turns the file into the string
#    resources FirebaseApp starts from. This script adds no plugin and no dependency; it fails if the template stops doing it.
# 2. variables.gradle: firebaseMessagingVersion = '25.0.1', the name the push plugin's android/build.gradle reads (its default
#    is also 25.0.1; pinned here so a plugin update cannot change it unseen). CI checks Gradle resolves exactly that version.
# 3. AndroidManifest.xml, inside <application>:
#    - firebase_messaging_auto_init_enabled = false: no FCM token, so no Firebase request, until the player's first Challenge
#      or Accept, when the app calls register() (FC-D14). register() turns auto-init on for later starts (tech spec open
#      question 3, answered in FC5 from the plugin and Firebase sources).
#    - com.google.firebase.messaging.default_notification_icon = @drawable/ic_stat_friend (a white status bar icon)
#    - com.google.firebase.messaging.default_notification_channel_id = friend (the channel the app creates, "Friend games")
#    FirebaseInitProvider stays: with auto-init off it starts FirebaseApp and FCM without any network request (tech spec open
#    question 2, answered in FC5 from the sources; a traffic capture on a phone confirms it).
# 4. The icon: assets/notification/ic_stat_friend.xml into res/drawable.
# --check-merged: the manifest Gradle merged from the app and every library still has the verified link filter on the main
#    activity, POST_NOTIFICATIONS (from firebase-messaging), the three meta-data with their values (auto-init off) and the push
#    plugin's MessagingService; and the Google services plugin made the chess-coach-100 resources.
set -e
fail() { echo "::error::$1"; echo "ANDROID FRIENDS SET-UP FAILED: $1" >&2; exit 1; }
HOST='hnchennai.github.io'
MARK='FC3: challenge links'
PKG='com.suresh.chesscoach'
PROJECT='chess-coach-100'
FCM_VERSION='25.0.1'
AUTO='firebase_messaging_auto_init_enabled'
ICON_META='com.google.firebase.messaging.default_notification_icon'
CHAN_META='com.google.firebase.messaging.default_notification_channel_id'
POST='android.permission.POST_NOTIFICATIONS'
PUSH_SVC='com.capacitorjs.plugins.pushnotifications.MessagingService'
GS_SRC="$(dirname "$0")/../config/google-services.json"
ICON_SRC="$(dirname "$0")/../assets/notification/ic_stat_friend.xml"

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
# Exit 0 when file $1 names the meta-data $2 exactly once, inside <application>, with the attribute $3 (name="value")
has_meta() {
  [ "$(grep -c "android:name=\"$2\"" "$1")" = 1 ] || return 1
  META_NAME="$2" META_ATTR="$3" perl -0ne 'exit(( /<application\b.*?<meta-data\s+android:name="\Q$ENV{META_NAME}\E"\s+\Q$ENV{META_ATTR}\E\s*\/>.*?<\/application>/s ) ? 0 : 1)' "$1"
}
# FC5: the three FCM meta-data in file $1
check_metas() {
  has_meta "$1" "$AUTO" 'android:value="false"' || fail "$1 does not have $AUTO = false inside <application> (exactly once)."
  has_meta "$1" "$ICON_META" 'android:resource="@drawable/ic_stat_friend"' || fail "$1 does not have $ICON_META = @drawable/ic_stat_friend inside <application> (exactly once)."
  has_meta "$1" "$CHAN_META" 'android:value="friend"' || fail "$1 does not have $CHAN_META = friend inside <application> (exactly once)."
}

if [ "$1" = "--check-merged" ]; then
  A="${2:-android}"
  [ -d "$A/app/build/intermediates" ] || fail "$A/app/build/intermediates not found (run this after the Gradle build)."
  L=$(find "$A/app/build/intermediates" -name AndroidManifest.xml -path '*merged*' ! -path '*androidTest*' ! -path '*UnitTest*' | sort)
  [ -n "$L" ] || fail "No merged AndroidManifest.xml under $A/app/build/intermediates."
  for F in $L; do
    echo "Merged manifest: $F"
    has_filter "$F" || fail "$F has no verified https://$HOST/c/ link filter on the main activity."
    grep -q "android:name=\"$POST\"" "$F" || fail "$F does not ask for POST_NOTIFICATIONS."
    check_metas "$F"
    grep -q "android:name=\"$PUSH_SVC\"" "$F" || fail "$F has no $PUSH_SVC (the push plugin is not in the app)."
  done
  # FC5: the Google services plugin ran (FirebaseApp starts from these resources), with this project's values
  V=$(grep -rl --include='*.xml' 'name="google_app_id"' "$A/app/build" 2>/dev/null | sort || true)
  [ -n "$V" ] || fail "No google_app_id resource under $A/app/build: the Google services Gradle plugin did not run."
  for F in $V; do
    echo "Firebase values: $F"
    grep -qE "name=\"project_id\"[^>]*>$PROJECT<" "$F" || fail "$F is not for the project $PROJECT."
  done
  echo "Merged manifest check passed: the challenge link filter (App Links, autoVerify) is on the main activity; POST_NOTIFICATIONS,"
  echo "FCM auto-init off, the ic_stat_friend icon, the friend channel and the push service are there; Firebase values for $PROJECT."
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

# ---------- FC5: push ----------
V="$A/variables.gradle"
AG="$A/app/build.gradle"
RG="$A/build.gradle"
[ -f "$V" ] || fail "$V not found."
[ -f "$AG" ] || fail "$AG not found."
[ -f "$RG" ] || fail "$RG not found."
[ -f "$GS_SRC" ] || fail "$GS_SRC not found."
[ -f "$ICON_SRC" ] || fail "$ICON_SRC not found."

# 1. google-services.json, and the template still applies the Google services plugin when it exists (nothing is added here)
grep -qF "\"package_name\": \"$PKG\"" "$GS_SRC" || fail "$GS_SRC is not for the app $PKG."
grep -qF "\"project_id\": \"$PROJECT\"" "$GS_SRC" || fail "$GS_SRC is not for the project $PROJECT."
perl -0ne 'exit(( /file\(\x27google-services\.json\x27\).*?apply plugin: \x27com\.google\.gms\.google-services\x27/s ) ? 0 : 1)' "$AG" \
  || fail "$AG no longer applies the com.google.gms.google-services plugin when google-services.json exists (the Capacitor template changed)."
grep -qF "classpath 'com.google.gms:google-services:" "$RG" || fail "$RG has no com.google.gms:google-services classpath (the Capacitor template changed)."
cp "$GS_SRC" "$A/app/google-services.json"
cmp -s "$GS_SRC" "$A/app/google-services.json" || fail "$A/app/google-services.json is not config/google-services.json."

# 2. the FCM library version (as scripts/android-ads.sh pins the ads libraries)
N=firebaseMessagingVersion
if ! grep -qE "^[[:space:]]*$N[[:space:]]*=" "$V"; then
  PIN_NAME="$N" PIN_VERSION="$FCM_VERSION" perl -0pi -e 's/(\bext\s*\{.*?)(\n\})/$1\n    $ENV{PIN_NAME} = \x27$ENV{PIN_VERSION}\x27$2/s' "$V"
fi
[ "$(grep -cE "^[[:space:]]*$N[[:space:]]*=" "$V")" = 1 ] || fail "$N is not set exactly once in $V."
grep -qE "^[[:space:]]*$N = '$FCM_VERSION'\$" "$V" || fail "$N is not pinned to $FCM_VERSION in $V."

# 3. the three meta-data inside <application>; one already there with another value or elsewhere fails (check_metas)
meta() { # name attribute
  if ! grep -q "android:name=\"$1\"" "$M"; then
    META_LINE="<meta-data android:name=\"$1\" $2 />" perl -0pi -e 's#</application>#    $ENV{META_LINE}\n    </application>#' "$M"
  fi
}
meta "$AUTO" 'android:value="false"'
meta "$ICON_META" 'android:resource="@drawable/ic_stat_friend"'
meta "$CHAN_META" 'android:value="friend"'
check_metas "$M"

# 4. the small notification icon
I="$A/app/src/main/res/drawable/ic_stat_friend.xml"
mkdir -p "$(dirname "$I")"
cp "$ICON_SRC" "$I"
cmp -s "$ICON_SRC" "$I" || fail "$I is not the icon from assets/notification."
echo "Friends set-up applied: the https://$HOST/c/ App Links filter is on the main activity; google-services.json ($PROJECT),"
echo "firebase-messaging $FCM_VERSION pinned, FCM auto-init off, the ic_stat_friend icon and the friend channel in the manifest."
