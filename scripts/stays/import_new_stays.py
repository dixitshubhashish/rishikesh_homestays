#!/usr/bin/env python3
"""Auto-lists the properties the search found that we do not list (owner, 2026-10-07: "no listing in Rishikesh or
Haridwar should be missed").

map_seen_pages.py is the one verdict "no stay of ours is this page": it puts such a page in
docs/booking-links/new-properties.tsv. This step takes each of those rows, re-reads the evidence verify_seen.mjs stored for
the page (docs/booking-links/seen-pages-checked.tsv), and lists the ones that pass every check as a NEW STAY with that
booking link, like the Google Maps stays, so the list grows with no manual step. The stay's identity is the committed,
append-only registry scripts/stays/booking-stays.tsv; process.py reads it (booking_stays.registry_rows) and gives the stay
its listing id, area, types and tags; the verified booking link goes to ota-links.tsv (merge_ota.py).

A candidate is listed only when ALL hold (anything else is `held` with its reason in
docs/booking-links/new-properties-decisions.tsv, never silently dropped):
  - the page was read fine (`ok`: a pin from its own data, not dead, still a property page after redirects);
  - its site is one scripts/stays/ota-priority.tsv marks `autolist=y` (not Airbnb, whose pins are offset, or Trivago);
  - lodging evidence: a JSON-LD lodging type and a JSON-LD name (not the browser title);
  - a sane name: 2-8 words, Latin script, no list or marketing title, a distinctive word, a word shared with the URL;
  - open for booking: an availability/reserve button or a guest rating on the page;
  - the pin is within 25 km of the NEARER cities.py centre (that centre is the stay's city);
  - read within the last 14 days.
Duplicates are blocked, in this order: the booking page's URL (a URL a stay already has is never a new stay), then a pin within
200 m AND the same name and size (1BHK / 2BHK are different stays) against every stay we have (site, crawl, our own 3, all
Google Maps places, the registry), then a near miss (same pin test, a fuzzy name) is HELD, not listed: a wrong duplicate is
worse than a delayed listing. The same property on several sites is ONE stay: the best-ranked site (Booking.com first) is the
primary link, the others are extra links; a better-ranked page arriving later swaps the primary (slug, name and listing
id never change).

  python3 scripts/stays/import_new_stays.py [--dry] [--verbose] [--root DIR] [--today YYYY-MM-DD]

--dry writes nothing. Exit code is always 0: a failure here never stops a merge (it is printed). Run from merge_found.sh
(serialised, owner-run); the supervisor only runs --dry.
"""
import datetime
import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import booking_stays as bs  # noqa: E402
import organise_found as of  # noqa: E402
import prune_unfound as pu  # noqa: E402

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

FRESH_DAYS = 14
LAT_WINDOW = 0.0025   # same latitude pre-filter as map_seen_pages (~280 m)
EVIDENCE = ['state', 'ltype', 'name_src', 'locality', 'postal', 'signals', 'final_url']


def arg(argv, name, default=None):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default


def tsv_rows(path):
    return [{k: (v or '') for k, v in r.items() if k is not None} for r in of.tsv(path)]


# ---------------------------------------------------------------------------------------------------- candidates

def load_candidates():
    """new-properties.tsv rows joined (canon_url) to the page's latest row in seen-pages-checked.tsv (the evidence)."""
    latest = {}
    for r in tsv_rows(os.path.join(bs.BL, 'seen-pages-checked.tsv')):
        if r.get('url'):
            latest[bs.canon_url(r['url'])] = r   # a later row (a re-read) wins
    out = []
    for n in tsv_rows(os.path.join(bs.BL, 'new-properties.tsv')):
        if not n.get('url'):
            continue
        e = latest.get(bs.canon_url(n['url']), {})
        c = dict(url=n['url'], platform=e.get('platform') or n.get('platform', ''), name=e.get('name') or n.get('name', ''),
                 lat=e.get('lat') or n.get('lat', ''), lng=e.get('lng') or n.get('lng', ''), seen_for=n.get('seen_for', ''),
                 checked=e.get('checked') or n.get('checked', ''))
        for k in EVIDENCE:
            c[k] = e.get(k, '')
        out.append(c)
    return out


