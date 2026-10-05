"""Honest <lastmod> dates for sitemap.xml (owner, 2026-10-05).

A page's date moves only when what a reader sees on it changes, not every time
the pages are rebuilt: search engines learn to ignore a sitemap whose dates all
move together, and IndexNow (scripts/indexnow.mjs) pings only the pages whose
date moved. page-dates.tsv (committed) keeps, per URL path, a fingerprint of the
page's content and the date that fingerprint first appeared.

- Generated stays pages: build_pages.py fingerprints each page's <main>.
- Hand-made pages (index.html, the guides, ...): refresh_static() fingerprints
  the file without its <head>, its site header and the generated footer-stays
  block (a new stays page changes every footer, a theme or tag change every
  head and header: none of it is news about the page itself) and rewrites their
  <lastmod> in sitemap.xml, outside the generated sections.
- `python3 page_dates.py --reseed`: after changing what the fingerprint skips,
  store the new fingerprints but keep every date (a page whose content already
  changed under the old rule is left alone, so its next refresh still re-dates it).
"""
import datetime
import hashlib
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
REGISTRY = os.path.join(HERE, 'page-dates.tsv')
SITE = 'https://rishikeshhomestays.com'
TODAY = datetime.date.today().isoformat()


def load():
    out = {}
    if os.path.exists(REGISTRY):
        for line in open(REGISTRY, encoding='utf8').read().splitlines()[1:]:
            path, digest, date = (line.split('\t') + ['', ''])[:3]
            if path:
                out[path] = (digest, date)
    return out


def save(reg):
    tmp = f'{REGISTRY}.tmp-{os.getpid()}'
    with open(tmp, 'w', encoding='utf8') as fh:
        fh.write('path\tfingerprint\tlastmod\n')
        for path in sorted(reg):
            fh.write(f'{path}\t{reg[path][0]}\t{reg[path][1]}\n')
    os.replace(tmp, REGISTRY)


def fingerprint(content):
    # dates written into a page (JSON-LD dateModified) never count as a change
    content = re.sub(r'\d{4}-\d{2}-\d{2}', '', content)
    return hashlib.sha1(content.encode('utf8')).hexdigest()[:16]


def date_for(reg, path, content, first_seen=TODAY):
    """The page's lastmod: unchanged content keeps its date; new or changed content gets today.
    first_seen: the date to give a page the registry has not seen before."""
    digest = fingerprint(content)
    old = reg.get(path)
    if old and old[0] == digest:
        return old[1]
    reg[path] = (digest, TODAY if old else first_seen)
    return reg[path][1]


def git_date(file):
    """Last commit date of a file (YYYY-MM-DD), or None."""
    try:
        out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', file], cwd=ROOT,
                             capture_output=True, text=True, check=False).stdout.strip()
        return out or None
    except OSError:
        return None


def static_content(page):
    """What a reader reads on a hand-made page: the file minus head, site header and footer-stays block."""
    page = re.sub(r'<!-- footer-stays -->.*?<!-- /footer-stays -->', '', page, flags=re.S)
    page = re.sub(r'<head>.*?</head>', '', page, count=1, flags=re.S)
    return re.sub(r'<header class="site-header">.*?</header>', '', page, count=1, flags=re.S)


def static_pages(sitemap):
    """(path, rel, loc match) of every hand-made page in sitemap.xml, outside the generated sections."""
    s = open(sitemap, encoding='utf8').read()
    generated = [(m.start(), m.end()) for m in re.finditer(r'<!-- stays-pages[a-z-]*:start -->.*?<!-- stays-pages[a-z-]*:end -->', s, re.S)]
    for m in re.finditer(r'<url>\s*<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>.*?</url>', s, flags=re.S):
        if any(a <= m.start() < b for a, b in generated):
            continue
        rel = m.group(1)[len(SITE):].strip('/') or 'index'
        if os.path.exists(os.path.join(ROOT, f'{rel}.html')):
            yield '/' + ('' if rel == 'index' else rel), rel, m


def reseed(sitemap=os.path.join(ROOT, 'sitemap.xml')):
    """Store fingerprints under the current static_content() rule, keeping every date.
    Only pages unchanged under the old rule (file minus footer-stays) are reseeded."""
    reg = load()
    for path, rel, _ in static_pages(sitemap):
        page = open(os.path.join(ROOT, f'{rel}.html'), encoding='utf8').read()
        old = fingerprint(re.sub(r'<!-- footer-stays -->.*?<!-- /footer-stays -->', '', page, flags=re.S))
        new = fingerprint(static_content(page))
        if path not in reg:
            continue
        if reg[path][0] == new:
            continue
        if reg[path][0] != old:
            print(f'reseed: {path} changed since its last refresh, left for the next refresh to re-date')
            continue
        reg[path] = (new, reg[path][1])
        print(f'reseed: {path} fingerprint updated, date kept ({reg[path][1]})')
    save(reg)


def refresh_static(sitemap=os.path.join(ROOT, 'sitemap.xml')):
    """Rewrite <lastmod> of the hand-made pages in sitemap.xml from their content fingerprints."""
    reg = load()
    s = open(sitemap, encoding='utf8').read()
    generated = [(m.start(), m.end()) for m in re.finditer(r'<!-- stays-pages[a-z-]*:start -->.*?<!-- stays-pages[a-z-]*:end -->', s, re.S)]

    def fix(m):
        if any(a <= m.start() < b for a, b in generated):
            return m.group(0)
        loc = m.group(1)
        rel = loc[len(SITE):].strip('/') or 'index'
        file = os.path.join(ROOT, f'{rel}.html')
        if not os.path.exists(file):
            return m.group(0)
        page = static_content(open(file, encoding='utf8').read())
        # a page seen for the first time keeps the later of its sitemap date and its last commit
        first = max(d for d in (m.group(2), git_date(f'{rel}.html')) if d)
        date = date_for(reg, '/' + ('' if rel == 'index' else rel), page, first)
        return m.group(0).replace(f'<lastmod>{m.group(2)}</lastmod>', f'<lastmod>{date}</lastmod>')

    out = re.sub(r'<url>\s*<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>.*?</url>', fix, s, flags=re.S)
    if out != s:
        open(sitemap, 'w', encoding='utf8').write(out)
    save(reg)


if __name__ == '__main__':
    import sys
    if '--reseed' in sys.argv:
        reseed()
    else:
        refresh_static()
