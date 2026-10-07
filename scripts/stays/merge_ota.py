"""Merge web-search OTA match results into ota-links.tsv.

Usage: python3 scripts/stays/merge_ota.py <result.tsv> [...]
Each result line: key, status (verified|doubtful|none), ota, url, note.
A newer row for the same key replaces the older one, except that a
'verified' row is never downgraded by a later doubtful/none.
"""
import os, sys, datetime
PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ota-links.tsv')
HEADER = 'key\tstatus\tota\turl\tnote\tchecked'
rows = {}
if os.path.exists(PATH):
    for line in open(PATH, encoding='utf8').read().splitlines()[1:]:
        if line.strip():
            rows[line.split('\t')[0]] = line.split('\t')
today = datetime.date.today().isoformat()
added = 0
for f in sys.argv[1:]:
    for line in open(f, encoding='utf8').read().splitlines():
        c = (line.split('\t') + ['', '', '', '', ''])[:5]
        if not c[0] or c[1] not in ('verified', 'doubtful', 'none'):
            continue
        if rows.get(c[0], [None, ''])[1] == 'verified' and c[1] != 'verified':
            continue
        rows[c[0]] = [c[0], c[1], c[2], c[3].split('?')[0] if c[2] == 'Booking.com' else c[3], c[4].replace('\t', ' '), today]
        added += 1
with open(PATH, 'w', encoding='utf8', newline='\n') as fh:
    fh.write(HEADER + '\n' + ''.join('\t'.join(r) + '\n' for r in sorted(rows.values())))
st = [r[1] for r in rows.values()]
print(f'merged {added}; total {len(rows)}: verified {st.count("verified")}, doubtful {st.count("doubtful")}, none {st.count("none")}')
