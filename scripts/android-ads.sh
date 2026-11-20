#!/bin/sh
# Ads set-up for the generated Android project (F3b). The android/ folder is created fresh on every CI build
# (npx cap add android), so everything the ads libraries need is written here, and the step fails if any of it did not apply.
# Usage: sh scripts/android-ads.sh android        (run after `npx cap add android`, before `npx cap sync android`)
#
# 1. AndroidManifest.xml, inside <application>:
#    - com.google.android.gms.ads.APPLICATION_ID: without it Google's ads library stops the app at launch.
#    - com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT = true: the library sends nothing on its own at app start;
#      it waits until the app calls it (A-D11: on a player's first day the app never calls it).
# 2. variables.gradle: exact versions, so two builds of one commit link the same libraries.
#    - play-services-ads 25.4.0 (the plugin's default is the range 25.4.+; 25.4.0 is the newest 25.4.x on Google's Maven, 2026-11-20)
#    - user-messaging-platform 4.0.0 (the plugin's default; also what play-services-ads-api 25.4.0 asks for)
#    - io.github.webview-native-ui:engine 1.0.11 (the plugin's default is the range [1.0.10,2.0.0); newest on Maven Central, 2026-11-20)
#    The names are the ones @capacitor-community/admob 8.4.2 reads in its android/build.gradle.
set -e
A="${1:-android}"
M="$A/app/src/main/AndroidManifest.xml"
V="$A/variables.gradle"
ADMOB_APP_ID='ca-app-pub-1437334216467981~3972482016'
ADS_VERSION='25.4.0'
UMP_VERSION='4.0.0'
ENGINE_VERSION='1.0.11'
fail() { echo "::error::$1"; echo "ANDROID ADS SET-UP FAILED: $1" >&2; exit 1; }
[ -f "$M" ] || fail "$M not found."
[ -f "$V" ] || fail "$V not found."

meta() { # name value
  if ! grep -q "android:name=\"$1\"" "$M"; then
    META_NAME="$1" META_VALUE="$2" perl -0pi -e 's#</application>#    <meta-data android:name="$ENV{META_NAME}" android:value="$ENV{META_VALUE}" />\n    </application>#' "$M"
  fi
  [ "$(grep -c "android:name=\"$1\"" "$M")" = 1 ] || fail "$1 is not in the manifest exactly once."
  grep -q "<meta-data android:name=\"$1\" android:value=\"$2\" />" "$M" || fail "$1 does not have the value $2."
}
meta com.google.android.gms.ads.APPLICATION_ID "$ADMOB_APP_ID"
meta com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT true
# both must sit inside <application>
perl -0ne 'exit(( /<application\b.*APPLICATION_ID.*DELAY_APP_MEASUREMENT_INIT.*<\/application>/s ) ? 0 : 1)' "$M" || fail "The meta-data is not inside <application>."

pin() { # name version
  if ! grep -qE "^[[:space:]]*$1[[:space:]]*=" "$V"; then
    PIN_NAME="$1" PIN_VERSION="$2" perl -0pi -e 's/(\bext\s*\{.*?)(\n\})/$1\n    $ENV{PIN_NAME} = \x27$ENV{PIN_VERSION}\x27$2/s' "$V"
  fi
  [ "$(grep -cE "^[[:space:]]*$1[[:space:]]*=" "$V")" = 1 ] || fail "$1 is not set exactly once in $V."
  grep -qE "^[[:space:]]*$1 = '$2'\$" "$V" || fail "$1 is not pinned to $2 in $V."
}
pin playServicesAdsVersion "$ADS_VERSION"
pin userMessagingPlatformVersion "$UMP_VERSION"
pin nativeUIEngineVersion "$ENGINE_VERSION"
echo "Ads set-up applied: app ID and delayed measurement in the manifest; play-services-ads $ADS_VERSION, user-messaging-platform $UMP_VERSION, webview-native-ui engine $ENGINE_VERSION."