def known_urls(reg_slugs):
    """canon_url -> (key, file) for every page already used by a stay that is not a registry stay (those are handled apart)."""
    out = {}

    def put(url, key, src):
        if url and key not in reg_slugs:
            out.setdefault(bs.canon_url(url), (key, src))

    for r in tsv_rows(os.path.join(bs.BL, 'found.tsv')):
        put(r.get('url'), r.get('key', ''), 'found.tsv')
    for r in tsv_rows(os.path.join(bs.BL, 'found-links.tsv')):
        put(r.get('url'), r.get('key', ''), 'found-links.tsv')
    for path, src in ((os.path.join(bs.HERE, 'ota-links.tsv'), 'ota-links.tsv'),
                      (os.path.join(bs.HERE, '.cache', 'places', 'ota-links.tsv'), 'places/ota-links.tsv')):
        for r in tsv_rows(path):
            if r.get('status') == 'verified':
                put(r.get('url'), r.get('key', ''), src)
    for r in tsv_rows(os.path.join(bs.BL, 'review.tsv')):
        put(r.get('url'), r.get('key', ''), 'review.tsv')
    for r in tsv_rows(os.path.join(bs.BL, 'duplicates-resolved.tsv')):
        put(r.get('url'), r.get('same_as_key') or r.get('key', ''), 'duplicates-resolved.tsv')
    for r in tsv_rows(os.path.join(bs.BL, 'unfound.tsv')):
        if r.get('status') == 'duplicate':
            for u in pu.urls_in(r.get('search_log', '')):
                if pu.platform_of(u):
                    put(u, r.get('key', ''), 'unfound.tsv')
    return out


# ---------------------------------------------------------------------------------------------------- qualify

def qualify(c, today):
    """(None, '') when the candidate may be listed, else ('held' | 'out_of_scope', reason). Also fills c['lat_f'], c['lng_f'],
    c['city'], c['dn'] on the way."""
    try:
        lat, lng = float(c['lat']), float(c['lng'])
        if not (math_finite(lat) and math_finite(lng)):
            raise ValueError
    except ValueError:
        return 'held', 'no pin'
    c['lat_f'], c['lng_f'] = lat, lng
    c['city'] = bs.city_of(lat, lng)
    if not c['city']:
        return 'out_of_scope', 'pin is more than 25 km from Rishikesh and from Haridwar'
    if c['state'] != 'ok':
        return 'held', f"page not read ok yet (state '{c['state'] or 'no evidence'}'): re-read pending"
    if not bs.autolist(c['platform']):
        return 'held', f"{c['platform']} pages are not auto-listed (autolist=n in ota-priority.tsv)"
    if c['final_url'] and bs.canon_url(c['final_url']) != bs.canon_url(c['url']):
        return 'held', 'the page redirects elsewhere (a list or another property)'
    if not c['ltype']:
        return 'held', 'no lodging type in the page data'
    if c['name_src'] != 'ld':
        return 'held', f"name is not from the page data ({c['name_src'] or 'no evidence'})"
    problem = bs.name_problem(c['name'], c['url'])
    if problem:
        return 'held', problem
    sig = {s.strip() for s in c['signals'].split(',') if s.strip()}
    if not ({'bookable', 'rated'} & sig):
        return 'held', 'no availability button or guest rating on the page (maybe closed)'
    try:
        age = (datetime.date.fromisoformat(today) - datetime.date.fromisoformat(c['checked'])).days
    except ValueError:
        return 'held', 'no check date'
    if age > FRESH_DAYS:
        return 'held', f"read {age} days ago (more than {FRESH_DAYS}): re-read pending"
    c['dn'] = bs.display_name(c['name'])
    c['tok'], c['unit'] = of.tokens(c['dn']), of.unit(c['dn'])
    return None, ''


def math_finite(x):
    return x == x and x not in (float('inf'), float('-inf'))


# ---------------------------------------------------------------------------------------------------- duplicates

