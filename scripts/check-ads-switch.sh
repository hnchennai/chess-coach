#!/bin/sh
# Ads launch-switch guard (F3b, A-D8, criterion 10). Real ads are a checkpoint: this fails the build if the launch switch
# in src/js/ads.js is on, unless ADS_LIVE=yes is set on purpose (in CI: the repository variable ADS_LIVE).
# It also closes the side doors: one switch line, the real ad unit ID once and only in src/js/ads.js, no code outside
# ads.js that picks the unit, and www/ equal to a fresh build of src/.
# Usage: [ADS_LIVE=yes] sh scripts/check-ads-switch.sh        (ADS_SKIP_BUILD=1 skips the rebuild check)
set -e
cd "$(dirname "$0")/.."
REAL='ca-app-pub-1437334216467981/6215501975'
F=src/js/ads.js
fail() { echo "::error::$1"; echo "ADS GUARD FAILED: $1" >&2; exit 1; }

[ -f "$F" ] || fail "$F is missing."

# 1. Exactly one switch line, a plain literal.
N=$(grep -cE '^[[:space:]]*live:[[:space:]]*(true|false)[[:space:]]*,?[[:space:]]*$' "$F" || true)
[ "$N" = 1 ] || fail "$F must have exactly one 'live: true' or 'live: false' line (found $N)."
M=$(grep -cE '(^|[^A-Za-z0-9_.])live[[:space:]]*(:|=([^=]|$))' "$F" || true)
[ "$M" = 1 ] || fail "$F sets 'live' in $M places. Only the one switch line may set it."

# 2. The real ad unit ID: once in src/js/ads.js, nowhere else under src/.
IN=$(grep -oF "$REAL" "$F" | wc -l | tr -d ' ')
[ "$IN" = 1 ] || fail "The real ad unit ID must appear exactly once in $F (found $IN)."
ALL=$(grep -roF "$REAL" src | wc -l | tr -d ' ')
[ "$ALL" = 1 ] || fail "The real ad unit ID appears $ALL times under src/. It may appear only once, in $F."

# 3. Nothing outside ads.js picks the unit or reads the real one.
OUT=$(grep -rlE 'unitFor[[:space:]]*\(|CONFIG\.unit([^A-Za-z0-9_]|$)|\.testUnit' src | grep -v "^$F\$" || true)
[ -z "$OUT" ] || fail "Only $F may choose the ad unit. Found a reference in: $OUT"

# 4. What ships (www/) is what was checked (src/).
[ -f www/js/ads.js ] || fail "www/js/ads.js is missing. Run sh scripts/build.sh and commit www/."
cmp -s "$F" www/js/ads.js || fail "www/js/ads.js does not match $F. Run sh scripts/build.sh and commit www/."
if [ -z "$ADS_SKIP_BUILD" ] && [ -f scripts/build.sh ] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  sh scripts/build.sh >/dev/null
  D=$(git status --porcelain www)
  [ -z "$D" ] || fail "www/ is not a fresh build of src/. Run sh scripts/build.sh and commit www/. Changed: $D"
fi

# 5. The switch itself.
if grep -qE '^[[:space:]]*live:[[:space:]]*true' "$F"; then
  [ "$ADS_LIVE" = yes ] || fail "The ads launch switch is on (live: true in $F) but ADS_LIVE is not yes. Real ads are a checkpoint."
  echo "::warning::Real ads are ON for this build (ADS_LIVE=yes)."
else
  echo "Ads launch switch is off: this build shows Google's test ads only."
fi
