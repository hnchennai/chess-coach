#!/bin/sh
# Build the app into www/ from src/. www/ is what Capacitor packages for Android,
# and it is also a complete offline static site (web hosting or a claude.ai artifact).
# Usage: sh scripts/build.sh
set -e
cd "$(dirname "$0")/.."
S=src; O=www
mkdir -p $O/js
cp $S/js/*.js $O/js/
{
  printf '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#1f6b4a">\n'
  cat $S/head.html $S/body.html
  echo '<script src="vendor/chess.js"></script>'
  for f in engine tactics brain course roadmap avatar themes board3d coach3d ramayana3d puzzles profile placement words app; do
    echo "<script src=\"js/$f.js\"></script>"
  done
} > $O/index.html
echo "Built $O/index.html and $O/js/ from $S/"
