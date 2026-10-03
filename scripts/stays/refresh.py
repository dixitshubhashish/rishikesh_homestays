"""Auto-refresh for the best-*-in-rishikesh pages, with a self-adjusting gap.

Usage: python3 scripts/stays/refresh.py [--force]

Meant to be run daily (see .github/workflows/stays-refresh.yml); it exits
immediately unless a run is due. When due, it fetches only the directory's
listing page and compares its property links with the last run's
(listing-urls.txt):
  - changed (new or removed properties) -> full crawl + process + rebuild
    the pages + BigQuery snapshot (push_bigquery.mjs), and reset the gap to MIN_DAYS;
  - unchanged -> skip the crawl and double the gap, up to MAX_DAYS.
State lives in refresh.state (committed, so CI and local runs share it).
--force runs the full refresh now regardless of the gap.
"""
import json, os, re, sys, gzip, datetime, subprocess, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, 'refresh.state')
URLS = os.path.join(HERE, 'listing-urls.txt')
LISTING = 'https://www.uttarakhand-hotels.com/en/rishikesh-hotels-32481/all-accommodations/'
MIN_DAYS, MAX_DAYS = 7, 56
today = datetime.date.today()


def load_state():
    try:
        return json.load(open(STATE))
    except FileNotFoundError:
        return {'last_check': None, 'last_crawl': None, 'gap_days': MIN_DAYS}


def save_state(st):
    st['next_due'] = (today + datetime.timedelta(days=st['gap_days'])).isoformat()
    json.dump(st, open(STATE, 'w'), indent=2)
    open(STATE, 'a').write('\n')


def listing_urls():
    req = urllib.request.Request(LISTING, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip'})
    with urllib.request.urlopen(req, timeout=60) as r:
        b = r.read()
        b = gzip.decompress(b) if r.headers.get('Content-Encoding') == 'gzip' else b
    html = b.decode('utf-8', 'replace')
    return sorted(set(re.findall(r'href="(https://[a-z0-9-]+\.uttarakhand-hotels\.com/en/)"', html)))


def run(step, *args):
    subprocess.run([sys.executable, os.path.join(HERE, step), *args], check=True)


def main():
    st = load_state()
    force = '--force' in sys.argv
    if not force and st.get('last_check'):
        due = datetime.date.fromisoformat(st['last_check']) + datetime.timedelta(days=st['gap_days'])
        if today < due:
            print(f'Not due: next check {due} (gap {st["gap_days"]} days).')
            return
    current = listing_urls()
    previous = open(URLS).read().split() if os.path.exists(URLS) else []
    added, removed = sorted(set(current) - set(previous)), sorted(set(previous) - set(current))
    st['last_check'] = today.isoformat()
    if previous and not added and not removed and not force:
        st['gap_days'] = min(st['gap_days'] * 2, MAX_DAYS)
        save_state(st)
        print(f'No new or removed properties ({len(current)}). Next check in {st["gap_days"]} days.')
        return
    print(f'{len(added)} new, {len(removed)} removed ({len(current)} total). Re-crawling.')
    run('crawl.py', '--fresh')
    run('process.py')
    # Match never-searched stays to Booking.com pages by slug (browser-checked),
    # then merge only the confirmed matches.
    subprocess.run(['node', os.path.join(HERE, 'guess_booking_slugs.mjs'), '--workers', '8'], check=False)
    guesses = os.path.join(HERE, '.cache', 'slug-guesses.tsv')
    if os.path.exists(guesses):
        verified = os.path.join(HERE, '.cache', 'slug-guesses-verified.tsv')
        open(verified, 'w').write(''.join(l for l in open(guesses) if '\tverified\t' in l))
        run('merge_ota.py', verified)
    run('build_pages.py')
    # Snapshot into BigQuery (market_properties); skips itself without credentials.
    subprocess.run(['node', os.path.join(HERE, 'push_bigquery.mjs')], check=False)
    open(URLS, 'w').write('\n'.join(current) + '\n')
    st.update(last_crawl=today.isoformat(), gap_days=MIN_DAYS, last_added=len(added), last_removed=len(removed), total=len(current))
    save_state(st)
    print(f'Pages rebuilt. Next check in {MIN_DAYS} days.')


if __name__ == '__main__':
    main()
