"""One-off: add Dehradun and Mussoorie stays to docs/booking-links/unfound.tsv so the
booking-link search picks them up (owner, 2026-10-08). These two cities were added to the
stays pipeline after the original `all.tsv` seed was deleted (2026-10-05, "never recreate
it" — that rule is about not re-seeding Rishikesh/Haridwar from scratch; this is a one-time
top-up for the two cities that were never seeded at all).

Source: scripts/stays/.cache/<city>/stays.json (id/n/a/cy match listing-ids.tsv's
slug/city), filtered to active listings only (listing-ids.tsv active=1). Skips any key
already in found.tsv or unfound.tsv (idempotent — safe to re-run).

Usage: python3 scripts/stays/seed_unfound_new_cities.py [--dry]
"""
import csv
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
BL = os.path.join(ROOT, 'docs', 'booking-links')
CITIES = ['dehradun', 'mussoorie']


class Lock:
    """Same docs/booking-links/.lists-lock mutex as prune_unfound.py, so this is safe to
    run while the search supervisor and its workers are live."""
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


def tsv_rows(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding='utf8', newline='') as f:
        return list(csv.DictReader(f, delimiter='\t', quoting=csv.QUOTE_NONE))


def clean(s):
    # QUOTE_NONE (matching the rest of the booking-link lists) has no escape char, so a stray
    # " would break the writer; drop it rather than escape (one Dehradun listing has one).
    return (s or '').replace('\t', ' ').replace('\n', ' ').replace('\r', ' ').replace('"', '').strip()


def active_slugs():
    out = set()
    with open(os.path.join(HERE, 'listing-ids.tsv'), encoding='utf8', newline='') as f:
        for row in csv.DictReader(f, delimiter='\t', quoting=csv.QUOTE_NONE):
            if row['active'] == '1' and row['city'] in CITIES:
                out.add(row['slug'])
    return out


def build_rows(known, already):
    new_rows = []
    for city in CITIES:
        path = os.path.join(HERE, '.cache', city, 'stays.json')
        if not os.path.exists(path):
            print(f'{city}: no stays.json, skipped')
            continue
        stays = json.load(open(path, encoding='utf8'))
        n = 0
        for s in stays:
            key = s.get('id')
            if not key or key not in known or key in already:
                continue
            new_rows.append([key, clean(s.get('n')), city, clean(s.get('a')), '', 'retry'])
            already.add(key)
            n += 1
        print(f'{city}: {n} new row(s) to add ({len(stays)} in stays.json, {sum(1 for x in stays if x.get("id") in known)} active)')
    return new_rows


def main():
    dry = '--dry' in sys.argv
    known = active_slugs()
    if dry:
        already = {r['key'] for r in tsv_rows(os.path.join(BL, 'found.tsv'))} | \
                  {r['key'] for r in tsv_rows(os.path.join(BL, 'unfound.tsv'))}
        new_rows = build_rows(known, already)
        print(f'--dry: {len(new_rows)} row(s) would be appended to unfound.tsv')
        for r in new_rows[:5]:
            print(' ', r)
        return
    # re-read found.tsv/unfound.tsv and append, all under the lock: the search supervisor
    # writes to these files every few minutes, so both the dedupe check and the append must
    # happen without another writer in between.
    with Lock():
        already = {r['key'] for r in tsv_rows(os.path.join(BL, 'found.tsv'))} | \
                  {r['key'] for r in tsv_rows(os.path.join(BL, 'unfound.tsv'))}
        new_rows = build_rows(known, already)
        path = os.path.join(BL, 'unfound.tsv')
        exists = os.path.exists(path)
        with open(path, 'a', encoding='utf8', newline='') as f:
            w = csv.writer(f, delimiter='\t', quoting=csv.QUOTE_NONE, lineterminator='\n')
            if not exists:
                w.writerow(['key', 'name', 'city', 'area', 'search_log', 'status'])
            w.writerows(new_rows)
    print(f'appended {len(new_rows)} row(s) to {path}')


if __name__ == '__main__':
    main()
