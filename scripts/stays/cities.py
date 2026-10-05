"""City config shared by the stays pipeline. Rishikesh is the default city
everywhere (scripts, pages, data, /stay links), so existing URLs and files
keep working; every other city is opt-in via --city <key>.

Rishikesh keeps its original cache at scripts/stays/.cache/ (legacy layout);
other cities cache under scripts/stays/.cache/<key>/.
"""
import os, sys

DEFAULT_CITY = 'rishikesh'
CITIES = {
    # center_landmark: the point (landmarks.tsv) a page's distance range measures from when the page has no place of its own
    'rishikesh': {'name': 'Rishikesh', 'directory': 'rishikesh-hotels-32481', 'center': (30.103, 78.297), 'center_landmark': 'triveni-ghat'},
    'haridwar': {'name': 'Haridwar', 'directory': 'haridwar-hotels-32456', 'center': (29.945, 78.164), 'center_landmark': 'har-ki-pauri'},
}
HERE = os.path.dirname(os.path.abspath(__file__))


def city_from_argv(argv=None):
    argv = sys.argv if argv is None else argv
    if '--city' in argv:
        key = argv[argv.index('--city') + 1].lower()
        if key not in CITIES:
            raise SystemExit(f'unknown city {key!r}; known: {", ".join(CITIES)}')
        return key
    return DEFAULT_CITY


def cache_dir(city):
    d = os.path.join(HERE, '.cache') if city == DEFAULT_CITY else os.path.join(HERE, '.cache', city)
    os.makedirs(d, exist_ok=True)
    return d


def listing_url(city):
    return f'https://www.uttarakhand-hotels.com/en/{CITIES[city]["directory"]}/all-accommodations/'
