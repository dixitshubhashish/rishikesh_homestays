#!/usr/bin/env python3
"""Found booking links, organised by property (owner, 2026-10-06).

Reads docs/booking-links/found.tsv (what the search found), scripts/stays/ota-links.tsv (the directory stays'
links on the site) and scripts/stays/.cache/places/ota-links.tsv (Google Maps stays), and writes the computed,
deduped result into the local DB (scripts/stays/.cache/stays.db, db.py): the originals are never touched, nothing
goes to BigQuery. Rebuilt in full (DELETE + INSERT) every run.

  found_properties   one row per property
      slug              our own: the property's current name, lower case, letters, digits and hyphens only
      key               the key the lists and the site use (a directory slug, or g-<Google place id>)
      google_place_id   ChIJ... for Google Maps stays (the g- key without its prefix): kept for later joins
      listing_id        the site's permanent numeric id, when the stay is listed
      name, name_at_search, city, area, lat, lng, maps_url
      primary_ota, primary_url   the best link: the first OTA of scripts/stays/ota-priority.tsv that has one
      urls_json         JSON {ota: url}, one entry per booking site this property has (Booking.com first); a
                        new verified link goes into its site's entry
      sources           which list each link came from
  found_links        one row per link with everything the lists hold
      key, slug, ota, rank, url, status, note, checked, source_file

Readers use linked_properties() / links_rows() (the narrow shapes found-by-property.tsv's and found-links.tsv's
actual consumers read), or properties_rows() for the whole found_properties table.

Close duplicates are merged (owner, 2026-10-06): two rows are one property when they share a booking-site page, or
sit within 40 m of each other with the same core name. The survivor is the stay the site lists, else the one with the
shortest readable name; a different size in the name (1BHK / 2BHK / studio) always keeps two rows apart; it learns what the others knew (Google place id, listing id, coordinates, any booking-site
link it lacked) and keeps the other keys in `alias_keys` and any different link of the same site in `other_urls`.
found_duplicates lists what was merged into what.

No phone numbers (those stay in BigQuery places_lodging, internal only). Usage: python3 scripts/stays/organise_found.py
"""
import csv
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import db as stays_db  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
BL = os.path.join(ROOT, 'docs', 'booking-links')


def tsv(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding='utf8', newline='') as f:
        return list(csv.DictReader(f, delimiter='\t', quoting=csv.QUOTE_NONE))


def slugify(name):
    """Letters, digits and single hyphens: accents folded, & -> and, apostrophes dropped, brackets etc. -> hyphen."""
    s = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    s = s.lower().replace('&', ' and ')
    s = re.sub(r"[’']", '', s)
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def name_from_key(key):
    """Last resort for a stay with no name anywhere: its key without the random 5-character tail the old
    slug maker added ("luxury-3-bedroom-s-apartment-nbu8e" -> "luxury-3-bedroom-s-apartment")."""
    base = re.sub(r'^g-', '', key)
    tail = base.rsplit('-', 1)[-1]
    if len(tail) == 5 and re.fullmatch(r'[a-z0-9_]+', tail) and re.search(r'[\d_]', tail):
        base = base[: -len(tail) - 1]
    return base.replace('-', ' ')


def stays_index():
    """key -> {n, a, ll, lid, cy} of the stays on the site (current names)."""
    out = {}
    for fn in ('stays-index-data.js', 'stays-index-data-haridwar.js'):
        p = os.path.join(ROOT, 'assets', 'js', 'modules', fn)
        if not os.path.exists(p):
            continue
        m = re.search(r'export const STAYS_INDEX = (\[.*?\]);\n', open(p, encoding='utf8').read(), re.S)
        for s in json.loads(m.group(1)):
            out[s['id']] = s
    return out


GENERIC = {'hotel', 'guest', 'house', 'homestay', 'homestays', 'resort', 'the', 'and', 'by', 'in', 'near', 'a', 'of', 'at', 'rishikesh',
           'haridwar', 'rooms', 'room', 'lodge', 'stay', 'stays', 'villa', 'apartment', 'apartments', 'with', 'for'}
