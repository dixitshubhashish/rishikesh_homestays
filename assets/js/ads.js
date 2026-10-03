// Google AdSense, shared by every page. Each page includes it right after
// analytics.js (generated stays pages get it from thanks.html's head):
//   <script async src="/assets/js/ads.js"></script>
// next to the verification tag <meta name="google-adsense-account" content="…">.
// The publisher ID lives here, once (also in /ads.txt). This site isn't AMP:
// AdSense hands out AMP snippets (amp-auto-ads, <amp-ad …>); don't paste
// those into pages, add the unit to UNITS below instead.
//
// What each kind of page gets (never more than 4 ads on a wide screen, 2 on a phone):
//   guide pages      side rails + one mid-article display + grid above the footer
//   homepage         side rails + grid above the footer (nothing between its sections)
//   stays lists      side rails + grid above the footer (hotels/best-*, landmark pages)
//   everything else  no ads: the stay page, contact, homestays, our own listing,
//                    list-your-homestay, thanks and 404 are where guests enquire or book.
// The top of every page stays ad-free: side rails only appear once the
// visitor has scrolled past the first screen, only when the window is wide
// enough for them to sit in the empty margins beside the 1180px content
// (≥ 1580px), and they hide again over the footer.
const ADSENSE_CLIENT = 'ca-pub-7016219170450293';
const GUIDES = ['/about-rishikesh', '/places-to-visit', '/things-to-do-in-rishikesh', '/triveni-ghat', '/kedarnath-yatra', '/haridwar-kumbh-2027', '/driving-from-delhi-to-rishikesh'];
function pageType(path) {
  if (GUIDES.includes(path)) return 'guide';
  if (path === '') return 'home';
  if (/^\/hotels\/best-/.test(path)) return 'stays';
  return null;
}
const PLAN = { guide: ['rails', 'display', 'grid'], home: ['rails', 'grid'], stays: ['rails', 'grid'] };

// AdSense units. Translating AdSense's AMP code: data-ad-slot → slot;
// data-auto-format="mcrspv" (Multiplex/grid) → format 'autorelaxed';
// "rspv" (display) → format 'auto' (+ fullWidth for data-full-width).
const UNITS = {
  display: { slot: '2403902056', format: 'auto', fullWidth: true }, // responsive display
  grid: { slot: '9264823876', format: 'autorelaxed' }, // Multiplex
  rail: { slot: '2403902056' }, // the display unit at a fixed tall size; swap for a vertical unit's slot if one is made
};
const CONTENT = 1180; // --max in styles.css

const ins = (u, style = 'display:block') => `<ins class="adsbygoogle" style="${style}" data-ad-client="${ADSENSE_CLIENT}" data-ad-slot="${u.slot}"`
  + `${u.format ? ` data-ad-format="${u.format}"` : ''}${u.fullWidth ? ' data-full-width-responsive="true"' : ''}></ins>`;
const push = () => (window.adsbygoogle = window.adsbygoogle || []).push({});
function block(name, html) {
  const wrap = document.createElement('section');
  wrap.className = `rh-ad rh-ad-${name}`;
  wrap.setAttribute('aria-label', 'Advertisement');
  wrap.innerHTML = `<p class="rh-ad-label">Advertisement</p>${html}`;
  return wrap;
}

const PLACE = {
  // mid-article, after the 2nd section, once readers are into the page
  display() {
    const anchor = document.querySelector('main > section:nth-of-type(2)');
    if (!anchor) return;
    anchor.after(block('display', ins(UNITS.display))); push();
  },
  // after all the content, just above the footer
  grid() {
    const footer = document.querySelector('footer.rhs-footer');
    if (!footer) return;
    footer.before(block('grid', ins(UNITS.grid))); push();
  },
  // tall ads fixed in the empty side margins, wide screens only
  rails() {
    const gutter = (window.innerWidth - CONTENT) / 2;
    const width = gutter >= 340 ? 300 : gutter >= 200 ? 160 : 0;
    if (!width) return;
    const rails = ['left', 'right'].map((side) => {
      const r = block(`rail rh-ad-rail-${side} rh-ad-rail-hidden`, ins(UNITS.rail, `display:inline-block;width:${width}px;height:600px`));
      r.style.setProperty('--rail-w', `${width}px`);
      document.body.append(r); push();
      return r;
    });
    // shown only between the first screen and the footer
    const footer = document.querySelector('footer.rhs-footer');
    let footerInView = false;
    const update = () => {
      const show = window.scrollY > window.innerHeight * 0.8 && !footerInView;
      rails.forEach((r) => r.classList.toggle('rh-ad-rail-hidden', !show));
    };
    if (footer && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { footerInView = e.isIntersecting; update(); }).observe(footer);
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  },
};

(function loadAds() {
  const type = pageType(window.location.pathname.replace(/\.html$/, '').replace(/\/$/, ''));
  if (!type) return;
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
  const place = () => PLAN[type].forEach((p) => PLACE[p]());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place);
  else place();
})();
