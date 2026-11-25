#!/bin/sh
# Build the app into www/ from src/. www/ is what Capacitor packages for Android,
# and it is also a complete offline static site (web hosting or a claude.ai artifact).
# Usage: sh scripts/build.sh
#   CC_TEST_BUILD=1 marks a test build (FC3 fix round 1): js/buildflags.js says test: true, which shows Settings'
#   "Friend games (test)" and lets tests point the friend client elsewhere (window.FC_CONFIG). Default off: the committed www/,
#   main and Play builds are release builds. CI sets it only for builds that are not on main (.github/workflows/build-apk.yml).
#   CC_WWW_OUT=<dir> builds into another folder (tests); default www.
set -e
cd "$(dirname "$0")/.."
S=src; O=${CC_WWW_OUT:-www}
mkdir -p $O/js
cp $S/js/*.js $O/js/
if [ "$CC_TEST_BUILD" = 1 ]; then T=true; else T=false; fi
printf '/* Written by scripts/build.sh. Do not edit: a test build is CC_TEST_BUILD=1 (FC3 fix round 1). */\nwindow.CC_BUILD = Object.freeze({ test: %s });\n' "$T" > $O/js/buildflags.js
{
  printf '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#1f6b4a">\n'
  cat $S/head.html $S/body.html
  echo '<script src="vendor/chess.js"></script>'
  for f in engine tactics brain course roadmap avatar themes board3d coach3d ramayana3d puzzles profile placement words home daily remind buildflags friends fconfig fclient flow tips ads app; do
    if [ "$f" = fconfig ] || [ "$f" = fclient ]; then
      # FC-D4: friend challenges are Android only. The friend server's config and client are fetched only inside the app,
      # as ads.js below, so the web version has no code that could reach the friend server (scenario 11, criterion 10).
      printf '%s\n' "<script>if(window.Capacitor)document.write('<script src=\"js/$f.js\"><\\/script>')</script>"
    elif [ "$f" = ads ]; then
      # A-D9: the web version loads no ads code. ads.js is fetched only inside the Android app, where Capacitor's bridge exists
      # before any page script runs. Without it app.js finds no window.Ads and does no ads work at all.
      printf '%s\n' "<script>if(window.Capacitor)document.write('<script src=\"js/ads.js\"><\\/script>')</script>"
    else
      echo "<script src=\"js/$f.js\"></script>"
    fi
  done
} > $O/index.html
echo "Built $O/index.html and $O/js/ from $S/"
