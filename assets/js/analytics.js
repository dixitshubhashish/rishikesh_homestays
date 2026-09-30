// Google Tag Manager loader, shared by every page. Each page includes it as
// the first thing after <meta charset>:
//   <script async src="/assets/js/analytics.js"></script>
// Change the container ID here, once, rather than in every HTML file.
// GA4 and any other tags (conversions, pixels) are configured inside GTM
// itself — no further code changes needed to add them.
//
// Google's snippet also has a <noscript> iframe for JS-disabled visitors;
// it's intentionally omitted — it can't live in a shared JS file, and GA4
// records nothing without JavaScript anyway.
const GTM_ID = 'GTM-M4KQ9TNN';

(function (w, d, s, l, i) {
  w[l] = w[l] || [];
  w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  const f = d.getElementsByTagName(s)[0];
  const j = d.createElement(s);
  const dl = l !== 'dataLayer' ? '&l=' + l : '';
  j.async = true;
  j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
  f.parentNode.insertBefore(j, f);
})(window, document, 'script', 'dataLayer', GTM_ID);
