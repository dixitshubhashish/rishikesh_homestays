#!/usr/bin/env python3
"""Takes out of docs/booking-links/unfound.tsv every stay that is already listed (owner, 2026-10-06:
"pins 72 m apart: already listed: if that is already in found, remove it from the overall list; similar others as well").

A row goes when its place already has a verified booking link (checked on the booking page's URL first). Owner rule,
2026-10-06: a page we found whose pin is within 200 m of our own pin for the stay is the same place, whatever the name:
`review` rows and `duplicate` rows are settled by it (the distance in the log, or the pin of the linked stay that owns
the page), and go to found.tsv:
  - a `duplicate` row whose log names a booking page that a linked stay already has (same URL: the same property, e.g. another
    Google Maps listing of one room type), which is then recorded in found.tsv under its own key with that same page
    (owner, 2026-10-06: "check on URL, otherwise move it to found rather than call it a duplicate"), or
  - a `duplicate` row whose "same place as <name> (<key>)" stay is linked, or
  - any `retry`, `none` or `manual` row that sits within 40 m of a linked stay in the same city with the same core name
    and the same size in the name (1BHK / 2BHK / studio): the rule organise_found.py uses for its duplicates, or
  - a row whose own key is linked by now (a worker found it meanwhile).
`review` rows are the owner's checklist and stay. Each removed row is kept in docs/booking-links/duplicates-resolved.tsv
(why, and which linked stay it is). Written under the lists lock, so it is safe while the search workers run.

  python3 scripts/stays/prune_unfound.py --dry     what would go
  python3 scripts/stays/prune_unfound.py           remove them
"""
import csv
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import organise_found as of  # noqa: E402

# Names can hold characters a Windows console code page can't encode (Rishīkesh, Devanagari).
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

HERE = of.HERE
BL = of.BL
DRY = '--dry' in sys.argv
COLS = ['key', 'name', 'city', 'area', 'search_log', 'status']
AUDIT_COLS = ['key', 'name', 'city', 'status_was', 'reason', 'same_as_key', 'same_as_name', 'metres', 'url']
FOUND_COLS = ['key', 'status', 'platform', 'url', 'note', 'name', 'city', 'source']
HOSTS = {'booking.com': 'Booking.com', 'agoda.com': 'Agoda', 'makemytrip.com': 'MakeMyTrip', 'goibibo.com': 'Goibibo', 'trip.com': 'Trip.com',
         'airbnb.': 'Airbnb', 'oyorooms.com': 'OYO', 'hotels.com': 'Hotels.com', 'expedia.': 'Expedia', 'easemytrip.com': 'EaseMyTrip',
         'trivago.': 'Trivago', 'hostelworld.com': 'Hostelworld'}
norm_url = lambda u: re.sub(r'/+$', '', u.split('?')[0]).lower()


def platform_of(url):
    host = re.sub(r'^https?://(www\.)?', '', url).split('/')[0]
    return next((n for h, n in HOSTS.items() if h in host), '')


def pin_metres(text):
    """The distance a log or review line records between a stay's pin and the page's (or the other stay's) pin, in metres."""
    m = re.search(r'pins?[^.;,]*?(\d+(?:\.\d+)?)\s*(km|m)\b', text) or re.search(r'(\d+(?:\.\d+)?)\s*(km|m)\s+(?:from ours|apart|from this stay)', text)
    if not m:
        return None
    v = float(m.group(1))
    return v * 1000 if m.group(2) == 'km' else v


SAME_PIN_M = 200  # owner, 2026-10-06: a found page whose pin is within 200 m of our pin is the same place, whatever the name


def urls_in(text):
    return [u.rstrip('.,;)') for u in re.findall(r'https?://\S+', text)]


def read(path):
    return of.tsv(path)


def write(path, cols, rows, mode='w', header=True):
    clean = lambda v: re.sub(r'[\t\r\n]+', ' ', str(v))
    tmp = f'{path}.tmp-{os.getpid()}'
    with open(tmp, 'w', encoding='utf8', newline='\n') as f:
        if header:
            f.write('\t'.join(cols) + '\n')
        for r in rows:
            f.write('\t'.join(clean(r.get(c, '')) for c in cols) + '\n')
    for attempt in range(20):   # Windows refuses the rename while a worker has the target open for a moment
        try:
            os.replace(tmp, path)
            break
        except PermissionError:
            if attempt == 19:
                raise
            time.sleep(0.1)


