#!/usr/bin/env python3
"""Coverage report: how much of Rishikesh and Haridwar do we list, and what is still uncovered (owner, 2026-10-07: "no listing
should be missed"). Read-only: local files only, no Places or BigQuery calls. An input a machine lacks (.cache/places/*.json,
the registry) prints n/a instead of failing.

  npm run report:coverage            = node scripts/py.mjs scripts/stays/coverage_report.py
  python3 scripts/stays/coverage_report.py [--json] [--root DIR]

Sections: site stays per city (directory / Google Maps / booking-found, each linked and unlinked, our own 3), the search's open
work (unfound.tsv by status), the seen pages (checked by state and platform, the queue, what new-properties.tsv decided) and
an estimate of what is still uncovered. The estimates say plainly that headless reads only Booking.com today.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import booking_stays as bs  # noqa: E402
import import_new_stays as ins  # noqa: E402
import organise_found as of  # noqa: E402

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

MODULES = {'rishikesh': 'stays-index-data.js', 'haridwar': 'stays-index-data-haridwar.js'}
STATUSES = ['retry', 'none', 'review', 'manual', 'duplicate']


def module_stays(city):
    p = os.path.join(bs.ROOT, 'assets', 'js', 'modules', MODULES[city])
    if not os.path.exists(p):
        return None
    m = re.search(r'export const STAYS_INDEX = (\[.*?\]);\n', open(p, encoding='utf8').read(), re.S)
    return json.loads(m.group(1)) if m else None


def split(stays, reg_slugs):
    out = {k: {'total': 0, 'linked': 0, 'unlinked': 0} for k in ('directory', 'google', 'booking')}
    for d in stays:
        kind = 'google' if d.get('gm') else 'booking' if d['id'] in reg_slugs else 'directory'
        out[kind]['total'] += 1
        out[kind]['linked' if d.get('o') else 'unlinked'] += 1
    out['total'] = sum(out[k]['total'] for k in ('directory', 'google', 'booking'))
    return out


def build():
    reg = bs.load_registry()
    reg_slugs = {r['slug'] for r in reg}
    rep = {'stays': {}, 'search': {}, 'seen': {}, 'uncovered': {}}

    # ---- site stays
    tot = {k: {'total': 0, 'linked': 0, 'unlinked': 0} for k in ('directory', 'google', 'booking')}
    for city in MODULES:
        s = module_stays(city)
        if s is None:
            rep['stays'][city] = None
            continue
        rep['stays'][city] = split(s, reg_slugs)
        for k in tot:
            for f in ('total', 'linked', 'unlinked'):
                tot[k][f] += rep['stays'][city][k][f]
    tot['total'] = sum(tot[k]['total'] for k in ('directory', 'google', 'booking'))
    rep['stays']['total'] = tot
    rep['stays']['own'] = len(bs.own_stays())
    rep['stays']['registry_rows'] = len(reg)
    rep['stays']['registry_on_site'] = sum(1 for c in MODULES for d in (module_stays(c) or []) if d['id'] in reg_slugs)

    # ---- search open work
    unfound = ins.tsv_rows(os.path.join(bs.BL, 'unfound.tsv'))
    for city in MODULES:
        rep['search'][city] = {st: sum(1 for r in unfound if r.get('city') == city and r.get('status') == st) for st in STATUSES}
    rep['search']['total'] = {st: sum(1 for r in unfound if r.get('status') == st) for st in STATUSES}
    rep['search']['review_tsv'] = len(ins.tsv_rows(os.path.join(bs.BL, 'review.tsv')))
    found = ins.tsv_rows(os.path.join(bs.BL, 'found.tsv'))
    rep['search']['found_tsv'] = {city: sum(1 for r in found if r.get('city') == city) for city in MODULES}
    rep['search']['found_tsv']['total'] = len(found)

    # ---- seen pages
    seen = ins.tsv_rows(os.path.join(bs.BL, 'seen-pages.tsv'))
    seen_urls = {bs.canon_url(r['url']): r for r in seen if r.get('url')}
    latest = {}
    for r in ins.tsv_rows(os.path.join(bs.BL, 'seen-pages-checked.tsv')):
        if r.get('url'):
            latest[bs.canon_url(r['url'])] = r
    known = ins.known_urls(set())
    reg_urls = bs.registry_urls(reg)
    by_state = {}
    for r in latest.values():
        by_state.setdefault(r.get('state', ''), {}).setdefault(r.get('platform', ''), 0)
        by_state[r.get('state', '')][r.get('platform', '')] += 1
    queue = {}
    for u, r in seen_urls.items():
        if u not in latest and u not in known and u not in reg_urls:
            queue[r.get('platform', '')] = queue.get(r.get('platform', ''), 0) + 1
    decisions = ins.tsv_rows(os.path.join(bs.BL, 'new-properties-decisions.tsv'))
    dec = {}
    held = {}
    for d in decisions:
        dec[d['decision']] = dec.get(d['decision'], 0) + 1
        if d['decision'] == 'held':
            w = d['why'].split(' (')[0].split(':')[0][:60]
            held[w] = held.get(w, 0) + 1
    newp = ins.tsv_rows(os.path.join(bs.BL, 'new-properties.tsv'))
    rep['seen'] = {
        'unique': len(seen_urls),
        'already_known': sum(1 for u in seen_urls if u in known or u in reg_urls),
        'checked': by_state,
        'checked_total': len(latest),
        'queue': queue,
        'queue_total': sum(queue.values()),
        'new_properties_rows': len(newp),
        'decisions': dec,
        'held_reasons': held,
        'decisions_file': bool(decisions),
    }

    # ---- uncovered estimate
    g_unfound = sum(1 for r in unfound if r.get('key', '').startswith('g-'))
    cache = os.path.join(bs.HERE, '.cache', 'places')
    google = {'source': 'unfound.tsv g- keys (each is a Google place awaiting a booking link)', 'count': g_unfound}
    for fn in ('unlinked-stays.json', 'new-with-link.json'):
        p = os.path.join(cache, fn)
        if os.path.exists(p):
            try:
                google[fn] = len(json.load(open(p, encoding='utf8')))
            except (ValueError, OSError):
                google[fn] = None
        else:
            google[fn] = 'n/a'
    if isinstance(google.get('unlinked-stays.json'), int):
        google['count'], google['source'] = google['unlinked-stays.json'], '.cache/places/unlinked-stays.json'
    unreadable = sum(n for st in ('unreadable', 'no pin') for n in by_state.get(st, {}).values())
    plat = {}
    for st, d in by_state.items():
        for p, n in d.items():
            plat.setdefault(p, {}).setdefault(st, 0)
            plat[p][st] += n
    ok_total = sum(by_state.get('ok', {}).values())
    new_share = (sum(1 for n in newp if bs.canon_url(n['url']) in latest and latest[bs.canon_url(n['url'])].get('state') == 'ok') / ok_total) if ok_total else None
    expect = {}
    for p, n in queue.items():
        checked = sum(plat.get(p, {}).values())
        rate = (plat.get(p, {}).get('ok', 0) / checked) if checked else None
        expect[p] = round(n * rate * new_share, 1) if rate is not None and new_share is not None else None
    rep['uncovered'] = {
        'google_without_link': google,
        'unreadable_seen_pages': {'count': unreadable, 'unreadable': sum(by_state.get('unreadable', {}).values()), 'no_pin': sum(by_state.get('no pin', {}).values()),
                                  'by_platform': {p: d.get('unreadable', 0) + d.get('no pin', 0) for p, d in plat.items() if d.get('unreadable', 0) + d.get('no pin', 0)}},
        'expected_yield_of_queue': {'label': 'estimate: queue x ok-rate of that site x share of ok pages that are new', 'new_share': None if new_share is None else round(new_share, 3),
                                    'by_platform': expect, 'total': round(sum(v for v in expect.values() if v), 1) if expect else 0},
        'out_of_scope_not_uncovered': sum(by_state.get('elsewhere', {}).values()),
    }
    return rep


def fmt(rep):
    L = []
    na = lambda v: 'n/a' if v is None else v
    L.append('COVERAGE: stays on the site (linked = has a verified booking page)')
    L.append(f"  {'':12}{'directory':>16}{'Google Maps':>16}{'booking-found':>16}{'total':>8}")
    for city in ('rishikesh', 'haridwar', 'total'):
        c = rep['stays'][city]
        if c is None:
            L.append(f'  {city:12}n/a (no data module)')
            continue
        cell = lambda k: f"{c[k]['total']} ({c[k]['linked']}/{c[k]['unlinked']})"
        L.append(f"  {city:12}{cell('directory'):>16}{cell('google'):>16}{cell('booking'):>16}{c['total']:>8}")
    L.append(f"  (linked/unlinked in brackets) plus our own {rep['stays']['own']} stays pinned in every list; registry: {rep['stays']['registry_rows']} row(s), {rep['stays']['registry_on_site']} on the site")
    L.append('SEARCH open work (unfound.tsv by status)')
    L.append(f"  {'':12}" + ''.join(f'{s:>10}' for s in STATUSES))
    for city in ('rishikesh', 'haridwar', 'total'):
        L.append(f"  {city:12}" + ''.join(f"{rep['search'][city][s]:>10}" for s in STATUSES))
    L.append(f"  review.tsv: {rep['search']['review_tsv']} row(s); found.tsv: {rep['search']['found_tsv']['total']} row(s)")
    s = rep['seen']
    L.append(f"SEEN PAGES: {s['unique']} unique, {s['already_known']} already known, {s['checked_total']} checked, {s['queue_total']} queued")
    for st, d in sorted(s['checked'].items()):
        L.append(f"  checked {st or '(blank)':11}{sum(d.values()):>5}  " + ', '.join(f'{p} {n}' for p, n in sorted(d.items(), key=lambda t: -t[1])))
    L.append('  queue by site: ' + (', '.join(f'{p} {n}' for p, n in sorted(s['queue'].items(), key=lambda t: -t[1])) or 'empty'))
    L.append(f"  new-properties.tsv: {s['new_properties_rows']} row(s); decisions: " + (', '.join(f'{k} {v}' for k, v in sorted(s['decisions'].items())) if s['decisions_file'] else 'n/a (import_new_stays.py has not run for real yet)'))
    for w, n in sorted(s['held_reasons'].items(), key=lambda t: -t[1]):
        L.append(f'    held: {n} x {w}')
    u = rep['uncovered']
    L.append('STILL UNCOVERED (estimates)')
    g = u['google_without_link']
    L.append(f"  1. Google places with no booking link and not on the site: {g['count']} ({g['source']}); new-with-link.json: {g['new-with-link.json']}")
    r = u['unreadable_seen_pages']
    L.append(f"  2. seen pages we cannot read (invisible to headless): {r['count']} (unreadable {r['unreadable']}, no pin {r['no_pin']}); by site " + ', '.join(f'{p} {n}' for p, n in sorted(r['by_platform'].items(), key=lambda t: -t[1])))
    y = u['expected_yield_of_queue']
    L.append(f"  3. expected new stays from the queue ({y['label']}): {y['total']}; new share {na(y['new_share'])}; " + ', '.join(f'{p} {na(n)}' for p, n in sorted(y['by_platform'].items())))
    L.append(f"  4. out of scope (pin beyond 25 km, not uncovered): {u['out_of_scope_not_uncovered']}")
    L.append('  note: only Booking.com pages are readable by the headless check today; the rest needs the phase 2 reads (README, "Booking-found stays").')
    return '\n'.join(L)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if '--root' in argv:
        bs.set_root(argv[argv.index('--root') + 1])
    rep = build()
    print(json.dumps(rep, ensure_ascii=False, indent=1) if '--json' in argv else fmt(rep))


if __name__ == '__main__':
    main()
