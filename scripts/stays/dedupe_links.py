#!/usr/bin/env python3
"""Enforces one booking link <-> one property (owner rule, 2026-10-12): no booking-site page may be
attached to more than one of our stays, and no stay may hold two verified links to the same page.

A known failure mode (docs/HANDOFF.md): a scripted batch gave one page ("Hotel Crystal Ganga Heights")
to five stays, and postcheck_matches.py already guards *new* merges against this at merge time. This
script is the matching audit for links that already exist in the live/staged files:

  docs/booking-links/found.tsv            search results waiting to be merged (status: verified)
  scripts/stays/ota-links.tsv             the committed, live links the site builds from
  scripts/stays/.cache/places/ota-links.tsv   Google Maps places' links (not committed)

The rule is per OTA (owner, 2026-10-12): a stay may hold one Booking.com link *and* one Agoda link *and*
one MakeMyTrip link, etc. — that is normal and never flagged. Only two things are a violation: (a) the
same OTA page claimed by two different (non-duplicate) stays, (b) the same stay holding two different
pages on the *same* OTA. (a) is caught by grouping verified rows by their exact URL (which already pins
down one OTA page, so two different OTAs for one stay never collide here); (b) is caught separately by
grouping verified rows by (key, platform).

For every URL claimed by more than one key, it reuses the pipeline's own same-property test
(organise_found.same_name + unit: 60% token overlap, same bedroom/BHK count, same city) to tell apart:
  - a page legitimately held by two keys because the directory lists that hotel twice (RULES.md: this
    is allowed and left alone), from
  - a genuine conflict (different hotels sharing one page by mistake), which is resolved by keeping the
    row whose name best matches the page's own title (from the note's quoted title, when there is one)
    or, failing that, the first-seen row, and demoting the rest:
      - in ota-links.tsv / the places ota-links.tsv: status verified -> doubtful (build_pages.py already
        ignores non-verified rows), never deleted, with a note saying why;
      - in found.tsv: the row is removed and appended to docs/booking-links/review.tsv for the owner,
        the same place unresolved rows already go.
A group where a key's name cannot be found in any cache is left untouched and flagged in the report
only: guessing without a name would be worse than leaving it for a person.

For every (key, platform) held by more than one distinct URL, the same keep-best/demote-the-rest
resolution runs, scored against the stay's own name (since every row is already the same key, the
same-property test above does not apply): the row whose URL path/title words overlap the stay's name
best is kept, the rest demoted/moved exactly like a URL conflict.

Usage:
  node scripts/py.mjs scripts/stays/dedupe_links.py --dry     report only, nothing written
  node scripts/py.mjs scripts/stays/dedupe_links.py           fix: demote/move the losing rows
  node scripts/py.mjs scripts/stays/dedupe_links.py --check   exit 1 if any *unresolved* violation remains (for CI/tests)
"""
import collections
import csv
import datetime
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import organise_found as of  # noqa: E402

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

HERE = of.HERE
ROOT = os.path.join(HERE, '..', '..')
BL = of.BL
FOUND = os.path.join(BL, 'found.tsv')
REVIEW = os.path.join(BL, 'review.tsv')
OTA_LINKS = os.path.join(HERE, 'ota-links.tsv')
PLACES_OTA_LINKS = os.path.join(HERE, '.cache', 'places', 'ota-links.tsv')
REVIEW_COLS = ['key', 'name', 'city', 'platform', 'url', 'page_shows', 'why_review']

DRY = '--dry' in sys.argv
CHECK = '--check' in sys.argv

norm_url = lambda u: re.sub(r'/+$', '', u.split('?')[0]).lower()


class Lock:
    """Same lock scripts/stays/prune_unfound.py and seed_unfound_new_cities.py use for docs/booking-links/*.tsv:
    a stay-worker-safe mutex, since those files can be mid-write by the search while this runs."""

    def __enter__(self):
        self.dir = os.path.join(BL, '.lists-lock')
        while True:
            try:
                os.mkdir(self.dir)
                return self
            except (FileExistsError, PermissionError):
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


def write_tsv(path, cols, rows, header=True):
    clean = lambda v: re.sub(r'[\t\r\n]+', ' ', str(v))
    tmp = f'{path}.tmp-{os.getpid()}'
    with open(tmp, 'w', encoding='utf8', newline='\n') as f:
        if header:
            f.write('\t'.join(cols) + '\n')
        for r in rows:
            f.write('\t'.join(clean(r.get(c, '')) for c in cols) + '\n')
    for attempt in range(20):
        try:
            os.replace(tmp, path)
            break
        except PermissionError:
            if attempt == 19:
                raise
            time.sleep(0.1)


