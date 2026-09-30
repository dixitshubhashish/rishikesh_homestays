// Google Analytics 4 (gtag.js), shared by every page. Each page includes it
// as the first thing after <meta charset>:
//   <script async src="/assets/js/analytics.js"></script>
// Change the measurement ID here, once, rather than in every HTML file.
// This is the site's only Google tag — don't also paste Google's gtag
// snippet (or a GTM container that fires GA4) into pages, or every page
// view gets counted twice.
const GA_MEASUREMENT_ID = 'G-L82BSZMRLW';

// Owner opt-out, remembered per browser: open any page with ?notrack=1 once
// to stop this browser from being tracked, ?notrack=0 to resume. Stored in
// localStorage, so clearing site data or a private window resets it.
const OPT_OUT_KEY = 'rh-analytics-opt-out';

function isOptedOut() {
  try {
    const flag = new URLSearchParams(window.location.search).get('notrack');
    if (flag === '1') localStorage.setItem(OPT_OUT_KEY, '1');
    if (flag === '0') localStorage.removeItem(OPT_OUT_KEY);
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

if (isOptedOut()) {
  // Google's official per-ID kill switch; also skip loading gtag.js at all.
  window['ga-disable-' + GA_MEASUREMENT_ID] = true;
} else {
  loadGoogleAnalytics();
}

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
