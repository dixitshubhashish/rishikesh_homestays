// Logo URLs for the OTA choice screen (stay-page.js), keyed by the exact
// platform name used in scripts/stays/ota-links.tsv's `ota` column (also
// stay.o[].n after build_pages.py's load_ota_links()).
//
// TODO(owner): fill these in with real hosted logo URLs (the owner hosts them
// on their own image host, not this repo — see CLAUDE.md "Image credits": we
// don't commit or hotlink OTA brand images). Until then every value here is
// '' and the button falls back to a plain text label with no image, which is
// a fully working, non-broken state (see otaLogo()/ no broken <img> tags).
export const OTA_LOGOS = {
  'Booking.com': '',
  'Agoda': '',
  'MakeMyTrip': '',
  'Goibibo': '',
  'Airbnb': '',
  'Trip.com': '',
  'OYO': '',
  'EaseMyTrip': '',
  'Hotels.com': '',
  'Expedia': '',
  'Trivago': '',
  'Hostelworld': '',
  'Cleartrip': ''
};

// Logo URL for a platform, or '' if none is set yet (graceful fallback: the
// caller renders a text-only button instead of an <img>).
export function otaLogo(platform) {
  return OTA_LOGOS[platform] || '';
}