def load_names():
    """key -> (name, city): all four cities' crawl caches first, then Google places, then the site's own
    index last (current truth wins). of.processed_stays()/of.stays_index() only read the Rishikesh +
    Haridwar files, so Dehradun and Mussoorie are added here too (scripts/stays/cities.py)."""
    names = {}
    for city_dir in ('', 'haridwar', 'dehradun', 'mussoorie'):
        path = os.path.join(HERE, '.cache', city_dir, 'stays.json') if city_dir else os.path.join(HERE, '.cache', 'stays.json')
        if os.path.exists(path):
            for s in json.load(open(path, encoding='utf8')):
                names.setdefault(s['id'], (s.get('n') or '', s.get('cy') or city_dir or 'rishikesh'))
    places_path = os.path.join(HERE, '.cache', 'places', 'all-stays.json')
    if os.path.exists(places_path):
        for s in json.load(open(places_path, encoding='utf8')):
            names.setdefault(s['id'], (s.get('n') or '', s.get('cy') or 'rishikesh'))
    for fn in ('stays-index-data.js', 'stays-index-data-haridwar.js', 'stays-index-data-dehradun.js', 'stays-index-data-mussoorie.js'):
        p = os.path.join(ROOT, 'assets', 'js', 'modules', fn)
        if not os.path.exists(p):
            continue
        m = re.search(r'export const STAYS_INDEX = (\[.*?\]);\n', open(p, encoding='utf8').read(), re.S)
        if not m:
            continue
        for s in json.loads(m.group(1)):
            names[s['id']] = (s.get('n') or '', s.get('cy') or 'rishikesh')  # site truth wins last
    return names


def page_title(note):
    m = re.search(r'"([^"]+)"', note or '')
    return m.group(1) if m else ''


def same_property(names, a, b):
    """Owner rule reused from organise_found.py's own duplicate test: same core name (60% token overlap),
    same bedroom/BHK count, same city."""
    na, ca = names[a]
    nb, cb = names[b]
    if ca != cb:
        return False
    ta, tb = of.tokens(na), of.tokens(nb)
    return of.same_name(ta, tb) and of.unit(na) == of.unit(nb)


def pick_keeper(names, keys, note_by_key):
    """Best match to the page's own title when we have one; otherwise first-seen (file order)."""
    title = next((t for k in keys if (t := page_title(note_by_key.get(k, '')))), '')
    if title:
        tt = of.tokens(title)
        scored = sorted(keys, key=lambda k: len(of.tokens(names.get(k, ('', ''))[0]) & tt) / max(1, len(of.tokens(names.get(k, ('', ''))[0]) | tt)), reverse=True)
        return scored[0]
    return keys[0]  # first-seen: file order is preserved by the caller


def audit_group(names, keys, note_by_key):
    """Returns (legit, unresolved, keeper, losers) for one url's claimants."""
    known = [k for k in keys if k in names]
    unknown = [k for k in keys if k not in names]
    if len(known) < 2:
        return True, bool(unknown and len(keys) > 1), None, []
    ref = known[0]
    if all(same_property(names, ref, k) for k in known[1:]):
        return True, bool(unknown), None, []
    keeper = pick_keeper(names, known, note_by_key)
    losers = [k for k in known if k != keeper]
    return False, bool(unknown), keeper, losers


def pick_keeper_by_name(names, key, items, get_note):
    """items: list of indices/rows sharing one (key, platform). Keeps the one whose URL/title words
    overlap the stay's own name best; ties keep the first-seen (file order, already the list order)."""
    stay_tokens = of.tokens(names.get(key, ('', ''))[0])
    if not stay_tokens:
        return items[0]

    def score(it):
        title = page_title(get_note(it))
        t = of.tokens(title) if title else set()
        return len(t & stay_tokens) / max(1, len(t | stay_tokens)) if t else -1
    return max(items, key=score)


