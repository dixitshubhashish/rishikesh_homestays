"""Last check on browser-confirmed booking matches before they are merged.

Usage: python3 scripts/stays/postcheck_matches.py <out.tsv> <results.tsv> [...]
Reads match rows ("key<TAB>verified<TAB>site<TAB>url<TAB>note") and keeps a
row only when its page isn't claimed by a stay with a different name or city:
- a page already linked to another verified stay is kept only for a stay with
  the same name (the directory lists some hotels twice) in the same city;
- among new stays claiming one page, only the one(s) whose name fits the page
  title best (and any exact-name twins in the same city) keep it.
Then: python3 scripts/stays/merge_ota.py <out.tsv>
"""
import collections, glob, json, os, re, sys

# Names can hold characters a Windows console code page can't encode (Rishīkesh, Devanagari).
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = set('hotel hotels the a an and of in at by with rishikesh haridwar hardwar tapovan'.split())


def name_set(n):
    n = n.lower().replace('home stay', 'homestay').replace('guest house', 'guesthouse')
    return frozenset(w for w in re.sub(r'[^a-z0-9 ]+', ' ', n).split() if w not in DROP)


def page_title(row):
    m = re.search(r'"(.*)"', row[4])
    return m.group(1) if m else row[3].rstrip('/').split('/')[-1].replace('-', ' ')


def main():
    out, inputs = sys.argv[1], sys.argv[2:]
    names = {}
    # STAYS_FILE adds another list of stays (e.g. Google Maps places, keys g-<place_id>)
    extra = [os.environ['STAYS_FILE']] if os.environ.get('STAYS_FILE') else []
    for f in [os.path.join(HERE, '.cache', 'stays.json')] + glob.glob(os.path.join(HERE, '.cache', '*', 'stays.json')) + extra:
        for s in json.load(open(f, encoding='utf8')):
            names[s['id']] = (s['n'], s.get('cy') or 'rishikesh')
    rows = {}
    for f in inputs:
        for line in open(f, encoding='utf8'):
            c = line.rstrip('\n').split('\t')
            if len(c) >= 5 and c[1] == 'verified' and c[0] in names and c[0] not in rows:
                rows[c[0]] = c
    owners = collections.defaultdict(list)
    for line in open(os.path.join(HERE, 'ota-links.tsv'), encoding='utf8').read().splitlines()[1:]:
        c = line.split('\t')
        if c[1] == 'verified':
            owners[c[3].split('?')[0].rstrip('/')].append(c[0])
    by_url = collections.defaultdict(list)
    for k, c in rows.items():
        by_url[c[3].split('?')[0].rstrip('/')].append(k)
    keep, drop = [], []
    for url, keys in by_url.items():
        others = [o for o in owners.get(url, []) if o not in keys and o in names]
        if others:
            ref = names[others[0]]
            for k in keys:
                same = name_set(names[k][0]) == name_set(ref[0]) and names[k][1] == ref[1]
                (keep.append(rows[k]) if same else drop.append((k, f'page already belongs to {others[0]}')))
            continue
        t = name_set(page_title(rows[keys[0]]))
        best = max(keys, key=lambda k: len(name_set(names[k][0]) & t) / max(1, len(name_set(names[k][0]) | t)))
        for k in keys:
            same = name_set(names[k][0]) == name_set(names[best][0]) and names[k][1] == names[best][1]
            (keep.append(rows[k]) if same else drop.append((k, f'page fits {best} better')))
    open(out, 'w', encoding='utf8', newline='\n').write(''.join('\t'.join(c[:5]) + '\n' for c in keep))
    print(f'{len(rows)} matches: keep {len(keep)} '
          f'({dict(collections.Counter(names[c[0]][1] for c in keep))}), drop {len(drop)}')
    for k, why in drop:
        print(f'  drop {k} | {names[k][0]} | {why}')


if __name__ == '__main__':
    main()
