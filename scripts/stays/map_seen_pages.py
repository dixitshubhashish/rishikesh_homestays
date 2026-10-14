#!/usr/bin/env python3
"""Maps the pages the search harvested (verify_seen.mjs -> the DB's candidate_pages table, scripts/stays/db.py) across to
our stays (owner, 2026-10-06: "if you get 2 or 4 different properties you can map them across, the city must be
Rishikesh or Haridwar").

A checked page counts when its pin is in Rishikesh or Haridwar (state `ok`, or `elsewhere` under the old centres but
within 25 km of a cities.py centre). It maps to the stay without a link that sits within 200 m of the page's pin in
the same city and reads as the same place: the same words and numbers in the name (organise_found.same_name; a
different size, 1BHK / 2BHK, is another place), or the only stay without a link within 200 m. A mapped page is
recorded in found.tsv (verified, under that stay's key, the note says how) and candidate_pages' row is marked
`imported` (key = the stay it was mapped to, when that stay already has a properties row). A page with no stay for
it stays `checked` in candidate_pages: it is a new-property candidate, and import_new_stays.py (run by
merge_found.sh, owner 2026-10-07) lists it automatically as a new stay when it passes its checks. Only DISTANCE
decides here: 200 m cannot cross from one city to the other, and the town stored with a page was once the FIRST
centre within 25 km, not the nearer one, so the city is worked out again from the pin (booking_stays.city_of). The
pages the registry of auto-listed stays already uses are never new properties again. Written under the lists lock,
safe while the workers run.

  python3 scripts/stays/map_seen_pages.py [--dry]
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import booking_stays as bs  # noqa: E402
import organise_found as of  # noqa: E402
import prune_unfound as pu  # noqa: E402
import db as stays_db  # noqa: E402

BL, HERE = of.BL, of.HERE
DRY = '--dry' in sys.argv


def checked_pages():
    """candidate_pages rows awaiting a decision (status `checked` or `held`: a held page's evidence may have
    refreshed since verify_seen.mjs last read it) whose pin is in Rishikesh or Haridwar: state `ok`, or `elsewhere`
    under the old centres but within 25 km of a cities.py centre. `town` is recomputed as the nearer centre."""
    out = []
    for r in stays_db.get_db().execute(
            "SELECT * FROM candidate_pages WHERE status IN ('checked','held') AND state IN ('ok','elsewhere')").fetchall():
        r = dict(r)
        try:
            town = bs.city_of(float(r['lat']), float(r['lng']))
        except (TypeError, ValueError):
            continue
        if not town:
            continue
        r['town'] = town
        r['platform'] = r.pop('platform_key')
        out.append(r)
    return out


def main():
    checked = checked_pages()
    if not checked:
        print('map_seen_pages: nothing checked yet')
        return
    of.main()
    linked = of.linked_properties()
    linked_keys = {k for r in linked for k in [r['key']] + [a for a in r['alias_keys'].split(';') if a]}
    links_rows = of.links_rows()
    linked_urls = {bs.canon_url(l['url']) for l in links_rows}
    registry = bs.load_registry()   # auto-listed stays (booking-stays.tsv): their pages, primary and extra, are taken
    linked_urls |= set(bs.registry_urls(registry))

    index, processed = of.stays_index(), of.processed_stays()
    pl_path = os.path.join(HERE, '.cache', 'places', 'all-stays.json')
    places = {p['id']: p for p in json.load(open(pl_path, encoding='utf8'))} if os.path.exists(pl_path) else {}
    stays = {}
    for src in (places, processed, index):  # the site's own record wins
        for k, s in src.items():
            if k in linked_keys or not s.get('ll') or s['ll'][0] in ('', None):
                continue
            stays[k] = dict(key=k, name=s.get('n', ''), city=s.get('cy') or ('haridwar' if 'haridwar' in (s.get('ad', '') or '').lower() else 'rishikesh'),
                            ll=(s['ll'][0], s['ll'][1]))
    for s in stays.values():
        s['tok'], s['unit'] = of.tokens(s['name']), of.unit(s['name'])

    # every stay we already have, linked or not (a page for one of these is never a "new property")
    everyone = {}
    for src in (places, processed, index):
        for k, s_ in src.items():
            if s_.get('ll') and s_['ll'][0] not in ('', None):
                everyone[k] = dict(key=k, name=s_.get('n', ''), city=s_.get('cy') or ('haridwar' if 'haridwar' in (s_.get('ad', '') or '').lower() else 'rishikesh'),
                                   ll=(s_['ll'][0], s_['ll'][1]), tok=of.tokens(s_.get('n', '')), unit=of.unit(s_.get('n', '')))
    for k, s_ in bs.own_stays().items():   # our own stays, and the auto-listed ones (until the next build puts them in the index)
        if k not in everyone and s_.get('ll'):
            everyone[k] = dict(key=k, name=s_.get('n', ''), city=bs.city_of(*s_['ll']) or 'rishikesh', ll=(s_['ll'][0], s_['ll'][1]),
                               tok=of.tokens(s_.get('n', '')), unit=of.unit(s_.get('n', '')))
    for g in registry:
        if g['slug'] not in everyone:
            everyone[g['slug']] = dict(key=g['slug'], name=g['name'], city=g['city'], ll=(float(g['lat']), float(g['lng'])),
                                       tok=of.tokens(g['name']), unit=of.unit(g['name']))
    for r in linked:  # a merged duplicate's other keys are the same property as its survivor
        for a in [x for x in r['alias_keys'].split(';') if x]:
            if a in everyone and r['key'] in everyone:
                everyone[a]['survivor'] = r['key']
    links_of = {}
    for l in links_rows:
        links_of.setdefault(l['key'], set()).add(l['ota'])
    metres = lambda a, b: (((a[0] - b[0]) * 111320) ** 2 + ((a[1] - b[1]) * 111320 * 0.87) ** 2) ** 0.5
    found_rows, new_rows, extra_rows, redundant_rows, used = [], [], [], [], set()
    for r in checked:
        if bs.canon_url(r['url']) in linked_urls:
            continue
        pin = (float(r['lat']), float(r['lng']))
        tok, unit = of.tokens(r['name']), of.unit(r['name'])
        near = [(metres(pin, s['ll']), s) for s in stays.values() if s['key'] not in used and abs(s['ll'][0] - pin[0]) < 0.0025]
        near = sorted(((d, s) for d, s in near if d <= pu.SAME_PIN_M), key=lambda t: t[0])
        pick = next(((d, s) for d, s in near if s['unit'] == unit and of.same_name(tok, s['tok'])), None)
        if not pick and len(near) == 1 and near[0][1]['unit'] == unit:
            pick = near[0]
        if pick:
            d, s = pick
            used.add(s['key'])
            found_rows.append(dict(key=s['key'], status='verified', platform=r['platform'], url=r['url'], name=s['name'], city=s['city'],
                                   note=f"mapped from a search for {r['seen_for']}: the page \"{r['name'][:70]}\" has its pin {int(d)} m from this stay's",
                                   source='map_seen_pages.py, page pin within 200 m'))
        else:
            # not for a stay without a link: is it a property we already list (linked, any site)? then it is no new property;
            # when its site is one that stay has no link for yet, it is an extra link for that stay (Booking.com first later)
            same = next((s for s in everyone.values() if abs(s['ll'][0] - pin[0]) < 0.0025
                         and metres(pin, s['ll']) <= pu.SAME_PIN_M and s['unit'] == unit and of.same_name(tok, s['tok'])), None)
            if same:
                owner = same.get('survivor', same['key'])
                if r['platform'] not in links_of.get(owner, set()) and owner not in used:
                    extra_rows.append(dict(key=owner, status='verified', platform=r['platform'], url=r['url'], name=same['name'], city=same['city'],
                                           note=f"extra link: this stay is already listed; the page \"{r['name'][:60]}\" has its pin within 200 m (a search for {r['seen_for']})",
                                           source='map_seen_pages.py, extra link for a listed stay'))
                    links_of.setdefault(owner, set()).add(r['platform'])
                elif r['platform'] in links_of.get(owner, set()):
                    # that stay already has a link for this exact site: this page is the same property, not a new one
                    # or an extra link either -- permanently not a new-property candidate (never add a found.tsv row for it)
                    redundant_rows.append(dict(r, key=owner, note=f"same place as {owner} ({r['platform']} already has its link)"))
                # else: another candidate already claimed this stay's extra-link slot THIS run (owner in `used`); a
                # transient, per-run conflict, not a permanent one -- left `checked`, re-examined next run
            else:
                new_rows.append(r)
    print(f'map_seen_pages: {len(checked)} checked page(s) in Rishikesh/Haridwar: {len(found_rows)} mapped to a stay without a link, {len(extra_rows)} extra links for listed stays, {len(redundant_rows)} already linked under another page, {len(new_rows)} new properties')
    if DRY:
        for f in found_rows[:6]:
            print('  ', f['name'][:40], '<-', f['note'][:110])
        return
    with pu.Lock():
        found = of.tsv(os.path.join(BL, 'found.tsv'))
        have = {f['key'] for f in found}
        add = [f for f in found_rows if f['key'] not in have]
        extra = [e for e in extra_rows if (e['key'], e['platform']) not in {(f['key'], f['platform']) for f in found}]
        mapped_for_db = list(add) + list(extra)   # captured before `add` is reset below, for the found.tsv write-dedup trick
        if extra:
            pu.write(os.path.join(BL, 'found.tsv'), pu.FOUND_COLS, found + add + extra)
            add = []
        if add:
            pu.write(os.path.join(BL, 'found.tsv'), pu.FOUND_COLS, found + add)
        today_ = bs.today()
        for f in mapped_for_db:
            bs.update_candidate(f['url'], 'imported', f['note'], f['key'], today_)
        for f in redundant_rows:   # no found.tsv row (nothing new to add there), but no longer a new-property candidate either
            bs.update_candidate(f['url'], 'imported', f['note'], f['key'], today_)
    print(f'  recorded {len(add) + len(extra)} in found.tsv ({len(extra)} extra links); candidate_pages: {len(mapped_for_db) + len(redundant_rows)} marked imported')


if __name__ == '__main__':
    main()