def dedupe_same_stay_platform(cols, idxs_verified, key_col, platform_col, url_col, note_col, names, label, is_found=False):
    """The other half of the owner's rule: the same stay must never hold two different pages on one OTA
    (a Booking.com link and an Agoda link for one stay is fine and never touched here; two different
    Booking.com pages for one stay is not)."""
    by_kp = collections.defaultdict(list)
    for i in idxs_verified:
        by_kp[(cols[i][key_col], cols[i][platform_col])].append(i)
    demote = []
    for (key, platform), group in by_kp.items():
        urls = {norm_url(cols[i][url_col]) for i in group}
        if len(urls) < 2:
            continue
        keeper = pick_keeper_by_name(names, key, group, lambda i: cols[i][note_col])
        for i in group:
            if i != keeper:
                demote.append(i)
                verb = 'move to review.tsv' if is_found else 'demote'
                print(f'  [{label}] {verb} {key}: two {platform} pages for one stay, kept '
                      f'{cols[keeper][url_col]}, dropping {cols[i][url_col]}')
    return demote


def dedupe_ota_links(path, names, label, review_rows):
    if not os.path.exists(path):
        return 0, 0, 0
    with open(path, encoding='utf8', newline='') as f:
        lines = f.read().splitlines()
    header = None
    rows = lines
    if lines and lines[0].split('\t')[0] == 'key' and lines[0].split('\t')[1] == 'status':
        header = lines[0]
        rows = lines[1:]
    cols = [r.split('\t') for r in rows if r.strip()]
    ncol = max((len(c) for c in cols), default=6)
    by_url = collections.defaultdict(list)
    for i, c in enumerate(cols):
        while len(c) < ncol:
            c.append('')
        if c[1] == 'verified':
            by_url[norm_url(c[3])].append(i)
    note_by_key = {cols[i][0]: cols[i][4] for idx in by_url.values() for i in idx}
    demoted = flagged = legit_groups = 0
    for url, idxs in by_url.items():
        keys = [cols[i][0] for i in idxs]
        if len(set(keys)) < 2:
            continue
        legit, has_unknown, keeper, losers = audit_group(names, keys, note_by_key)
        if legit:
            legit_groups += 1
            if has_unknown:
                flagged += 1
                print(f'  [{label}] unresolved (key with no known name) at {url}: {keys}')
                for k in set(keys):
                    review_rows.append({
                        'key': k, 'name': names.get(k, ('', ''))[0], 'city': names.get(k, ('', ''))[1],
                        'platform': '', 'url': url, 'page_shows': page_title(note_by_key.get(k, '')),
                        'why_review': f'{label}: shares a page with {[x for x in keys if x != k]}; '
                                      f'could not confirm same property (a key has no name in any cache) — dedupe_links.py',
                    })
            continue
        keeper_name = names.get(keeper, ('?', '?'))[0]
        for i in idxs:
            if cols[i][0] in losers:
                note = cols[i][4]
                cols[i][4] = f'duplicate page: kept for {keeper} ({keeper_name}); demoted by dedupe_links.py ({note})'.strip()
                cols[i][1] = 'doubtful'
                demoted += 1
                print(f'  [{label}] demote {cols[i][0]} ({names.get(cols[i][0], ("?", "?"))[0]}): page {url} kept for {keeper}')
    # second pass: the same stay must not hold two different pages on the same OTA (different OTAs for
    # one stay are fine and are never grouped together, since they are different URLs)
    still_verified = [i for i, c in enumerate(cols) if c[1] == 'verified']
    for i in dedupe_same_stay_platform(cols, still_verified, 0, 2, 3, 4, names, label):
        key = cols[i][0]
        note = cols[i][4]
        cols[i][4] = f'duplicate OTA: this stay already has another {cols[i][2]} link; demoted by dedupe_links.py ({note})'.strip()
        cols[i][1] = 'doubtful'
        demoted += 1
    if demoted and not DRY:
        out_rows = ['\t'.join(c[:ncol]) for c in cols]
        content = (header + '\n' if header else '') + ''.join(r + '\n' for r in out_rows)
        tmp = f'{path}.tmp-{os.getpid()}'
        with open(tmp, 'w', encoding='utf8', newline='\n') as fh:
            fh.write(content)
        os.replace(tmp, path)
    return demoted, flagged, legit_groups