class Lock:
    def __enter__(self):
        self.dir = os.path.join(BL, '.lists-lock')
        while True:
            try:
                os.mkdir(self.dir)
                return self
            except (FileExistsError, PermissionError):   # Windows: PermissionError while a just-removed lock dir is pending delete
                try:
                    if time.time() - os.stat(self.dir).st_mtime > 30:
                        os.rmdir(self.dir)
                except OSError:
                    pass
                time.sleep(0.1)

    def __exit__(self, *a):
        try:
            os.rmdir(self.dir)
        except OSError:
            pass


def main():
    # the linked properties (organise_found.py output, re-made first so it is current)
    of.main()
    linked = read(os.path.join(BL, 'found-by-property.tsv'))
    linked_keys = {}
    for r in linked:
        for k in [r['key']] + [a for a in r['alias_keys'].split(';') if a]:
            linked_keys[k] = r
    for r in linked:
        r['_ll'] = (float(r['lat']), float(r['lng'])) if r['lat'] and r['lng'] else None
        r['_tok'], r['_unit'] = of.tokens(r['name']), of.unit(r['name'])

    links_all = read(os.path.join(BL, 'found-links.tsv'))
    url_owner = {}
    for l in links_all:
        url_owner.setdefault(norm_url(l['url']), linked_keys.get(l['key']))
    index, processed = of.stays_index(), of.processed_stays()
    import json
    places_path = os.path.join(HERE, '.cache', 'places', 'all-stays.json')
    places = {p['id']: p for p in json.load(open(places_path, encoding='utf8'))} if os.path.exists(places_path) else {}

    def where(key, row):
        s = index.get(key) or places.get(key) or processed.get(key) or {}
        ll = s.get('ll')
        return (ll[0], ll[1]) if ll and ll[0] not in ('', None) else None

    def metres(a, b):
        return (((a[0] - b[0]) * 111320) ** 2 + ((a[1] - b[1]) * 111320 * 0.87) ** 2) ** 0.5

    with Lock():
        unfound = read(os.path.join(BL, 'unfound.tsv'))
        gone, keep = [], []
        for r in unfound:
            hit = None
            if r['status'] == 'review':
                keep.append(r)
                continue
            # a duplicate row's log names the page that proved it; in a retry/none log a URL is a page that was rejected
            own_url = next((u for u in urls_in(r['search_log']) if platform_of(u) and norm_url(u) in url_owner), None) if r['status'] == 'duplicate' else None
            if r['key'] in linked_keys:
                p = linked_keys[r['key']]
                hit = ('it has a verified link now', p, '')
            elif own_url and url_owner[norm_url(own_url)] and url_owner[norm_url(own_url)]['key'] != r['key']:
                hit = ('same booking page as a linked stay', url_owner[norm_url(own_url)], '', own_url)
            elif r['status'] == 'duplicate':
                m = re.search(r'same place as (.+?) \(([^)]+)\), pins (\d+) m apart', r['search_log'])
                if m and m.group(2) in linked_keys:
                    hit = ('same place as a linked stay', linked_keys[m.group(2)], m.group(3),
                           next((u for u in urls_in(r['search_log']) if platform_of(u)), ''))
            if not hit:
                here = where(r['key'], r)
                if here:
                    tok, unit = of.tokens(r['name']), of.unit(r['name'])
                    for p in linked:
                        if p['city'] != r['city'] or not p['_ll'] or p['_unit'] != unit or abs(p['_ll'][0] - here[0]) > 0.0004:
                            continue
                        d = metres(here, p['_ll'])
                        if d <= 40 and of.same_name(tok, p['_tok']):
                            hit = ('within 40 m of a linked stay with the same name', p, str(int(d)))
                            break
            if hit:
                gone.append(dict(key=r['key'], name=r['name'], city=r['city'], status_was=r['status'], reason=hit[0],
                                 same_as_key=hit[1]['key'], same_as_name=hit[1]['name'], metres=hit[2], url=hit[3] if len(hit) > 3 else ''))
            else:
                keep.append(r)
        by = {}
        for g in gone:
            by[(g['status_was'], g['reason'])] = by.get((g['status_was'], g['reason']), 0) + 1
        # review rows (review.tsv) and review/duplicate rows of unfound.tsv: the 200 m rule
        review = read(os.path.join(BL, 'review.tsv'))
        review_keep, settled = [], []
        for r in review:
            d = pin_metres(r['why_review'])
            owner = url_owner.get(norm_url(r['url'])) if r['url'] else None
            if owner and owner['key'] == r['key']:
                owner = None
            if d is None and owner and owner['_ll']:
                here = where(r['key'], r)
                if here:
                    d = metres(here, owner['_ll'])
            if d is not None and d <= SAME_PIN_M and r['url'] and platform_of(r['url']):
                settled.append(dict(key=r['key'], name=r['name'], city=r['city'], status_was='review',
                                    reason=f'page pin within {SAME_PIN_M} m of our pin', same_as_key=owner['key'] if owner else '',
                                    same_as_name=owner['name'] if owner else '', metres=str(int(d)), url=r['url']))
            else:
                review_keep.append(r)
        settled_keys = {g['key'] for g in settled}
        for r in list(keep):
            if r['key'] in settled_keys:
                keep.remove(r)
        gone += [g for g in settled if g['key'] not in {x['key'] for x in gone}]
        # a duplicate row that records the distance itself (pins N m apart) with a page: same rule, even if the other stay is not linked yet
        for r in list(keep):
            d = pin_metres(r['search_log'])
            u = next((u for u in urls_in(r['search_log']) if platform_of(u)), '')
            if r['status'] == 'duplicate' and d is not None and d <= SAME_PIN_M and u:
                keep.remove(r)
                gone.append(dict(key=r['key'], name=r['name'], city=r['city'], status_was='duplicate', reason=f'page pin within {SAME_PIN_M} m',
                                 same_as_key='', same_as_name='', metres=str(int(d)), url=u))
        print(f'{len(gone)} of {len(unfound)} unfound rows are already listed: {by}')
        if DRY:
            for g in gone[:6]:
                print('  ', g['status_was'], g['name'][:45], '->', g['same_as_name'][:40], g['metres'])
            return
        # a duplicate whose booking page is known goes to found.tsv under its own key with that same page: the file then shows
        # the page for every listing of the property (the site lists it once: merge_found.sh drops "page already belongs to")
        found = read(os.path.join(BL, 'found.tsv'))
        have = {f['key'] for f in found}
        add = [dict(key=g['key'], status='verified', platform=platform_of(g['url']), url=g['url'], name=g['name'], city=g['city'],
                    note=(f"same booking page as {g['same_as_name']} ({g['same_as_key']}): another listing of the same property" if g['same_as_key'] else f"{g['reason']} ({g['metres']} m), settled by the 200 m rule"),
                    source='prune_unfound.py, same booking page') for g in gone if g['url'] and platform_of(g['url']) and g['key'] not in have]
        if add:
            write(os.path.join(BL, 'found.tsv'), FOUND_COLS, found + add)
        print(f'{len(add)} of them recorded in found.tsv with their booking page')
        audit = os.path.join(BL, 'duplicates-resolved.tsv')
        old = read(audit)
        done = {o['key'] for o in old}
        write(audit, AUDIT_COLS, old + [g for g in gone if g['key'] not in done])
        write(os.path.join(BL, 'unfound.tsv'), COLS, keep)
        write(os.path.join(BL, 'review.tsv'), ['key', 'name', 'city', 'platform', 'url', 'page_shows', 'why_review'], review_keep)
        print(f'review.tsv: {len(review_keep)} rows left ({len(settled)} settled by the {SAME_PIN_M} m rule)')
        print(f'unfound.tsv: {len(keep)} rows left')


if __name__ == '__main__':
    main()
