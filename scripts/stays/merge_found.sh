#!/bin/bash
# Puts the booking links the search found (docs/booking-links/found.tsv) onto the site.
# Safe while the search workers run: it reads a snapshot of found.tsv and never writes the lists.
#
#   scripts/stays/merge_found.sh          merge, rebuild both cities, check
#   scripts/stays/merge_found.sh --dry    only show what would merge
#
# Steps (docs/booking-links/RULES.md §4): stays that already have a verified link keep it;
# directory stays -> postcheck_matches.py -> merge_ota.py; Google Maps places (g- keys) ->
# postcheck against .cache/places/ota-links.tsv -> push_places.mjs -> import_google_stays.py;
# then process.py, npm run build:stays, npm run check:stays. BigQuery and the commit are left
# to the caller: node scripts/stays/push_bigquery.mjs, then commit and push.
set -euo pipefail
cd "$(dirname "$0")/../.."
S=scripts/stays
W=$S/.cache/booking-search-2026-10-04/merge-$(date +%Y%m%d-%H%M)
mkdir -p "$W"
cp docs/booking-links/found.tsv "$W/found.tsv"
cp $S/ota-links.tsv "$W/ota-links.before.tsv"
cp $S/.cache/places/ota-links.tsv "$W/places-ota-links.before.tsv"

# stays that already have a verified link (directory or places) are left alone
cut -f1,2 $S/ota-links.tsv $S/.cache/places/ota-links.tsv | awk -F'\t' '$2=="verified"{print $1}' | sort -u > "$W/linked.keys"
awk -F'\t' 'NR==FNR{l[$1]=1;next} FNR>1 && $2=="verified" && !($1 in l)' "$W/linked.keys" "$W/found.tsv" | cut -f1-5 > "$W/new.tsv"
grep -v '^g-' "$W/new.tsv" > "$W/new-dir.tsv" || true
grep '^g-' "$W/new.tsv" > "$W/new-places.tsv" || true
echo "new links: $(wc -l < "$W/new.tsv") (directory $(wc -l < "$W/new-dir.tsv"), Google places $(wc -l < "$W/new-places.tsv"))"

python3 $S/postcheck_matches.py "$W/dir-ok.tsv" "$W/new-dir.tsv"
STAYS_FILE=$S/.cache/places/all-stays.json python3 $S/postcheck_matches.py "$W/places-ok.tsv" "$W/new-places.tsv"
[ "${1:-}" = "--dry" ] && { echo "dry run: nothing written ($W)"; exit 0; }

python3 $S/merge_ota.py "$W/dir-ok.tsv"
cat "$W/places-ok.tsv" >> $S/.cache/places/ota-links.tsv
node $S/push_places.mjs
python3 $S/import_google_stays.py
python3 $S/process.py && python3 $S/process.py --city haridwar
npm run --silent build:stays
npm run --silent check:stays
echo "merged; backups and inputs in $W. Next: node $S/push_bigquery.mjs, npm test, commit, push."