def verdict(c, pool):
    """Rules 2 and 3 against a pool of stays {key: dict(ll, tok, unit, ...)}: ('duplicate', stay) when a stay within 200 m has
    the same size and the same name; ('held', stay) for a near miss (a fuzzy name within 200 m, any shared word within 50 m);
    (None, None) otherwise."""
    pin = (c['lat_f'], c['lng_f'])
    near = []
    for p in pool.values():
        if abs(p['ll'][0] - pin[0]) >= LAT_WINDOW:
            continue
        d = bs.metres(pin, p['ll'])
        if d <= pu.SAME_PIN_M and p['unit'] == c['unit']:
            near.append((d, p))
    near.sort(key=lambda t: (t[0], t[1]['key']))
    for d, p in near:
        if of.same_name(c['tok'], p['tok']):
            return 'duplicate', p
    for d, p in near:
        if bs.fuzzy_shared(c['tok'], p['tok']) or (d <= 50 and c['tok'] & p['tok']):
            return 'held', p
    return None, None


# ---------------------------------------------------------------------------------------------------- slugs

def make_slug(name, locality, city, taken):
    """The name alone without a trailing city word; a clash adds the locality (the page's own), then the city, then a number.
    Computed once: the registry stores it and it is never recomputed."""
    words = name.split()
    cities = {c['name'].lower() for c in bs.CITIES.values()} | {'hardwar'}
    while len(words) > 1 and re.sub(r'\W', '', words[-1].lower()) in cities:
        words.pop()
    base = of.slugify(' '.join(words))[:70].strip('-') or 'stay'
    if base.startswith('g-'):
        base = 'stay-' + base   # g- is the Google Maps places' key prefix
    loc = of.slugify(locality or '')
    tries = [base]
    if loc and loc not in base and loc not in cities:
        tries.append(f'{base}-{loc}')
    tries.append(f'{base}-{city}')
    tries += (f'{base}-{city}-{n}' for n in range(2, 10000))
    for slug in tries:
        if slug not in taken and not any(k in slug for k in bs.OWN_KEYS):
            taken.add(slug)
            return slug


# ---------------------------------------------------------------------------------------------------- the run

def attach(row, platform, url):
    """Another site's page of a registry stay: an extra link, or the new primary when its site ranks better. Returns
    'extra' | 'swapped' | None (the site is already there: nothing to add)."""
    if platform == row['platform'] or platform in {p for p, _ in bs.extra_pairs(row)}:
        return None
    url = bs.clean_url(url, platform)
    extras = bs.extra_pairs(row)
    if bs.rank_of(platform) < bs.rank_of(row['platform']):
        extras.append((row['platform'], row['url']))
        row['platform'], row['url'] = platform, url
        kind = 'swapped'
    else:
        extras.append((platform, url))
        kind = 'extra'
    row['extra_links'] = ';'.join(f'{p}|{u}' for p, u in sorted(extras, key=lambda t: (bs.rank_of(t[0]), t[1])))
    return kind