tokens = lambda n: {t for t in re.findall(r'[a-z0-9]+', unicodedata.normalize('NFKD', n).encode('ascii', 'ignore').decode().lower()) if t not in GENERIC}
NUM = {'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6', 'seven': '7'}
def unit(name):
    """1BHK / 2 bedroom / studio: a different size is a different place, whatever else the names share."""
    n = name.lower().replace('\u2013', '-')
    sig = {f'{m.group(1)}bhk' for m in re.finditer(r'(\d+)\s*-?\s*bhk', n)}
    sig |= {f"{NUM.get(m.group(1), m.group(1))}bhk" for m in re.finditer(r'\b(\d+|one|two|three|four|five|six|seven)[\s-]*bed\s?rooms?\b', n)}
    if re.search(r'\bstudio\b', n):
        sig.add('studio')
    return frozenset(sig)


def same_name(a, b):
    """Core names that read as one property: the same words (60% overlap), and the same numbers ("Army House 2" is not
    "Army House 4")."""
    if {t for t in a if t.isdigit()} != {t for t in b if t.isdigit()}:
        return False
    return (a == b) if not (a and b) else len(a & b) / len(a | b) >= 0.6


def processed_stays():
    """key -> {n, a, ll} from the crawl's processed data (it still has stays the site no longer lists)."""
    out = {}
    for path in (os.path.join(HERE, '.cache', 'stays.json'), os.path.join(HERE, '.cache', 'haridwar', 'stays.json')):
        if os.path.exists(path):
            for s in json.load(open(path, encoding='utf8')):
                out.setdefault(s['id'], s)
    return out


