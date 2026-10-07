#!/bin/bash
# Puts the booking links the search found (docs/booking-links/found.tsv) onto the site.
# Safe while the search workers run: it reads a snapshot of found.tsv and never writes the lists.
#
#   scripts/stays/merge_found.sh          merge, rebuild both cities, check
#   scripts/stays/merge_found.sh --dry    only show what would merge
#   scripts/stays/merge_found.sh --bigquery   also load the Google Maps places into BigQuery (push_places.mjs);
#                                          off by default (owner, 2026-10-06: BigQuery later); the local files are still written
#
# Steps (docs/booking-links/RULES.md §4): stays that already have a verified link keep it;
# directory stays -> postcheck_matches.py -> merge_ota.py; Google Maps places (g- keys) ->
# postcheck against .cache/places/ota-links.tsv -> push_places.mjs -> import_google_stays.py;
# then process.py, npm run build:stays, npm run check:stays. BigQuery and the commit are left
# to the caller: node scripts/stays/push_bigquery.mjs, then commit and push.
# Runs on macOS, Linux and Windows (Git Bash: bash scripts/stays/merge_found.sh). The Python interpreter is
# chosen by scripts/py.mjs from the OS (no override).
set -euo pipefail
cd "$(dirname "$0")/../.."
DRY=0; BQ=0
for a in "$@"; do case "$a" in --dry) DRY=1;; --bigquery) BQ=1;; esac; done
S=scripts/stays
# one place picks the interpreter for both OSes (scripts/py.mjs: python3 on macOS/Linux, python or py -3 on Windows, UTF-8 forced)
PY="node scripts/py.mjs"   # unquoted below on purpose: it is two words
for f in .cache/places/ota-links.tsv .cache/places/all-stays.json; do
  [ -f "$S/$f" ] || { echo "$S/$f is missing: unpack rh-search-cache.tgz (docs/booking-links/RULES.md section 5)"; exit 1; }
done
W=$S/.cache/booking-search-2026-10-04/merge-$(date +%Y%m%d-%H%M)
mkdir -p "$W"
cp docs/booking-links/found.tsv "$W/found.tsv"
cp $S/ota-links.tsv "$W/ota-links.before.tsv"
cp $S/.cache/places/ota-links.tsv "$W/places-ota-links.before.tsv"

# stays that already have a verified link (directory or places) are left alone
cut -f1,2 $S/ota-links.tsv $S/.cache/places/ota-links.tsv | tr -d '\r' | awk -F'\t' '$2=="verified"{print $1}' | sort -u > "$W/linked.keys"
awk -F'\t' 'NR==FNR{l[$1]=1;next} FNR>1 && $2=="verified" && !($1 in l)' "$W/linked.keys" "$W/found.tsv" | cut -f1-5 | tr -d '\r' > "$W/new.tsv"
grep -v '^g-' "$W/new.tsv" > "$W/new-dir.tsv" || true
grep '^g-' "$W/new.tsv" > "$W/new-places.tsv" || true
echo "new links: $(wc -l < "$W/new.tsv") (directory $(wc -l < "$W/new-dir.tsv"), Google places $(wc -l < "$W/new-places.tsv"))"

$PY $S/postcheck_matches.py "$W/dir-ok.tsv" "$W/new-dir.tsv"
STAYS_FILE=$S/.cache/places/all-stays.json $PY $S/postcheck_matches.py "$W/places-ok.tsv" "$W/new-places.tsv"
[ "$DRY" = 1 ] && { echo "dry run: nothing written ($W)"; exit 0; }

$PY $S/merge_ota.py "$W/dir-ok.tsv"
tr -d '\r' < "$W/places-ok.tsv" >> $S/.cache/places/ota-links.tsv
# --dry-run still writes the local files import_google_stays.py reads (new-with-link.json) and stops before BigQuery
if [ "$BQ" = 1 ]; then node $S/push_places.mjs; else node $S/push_places.mjs --dry-run; fi
$PY $S/import_google_stays.py
$PY $S/process.py && $PY $S/process.py --city haridwar
npm run --silent build:stays
npm run --silent check:stays
echo "merged; backups and inputs in $W. Next: node $S/push_bigquery.mjs, npm test, commit, push."
