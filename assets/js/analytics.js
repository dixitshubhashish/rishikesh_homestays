// Google Analytics 4 (gtag.js), shared by every page. Each page includes it
// as the first thing after <meta charset>:
//   <script async src="/assets/js/analytics.js"></script>
// Change the measurement ID here, once, rather than in every HTML file.
// This is the site's only Google tag — don't also paste Google's gtag
// snippet (or a GTM container that fires GA4) into pages, or every page
// view gets counted twice.
const GA_MEASUREMENT_ID = 'G-L82BSZMRLW';

// Owner-only opt-out, remembered per browser. Opening any page with
// ?baba=<owner phrase> once stops that browser from being tracked;
// ?baba=wapas resumes. Only the phrase's SHA-256 is stored here, so the
// phrase itself isn't in this public code; ask the site owner for it. Every
// other visitor is always tracked. Stored in localStorage, so clearing site
// data or using a private window resets it.
const OPT_OUT_KEY = 'rh-analytics-opt-out';
const OWNER_PHRASE_SHA256 = 'faec231c287dbb6271ab7d6b8980b089b033004ab7d4fa1866261efee0cb11a8';

async function sha256Hex(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function isOptedOut() {
  try {
    const phrase = new URLSearchParams(window.location.search).get('baba');
    if (phrase === 'wapas') localStorage.removeItem(OPT_OUT_KEY);
    else if (phrase && (await sha256Hex(phrase.trim().toLowerCase())) === OWNER_PHRASE_SHA256) {
      localStorage.setItem(OPT_OUT_KEY, '1');
    }
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

isOptedOut().then((optedOut) => {
  if (optedOut) {
    // Google's official per-ID kill switch; also skip loading gtag.js at all.
    window['ga-disable-' + GA_MEASUREMENT_ID] = true;
  } else {
    loadGoogleAnalytics();
  }
});

function loadGoogleAnalytics() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);

  const tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
  document.head.appendChild(tag);
}