def main():
    ota_rows = tsv(os.path.join(HERE, 'ota-priority.tsv'))
    rank = {r['ota']: int(r['rank']) for r in ota_rows}
    otas = [r['ota'] for r in sorted(ota_rows, key=lambda r: int(r['rank']))]

    # every verified link, with the list it came from (found.tsv first: it is the newest)
    links = {}  # (key, ota) -> row
    for src, rows in (('found.tsv', tsv(os.path.join(BL, 'found.tsv'))),
                      ('ota-links.tsv', [dict(r, platform=r.get('ota', '')) for r in tsv(os.path.join(HERE, 'ota-links.tsv'))]),
                      ('places/ota-links.tsv', [dict(r, platform=r.get('ota', '')) for r in tsv(os.path.join(HERE, '.cache', 'places', 'ota-links.tsv'))])):
        for r in rows:
            if r.get('status') != 'verified' or r.get('platform') not in rank or not r.get('url'):
                continue
            links.setdefault((r['key'], r['platform']), dict(r, source_file=src))

    index = stays_index()
    processed = processed_stays()
    places = {p['id']: p for p in json.load(open(os.path.join(HERE, '.cache', 'places', 'all-stays.json'), encoding='utf8'))} \
        if os.path.exists(os.path.join(HERE, '.cache', 'places', 'all-stays.json')) else {}
    found_names = {r['key']: r for r in tsv(os.path.join(BL, 'found.tsv'))}

    keys = sorted({k for k, _ in links})
    rows = []
    for key in keys:
        f = found_names.get(key, {})
        ix, pl, pr = index.get(key, {}), places.get(key, {}), processed.get(key, {})
        name = ix.get('n') or pl.get('n') or pr.get('n') or f.get('name', '') or name_from_key(key)
        city = ix.get('cy') or pl.get('cy') or f.get('city', '') or ('haridwar' if 'haridwar' in pr.get('ad', '').lower() else 'rishikesh' if pr else '')
        rows.append(dict(key=key, f=f, ix=ix, pl=pl, pr=pr, name=name, city=city, area=ix.get('a', '') or pr.get('a', ''), base=slugify(name)))

    # ---- close duplicates -------------------------------------------------------------------------------------
    for r in rows:
        r['unit'] = unit(r['name'])
    for r in rows:
        r['links'] = {o: links[(r['key'], o)] for o in otas if (r['key'], o) in links}
        ll = r['ix'].get('ll') or r['pl'].get('ll') or r['pr'].get('ll')
        r['ll'] = ll if ll and ll[0] not in ('', None) else None
        r['tok'] = tokens(r['name'])
    parent = list(range(len(rows)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    def union(a, b, why):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra
            why_of[(a, b)] = why
    why_of = {}
    seen_url = {}
    for i, r in enumerate(rows):
        for o, l in r['links'].items():
            u = re.sub(r'/+$', '', l['url'].split('?')[0]).lower()
            if u in seen_url and rows[seen_url[u]]['unit'] == r['unit']:
                union(seen_url[u], i, 'same booking page')
            elif u in seen_url:
                pass  # same page but a different size (1BHK / 2BHK): kept apart
            else:
                seen_url[u] = i
    order = sorted((i for i, r in enumerate(rows) if r['ll']), key=lambda i: rows[i]['ll'][0])
    for x, i in enumerate(order):
        a = rows[i]
        for j in order[x + 1:]:
            b = rows[j]
            if b['ll'][0] - a['ll'][0] > 0.0004:
                break
            dlat = (b['ll'][0] - a['ll'][0]) * 111320
            dlng = (b['ll'][1] - a['ll'][1]) * 111320 * 0.87
            if (dlat ** 2 + dlng ** 2) ** 0.5 > 40 or a['city'] != b['city']:
                continue
            if same_name(a['tok'], b['tok']) and a['unit'] == b['unit']:
                union(i, j, 'within 40 m, same name')
    clusters = {}
    for i in range(len(rows)):
        clusters.setdefault(find(i), []).append(i)
    quality = lambda r: (0 if r['ix'].get('lid') or r['ix'] else 1, len(r['base']), r['key'])  # the site's own stay, then the shortest name
    survivors, dup_rows = [], []
    for members in clusters.values():
        group = sorted((rows[i] for i in members), key=quality)
        keep, rest = group[0], group[1:]
        keep['alias_keys'] = [r['key'] for r in rest]
        keep['other_urls'] = []
        for r in rest:
            # teach the survivor what the duplicate knew
            for fld in ('area', 'city'):
                keep[fld] = keep[fld] or r[fld]
            keep['ll'] = keep['ll'] or r['ll']
            for k2 in ('ix', 'pl', 'pr'):
                for fld, val in r[k2].items():
                    keep[k2].setdefault(fld, val)
            if not keep['f'] and r['f']:
                keep['f'] = r['f']
            for o, l in r['links'].items():
                if o not in keep['links']:
                    keep['links'][o] = l
                elif keep['links'][o]['url'].split('?')[0].rstrip('/').lower() != l['url'].split('?')[0].rstrip('/').lower():
                    keep['other_urls'].append(f"{o}:{l['url']}")
            dup_rows.append((keep, r))
        survivors.append(keep)
    rows = survivors
    print(f'duplicates merged: {len(dup_rows)} rows into {len(survivors)} properties')

    # slugs: the name alone; a name shared by several properties adds the area, then the city, and only if
    # that still collides a number (owner, 2026-10-06: no random suffixes unless nothing else tells them apart)
    taken, by_base = {}, {}
    for r in rows:
        by_base.setdefault(r['base'], []).append(r)
    for base, group in by_base.items():
        if len(group) == 1:
            group[0]['slug'] = base
            continue
        levels = [lambda r: base, lambda r: '-'.join(x for x in (base, slugify(r['area'])) if x),
                  lambda r: '-'.join(x for x in (base, slugify(r['area']), r['city']) if x),
                  lambda r: '-'.join(x for x in (base, r['city']) if x)]
        for lv in levels:
            if len({lv(r) for r in group}) == len(group):
                for r in group:
                    r['slug'] = lv(r)
                break
        else:  # still the same: area + city, numbered
            seen = {}
            for r in group:
                one = levels[2](r)
                seen[one] = seen.get(one, 0) + 1
                r['slug'] = one if seen[one] == 1 else f'{one}-{seen[one]}'
    # a disambiguated slug can still equal another property's plain slug: number the later one
    for r in sorted(rows, key=lambda r: r['key']):
        slug, n = r['slug'], 2
        while slug in taken:
            slug = f"{r['slug']}-{n}"
            n += 1
        r['slug'] = slug
        taken[slug] = r['key']

    props = []
    for r in rows:
        key, f, ix, pl, pr = r['key'], r['f'], r['ix'], r['pl'], r['pr']
        ll = r['ll'] or ['', '']
        pid = key[2:] if key.startswith('g-') else next((a[2:] for a in r['alias_keys'] if a.startswith('g-')), '')
        mine = {o: r['links'][o] for o in otas if o in r['links']}  # booking-site priority order
        best = next(iter(mine), '')
        props.append(dict(
            slug=r['slug'], key=key, google_place_id=pid, listing_id=ix.get('lid', ''), name=r['name'],
            name_at_search=f.get('name', ''), city=r['city'], area=r['area'], lat=ll[0], lng=ll[1],
            maps_url=f'https://www.google.com/maps/place/?q=place_id:{pid}' if pid else '',
            primary_ota=best, primary_url=mine[best]['url'] if best else '',
            urls={o: mine[o]['url'] for o in mine},
            sources=';'.join(f'{o}:{mine[o]["source_file"]}' for o in mine),
            alias_keys=';'.join(r['alias_keys']), other_urls=' | '.join(r['other_urls'])))

    slug_of = {p['key']: p['slug'] for p in props}
    for p in props:  # a merged duplicate's links belong to the survivor's slug
        for a in filter(None, p['alias_keys'].split(';')):
            slug_of[a] = p['slug']
    dup_out = [dict(merged_key=r['key'], kept_slug=slug_of[keep['key']], kept_key=keep['key'], merged_name=r['name'], merged_slug_would_be=r['base'])
               for keep, r in sorted(dup_rows, key=lambda kr: (slug_of[kr[0]['key']], kr[1]['key']))]
    link_out = []
    for (key, ota), r in sorted(links.items(), key=lambda kv: (slug_of[kv[0][0]], rank[kv[0][1]])):
        link_out.append(dict(key=key, slug=slug_of[key], ota=ota, rank=rank[ota], url=r['url'], status=r['status'],
                              note=r.get('note', ''), checked=r.get('checked', ''), source_file=r['source_file']))

    # found_properties / found_links / found_duplicates are a cache of this computation (replaces
    # found-by-property.tsv / found-links.tsv / found-duplicates.tsv): rebuilt in full every run.
    # Every value is stringified first (same str(v) the old TSV write used): SQLite's own REAL -> TEXT affinity
    # conversion does not always match Python's float repr (a 17-digit tail where Python prints the shortest
    # round-trip form), so passing a float straight through would quietly reformat lat/lng.
    conn = stays_db.get_db()
    with conn:
        conn.execute('DELETE FROM found_properties')
        conn.execute('DELETE FROM found_links')
        conn.execute('DELETE FROM found_duplicates')
        conn.executemany(
            """INSERT INTO found_properties (slug, key, google_place_id, listing_id, name, name_at_search, city, area,
                   lat, lng, maps_url, primary_ota, primary_url, urls_json, sources, alias_keys, other_urls)
               VALUES (:slug, :key, :google_place_id, :listing_id, :name, :name_at_search, :city, :area,
                   :lat, :lng, :maps_url, :primary_ota, :primary_url, :urls_json, :sources, :alias_keys, :other_urls)""",
            [{**{k: ('' if v is None else str(v)) for k, v in p.items() if k != 'urls'},
              'urls_json': json.dumps(p['urls'], ensure_ascii=False)} for p in props])
        conn.executemany(
            """INSERT INTO found_links (key, slug, ota, rank, url, status, note, checked, source_file)
               VALUES (:key, :slug, :ota, :rank, :url, :status, :note, :checked, :source_file)""", link_out)
        conn.executemany(
            """INSERT INTO found_duplicates (merged_key, kept_slug, kept_key, merged_name, merged_slug_would_be)
               VALUES (:merged_key, :kept_slug, :kept_key, :merged_name, :merged_slug_would_be)""", dup_out)
    by = {}
    for p in props:
        by[p['primary_ota']] = by.get(p['primary_ota'], 0) + 1
    print(f'found_properties: {len(props)} properties, {len(link_out)} links; primary link by site: {by}')


def properties_rows():
    """found_properties, one dict per row (found-by-property.tsv's old shape, plus urls as a dict instead of
    per-ota columns): for a reader that wants the whole computed table (none currently do; organise_found.py's
    own readers use linked_properties()/links_rows() below, the narrower shapes they actually need)."""
    rows = [dict(r) for r in stays_db.get_db().execute('SELECT * FROM found_properties').fetchall()]
    for r in rows:
        r['urls'] = json.loads(r.pop('urls_json') or '{}')
    return rows


def linked_properties():
    """key/alias_keys/lat/lng/name/city for every found_properties row -- what prune_unfound.py, map_seen_pages.py
    and booking_stays.taken_slugs() actually read (found-by-property.tsv's old consumers)."""
    return [dict(key=r['key'], slug=r['slug'], alias_keys=r['alias_keys'] or '', name=r['name'] or '',
                 city=r['city'] or '', lat=r['lat'] or '', lng=r['lng'] or '')
            for r in stays_db.get_db().execute('SELECT key, slug, alias_keys, name, city, lat, lng FROM found_properties').fetchall()]


def links_rows():
    """found_links, one dict per row (found-links.tsv's old shape: key, slug, ota, rank, url, status, note,
    checked, source_file)."""
    return [dict(r) for r in stays_db.get_db().execute(
        'SELECT key, slug, ota, rank, url, status, note, checked, source_file FROM found_links').fetchall()]


if __name__ == '__main__':
    main()
