// Google AdSense, shared by every page. Each page includes it right after
// analytics.js:
//   <script async src="/assets/js/ads.js"></script>
// next to the verification tag <meta name="google-adsense-account" content="…">.
// The publisher ID lives here, once (also in /ads.txt). This site isn't AMP:
// AdSense hands out AMP snippets (amp-auto-ads, <amp-ad …>); don't paste
// those into pages, add the unit to UNITS below instead.
//
// Ads only run on the guide pages (AD_PAGES). Pages that sell stays
// (homepage, homestays, contact, our own listing, the hotels/ stays pages)
// stay ad-free, so ads for other hotels and booking sites never compete with ours.
const ADSENSE_CLIENT = 'ca-pub-7016219170450293';
const AD_PAGES = ['/about-rishikesh', '/places-to-visit', '/things-to-do-in-rishikesh', '/triveni-ghat', '/kedarnath-yatra', '/haridwar-kumbh-2027'];

// One entry per AdSense ad unit. Translating AdSense's AMP code:
//   data-ad-slot → slot;  data-auto-format="mcrspv" (Multiplex/grid) → format 'autorelaxed';
//   a display unit → format 'auto' (+ fullWidth: true for data-full-width);
//   an in-article unit → format 'fluid', layout 'in-article'.
// `place` says where it goes: 'before-footer', or 'after:<css selector>' (the
// first match, e.g. 'after:main section:nth-of-type(2)'). Units whose spot
// isn't on the page are skipped.
const UNITS = [
  // display (data-auto-format="rspv"): mid-article, after the 2nd section, once readers are into the page
  { name: 'display', slot: '2403902056', format: 'auto', fullWidth: true, place: 'after:main > section:nth-of-type(2)' },
  // Multiplex grid (data-auto-format="mcrspv"): after the content, just above the footer
  { name: 'grid', slot: '9264823876', format: 'autorelaxed', place: 'before-footer' },
];

function unitHtml(u) {
  const attrs = [`class="adsbygoogle"`, `style="display:block${u.layout === 'in-article' ? ';text-align:center' : ''}"`,
    `data-ad-client="${ADSENSE_CLIENT}"`, `data-ad-slot="${u.slot}"`, `data-ad-format="${u.format}"`];
  if (u.layout) attrs.push(`data-ad-layout="${u.layout}"`);
  if (u.fullWidth) attrs.push('data-full-width-responsive="true"');
  return `<p class="rh-ad-label">Advertisement</p><ins ${attrs.join(' ')}></ins>`;
}

function placeUnits() {
  for (const u of UNITS) {
    const anchor = u.place === 'before-footer' ? document.querySelector('footer.rhs-footer')
      : document.querySelector(u.place.replace(/^after:/, ''));
    if (!anchor) continue;
    const wrap = document.createElement('section');
    wrap.className = `rh-ad rh-ad-${u.name}`;
    wrap.setAttribute('aria-label', 'Advertisement');
    wrap.innerHTML = unitHtml(u);
    if (u.place === 'before-footer') anchor.before(wrap); else anchor.after(wrap);
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
}

(function loadAds() {
  const path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  if (!AD_PAGES.includes(path)) return;
  // Not on local dev (keeps tests and previews clean), and not for the owner's
  // own browsers (the GA opt-out in analytics.js): never view or click your own ads.
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) return;
  try { if (localStorage.getItem('rh-analytics-opt-out') === '1') return; } catch { /* storage blocked: still show ads */ }
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(s);
  // this script loads async from <head>: wait for the page before placing units
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', placeUnits);
  else placeUnits();
})();