def run(argv):
    dry = '--dry' in argv
    verbose = '--verbose' in argv
    root = arg(argv, '--root')
    if root:
        bs.set_root(root)
    today = arg(argv, '--today') or bs.today()

    registry = bs.load_registry()
    by_slug = {r['slug']: r for r in registry}
    reg_before = [dict(r) for r in registry]
    reg_urls = bs.registry_urls(registry)
    counts = dict(listed=0, extra=0, held=0, duplicate=0, out=0)
    held_why = {}
    decisions = []

    # extra pages of registry stays that map_seen_pages recorded in found.tsv (it is read-only here)
    folded = 0
    for f in tsv_rows(os.path.join(bs.BL, 'found.tsv')):
        row = by_slug.get(f.get('key', ''))
        if row and f.get('status') == 'verified' and f.get('url') and bs.canon_url(f['url']) not in reg_urls:
            if attach(row, f.get('platform', ''), f['url']):
                folded += 1
                reg_urls = bs.registry_urls(registry)
    counts['extra'] += folded

    candidates = load_candidates()
    owners = known_urls(set(by_slug))
    pool = bs.known_stays(registry)
    others = {k: v for k, v in pool.items() if v['src'] != 'registry'}
    taken = bs.taken_slugs(registry)

    ready = []
    for c in candidates:
        kind, why = qualify(c, today)
        cu = bs.canon_url(c['url'])
        if cu in reg_urls:   # already one of ours (primary or extra): a re-run changes nothing
            slug = reg_urls[cu]
            is_primary = bs.canon_url(by_slug[slug]['url']) == cu
            reg = by_slug[slug]
            decisions.append(dict(url=c['url'], platform=c['platform'], name=c['name'], decision='listed' if is_primary else 'extra_link',
                                  why=f"new stay in {reg['city']}: {reg['note']}" if is_primary else f"another site's page of {slug}", slug=slug))
            continue
        if kind == 'out_of_scope':
            counts['out'] += 1
            decisions.append(dict(url=c['url'], platform=c['platform'], name=c['name'], decision='out_of_scope', why=why, slug=''))
            continue
        if kind == 'held':
            counts['held'] += 1
            held_why[why.split(' (')[0].split(':')[0][:50]] = held_why.get(why.split(' (')[0].split(':')[0][:50], 0) + 1
            decisions.append(dict(url=c['url'], platform=c['platform'], name=c['name'], decision='held', why=why, slug=''))
            continue
        if cu in owners:
            key, src = owners[cu]
            counts['duplicate'] += 1
            decisions.append(dict(url=c['url'], platform=c['platform'], name=c['name'], decision='duplicate', why=f'page belongs to {key} ({src})', slug=''))
            continue
        ready.append(c)

    ready.sort(key=lambda c: (bs.rank_of(c['platform']), c['checked'], c['url']))
    for c in ready:
        d = dict(url=c['url'], platform=c['platform'], name=c['name'])
        v, p = verdict(c, others)
        if v == 'duplicate':
            counts['duplicate'] += 1
            decisions.append(dict(d, decision='duplicate', why=('our own stay: ' if p['src'] == 'own' else 'same place as ') + p['key'], slug=''))
            continue
        if v == 'held':
            counts['held'] += 1
            held_why['possible duplicate'] = held_why.get('possible duplicate', 0) + 1
            decisions.append(dict(d, decision='held', why=f"possibly {p['key']} ({p['name'][:40]}, {int(bs.metres((c['lat_f'], c['lng_f']), p['ll']))} m): a near-miss name", slug=''))
            continue
        regpool = {r['slug']: dict(key=r['slug'], name=r['name'], ll=(float(r['lat']), float(r['lng'])), tok=of.tokens(r['name']), unit=of.unit(r['name']), src='registry')
                   for r in registry}
        v, p = verdict(c, regpool)
        if v == 'held':
            counts['held'] += 1
            held_why['possible duplicate'] = held_why.get('possible duplicate', 0) + 1
            decisions.append(dict(d, decision='held', why=f"possibly {p['key']} (a stay we auto-listed, {int(bs.metres((c['lat_f'], c['lng_f']), p['ll']))} m): a near-miss name", slug=''))
            continue
        if v == 'duplicate':   # the same property on another site: one stay, several links
            row = by_slug[p['key']]
            kind = attach(row, c['platform'], c['url'])
            reg_urls = bs.registry_urls(registry)
            if kind:
                counts['extra'] += 1
                decisions.append(dict(d, decision='extra_link', why=f"another site's page of {row['slug']}", slug=row['slug']))
            else:
                counts['held'] += 1
                held_why['same site, other page'] = held_why.get('same site, other page', 0) + 1
                decisions.append(dict(d, decision='held', why=f"{c['platform']} already has a page for {row['slug']}: a second page of one site is never a second stay", slug=''))
            continue
        # a new stay
        ltype = c['ltype']
        type_, word = bs.LTYPE_TYPE.get(ltype, ('', ''))
        slug = make_slug(c['dn'], c['locality'], c['city'], taken)
        if any(k in slug for k in bs.OWN_KEYS):
            counts['held'] += 1
            decisions.append(dict(d, decision='held', why='its slug would contain one of our own stays', slug=''))
            continue
        sig = ', '.join(s.strip() for s in c['signals'].split(',') if s.strip())
        row = dict(slug=slug, name=c['dn'], city=c['city'], lat=c['lat'], lng=c['lng'], type=type_, type_word=word, platform=c['platform'],
                   url=bs.clean_url(c['url'], c['platform']), extra_links='', state='listed', first_listed=today, checked=c['checked'],
                   seen_for=c['seen_for'], note=f"ld {ltype}; pin {c['lat_f']:.4f},{c['lng_f']:.4f}; name in slug; {sig}")
        registry.append(row)
        by_slug[slug] = row
        reg_urls = bs.registry_urls(registry)
        counts['listed'] += 1
        decisions.append(dict(d, decision='listed', why=f"new stay in {c['city']}: {row['note']}", slug=slug))
        if verbose:
            print(f"  listed {slug} <- {c['url']}")

    # ---- ota-links.tsv: every listed stay has its verified row (also heals a reverted file)
    ota_path = os.path.join(bs.HERE, 'ota-links.tsv')
    have = {r['key']: r for r in tsv_rows(ota_path)}
    todo = []
    for r in registry:
        if r['state'] != 'listed':
            continue
        h = have.get(r['slug'])
        if not (h and h.get('status') == 'verified' and h.get('ota') == r['platform'] and h.get('url') == r['url']):
            todo.append(r)

    # a page's decision is what the registry says now, so a re-run writes the same text (a swap makes the new primary `listed`)
    for d in decisions:
        slug = reg_urls.get(bs.canon_url(d['url']))
        if slug and d['decision'] in ('listed', 'extra_link'):
            row = by_slug[slug]
            primary = bs.canon_url(row['url']) == bs.canon_url(d['url'])
            d.update(decision='listed' if primary else 'extra_link', slug=slug,
                     why=f"new stay in {row['city']}: {row['note']}" if primary else f"another site's page of {slug}")
    decisions.sort(key=lambda d: (d['url'], d['decision']))
    summary = (f"import_new_stays: {counts['listed']} listed, {counts['extra']} extra links, {counts['held']} held"
               + (f" ({', '.join(f'{n} {w}' for w, n in sorted(held_why.items(), key=lambda t: (-t[1], t[0])))})" if held_why else '')
               + f", {counts['duplicate']} duplicates, {counts['out']} out of scope; registry {len(registry)}, ota rows to write {len(todo)}")
    if verbose:
        for d in decisions:
            if d['decision'] in ('held', 'duplicate'):
                print(f"  {d['decision']:9} {d['name'][:38]:38} {d['why'][:100]}")
    if dry:
        print(summary + ' (dry run: nothing written)')
        return

    changed = bs.save_registry(registry)
    if todo:
        tmp = tempfile.mkdtemp(prefix='rh-newstays-')
        try:
            f = os.path.join(tmp, 'rows.tsv')
            with open(f, 'w', encoding='utf8', newline='\n') as fh:
                for r in todo:
                    fh.write(f"{r['slug']}\tverified\t{r['platform']}\t{r['url']}\tBooking-found property: auto-listed (import_new_stays.py); {r['note']}\n")
            env = dict(os.environ, RH_OTA_LINKS=ota_path, PYTHONUTF8='1', PYTHONIOENCODING='utf-8')
            subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'merge_ota.py'), f], check=True, env=env,
                           stdout=subprocess.DEVNULL)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    dpath = os.path.join(bs.BL, 'new-properties-decisions.tsv')
    old = {(r.get('url'), r.get('decision'), r.get('why'), r.get('slug')): r.get('decided', '') for r in tsv_rows(dpath)}
    for d in decisions:
        d['decided'] = old.get((d['url'], d['decision'], d['why'], d['slug'])) or today
    with pu.Lock():
        wrote = bs.write_if_changed(dpath, bs.DECISION_COLS, decisions)
    print(summary + f" (registry {'written' if changed else 'unchanged'}, decisions {'written' if wrote else 'unchanged'})")


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    try:
        run(argv)
    except Exception as e:   # never stops a merge
        import traceback
        traceback.print_exc()
        print(f'import_new_stays: failed ({type(e).__name__}: {e}); nothing more was written')


if __name__ == '__main__':
    main()