def dedupe_found(names, review_rows):
    if not os.path.exists(FOUND):
        return 0, 0, 0, []
    rows = of.tsv(FOUND)
    note_by_key = {r['key']: r.get('note', '') for r in rows}
    by_url = collections.defaultdict(list)
    for idx, r in enumerate(rows):
        if r.get('status') == 'verified':
            by_url[norm_url(r['url'])].append(idx)
    drop_idx = set()
    demoted = flagged = legit_groups = 0
    for url, idxs in by_url.items():
        keys = [rows[i]['key'] for i in idxs]
        if len(set(keys)) < 2:
            continue
        legit, has_unknown, keeper, losers = audit_group(names, keys, note_by_key)
        if legit:
            legit_groups += 1
            if has_unknown:
                flagged += 1
                print(f'  [found.tsv] unresolved (key with no known name) at {url}: {keys}')
                for i in idxs:
                    r = rows[i]
                    if r['key'] not in names:
                        review_rows.append({
                            'key': r['key'], 'name': r.get('name', ''), 'city': r.get('city', ''),
                            'platform': r.get('platform', ''), 'url': r['url'],
                            'page_shows': page_title(r.get('note', '')),
                            'why_review': f'found.tsv: shares a page with {[x for x in keys if x != r["key"]]}; '
                                          f'this key has no name in any stays cache — dedupe_links.py',
                        })
            continue
        keeper_name = names.get(keeper, ('?', '?'))[0]
        for i in idxs:
            r = rows[i]
            if r['key'] in losers:
                drop_idx.add(i)
                review_rows.append({
                    'key': r['key'], 'name': r.get('name', ''), 'city': r.get('city', ''),
                    'platform': r.get('platform', ''), 'url': r['url'],
                    'page_shows': page_title(r.get('note', '')),
                    'why_review': f'duplicate page: same page as {keeper} ({keeper_name}), kept for that stay by dedupe_links.py',
                })
                demoted += 1
                print(f'  [found.tsv] move {r["key"]} ({r.get("name", "")}) to review.tsv: page {url} kept for {keeper}')
    # second pass: the same stay must not hold two different pages on the same OTA (a different OTA for
    # one stay is fine and is never grouped here, since it is a different URL)
    still_verified = [i for i, r in enumerate(rows) if r.get('status') == 'verified' and i not in drop_idx]
    by_kp = collections.defaultdict(list)
    for i in still_verified:
        by_kp[(rows[i]['key'], rows[i].get('platform', ''))].append(i)
    for (key, platform), group in by_kp.items():
        urls = {norm_url(rows[i]['url']) for i in group}
        if len(urls) < 2:
            continue
        keeper = pick_keeper_by_name(names, key, group, lambda i: rows[i].get('note', ''))
        for i in group:
            if i == keeper:
                continue
            r = rows[i]
            drop_idx.add(i)
            review_rows.append({
                'key': r['key'], 'name': r.get('name', ''), 'city': r.get('city', ''),
                'platform': r.get('platform', ''), 'url': r['url'], 'page_shows': page_title(r.get('note', '')),
                'why_review': f'duplicate OTA: this stay already has another {platform} link ({rows[keeper]["url"]}), '
                              f'kept that one — dedupe_links.py',
            })
            demoted += 1
            print(f'  [found.tsv] move {key}: two {platform} pages for one stay, kept {rows[keeper]["url"]}, dropping {r["url"]}')
    kept = [r for i, r in enumerate(rows) if i not in drop_idx]
    return demoted, flagged, legit_groups, kept


def main():
    names = load_names()
    print(f'{len(names)} known stay names loaded (site + crawl cache + Google places)')
    total_demoted = total_flagged = total_legit = 0
    review_rows = []
    for path, label in ((OTA_LINKS, 'ota-links.tsv'), (PLACES_OTA_LINKS, 'places ota-links.tsv')):
        d, f, g = dedupe_ota_links(path, names, label, review_rows)
        total_demoted += d
        total_flagged += f
        total_legit += g
    d, f, g, kept_found = dedupe_found(names, review_rows)
    total_demoted += d
    total_flagged += f
    total_legit += g
    if (d or review_rows) and not DRY:
        existing_review = of.tsv(REVIEW)
        existing_keys = {r['key'] for r in existing_review}
        new_review = existing_review + [r for r in review_rows if r['key'] not in existing_keys]
        with Lock():
            if d:
                write_tsv(FOUND, ['key', 'status', 'platform', 'url', 'note', 'name', 'city', 'source'], kept_found)
            if len(new_review) > len(existing_review):
                write_tsv(REVIEW, REVIEW_COLS, new_review)
    verb = 'would demote/move' if DRY else 'demoted/moved'
    print(f'{total_legit} legitimate shared-page groups left alone (same property listed twice); '
          f'{verb} {total_demoted} conflicting rows; {total_flagged} groups flagged for manual review '
          f'({len(review_rows)} rows {"would go" if DRY else "went"} to review.tsv)')
    if CHECK and (total_demoted or total_flagged):
        sys.exit(1)


if __name__ == '__main__':
    main()
