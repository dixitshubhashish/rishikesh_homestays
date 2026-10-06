// Google AdSense, shared by every page. Each page includes it right after
// analytics.js (generated stays pages get it from thanks.html's head):
//   <script async src="/assets/js/ads.js"></script>
// next to the verification tag <meta name="google-adsense-account" content="…">.
// The publisher ID lives here, once (also in /ads.txt). This site isn't AMP:
// AdSense hands out AMP snippets (amp-auto-ads, <amp-ad …>); don't paste
// those into pages, add the unit to UNITS below instead.
//
// The owner's rule (2026-10-05), above everything else: no ad in the first screen at any width, and
// never one that blocks or slows the reader: not between a heading and its content, not inside a form,
// not beside a call-to-action (Book / Enquire / WhatsApp / View property / Submit), no sticky ad over
// content on phones, no layout shift. Never more than 3 ads on screen at once at any width; in-content ads
// (in-article, display, in-feed) keep at least one screen height apart, and one that can't is dropped.
// Every placement checks it starts below the first screen (belowFold); the grid needs the footer to be
// at least 1.5 screens down. Nothing is re-placed on resize or re-render, so ads never refresh.
//
// What each kind of page gets:
//   homepage     nothing above "Plan beyond the room": an in-feed card in the middle of that section's second row of guide cards
//                (<div class="rh-ad-slot" data-ad="infeed">), the Multiplex grid above the footer, and on
//                ≥ 1580×900 windows side rails shown only once that section reaches the top, and only when
//                there's at least half a screen of scrolling before the grid (not the case today: no rails).
//   guide pages  in-article ads at the page's own anchors (<div class="rh-ad-slot" data-ad="article"
//                [data-min-width="N"]>, placed by hand where the copy has a natural break); an in-feed card
//                in the first card list of 5+ cards (not one marked data-no-ad) at a row boundary, a second
//                one in lists of 12+ (places-to-visit); a sticky 300×600 under the side panel at 1381–1579px;
//                the grid; side rails at ≥ 1580×900.
//   stays lists  (category, search-phrase and landmark pages in hotels/) one in-article ad after the lists at
//                the page's <div class="rh-ad-slot" data-ad="display"> (before the tips and FAQs); a sticky
//                ad under the filters from 901px wide; one text in-feed between two groups of stays (never
//                between rows, never right after the first group: from the third group on, two screens down)
//                only when nothing sits beside the list (no sidebar ad, no rails); the grid;
//                landmark pages (no sidebar) get the left rail only at ≥ 1580×900.
//   lead pages   at most one ad, well below the main action: the grid above the footer on /homestays (only
//                ≥ 1381px, where the form sits beside the cards); the rental page's in-article anchor before its FAQ.
//   no ads       /hotels/stay and our own listing (no rival hotels under our booking buttons), contact,
//                list-your-homestay, thanks and 404: that's where guests book and enquire.
// Fixed rails sit in the empty margins beside the 1180px content (≥ 1580px wide and ≥ 900px tall, so they
// never run under the WhatsApp button), never with a sidebar ad, and hide over the grid/footer, while in-content
// ads in view would make more than 3 on screen, while the WhatsApp drawer is open (body.whatsapp-drawer-open),
// and (right rail) wherever it would cover the WhatsApp hint bubble.
const ADSENSE_CLIENT = 'ca-pub-7016219170450293';
const GUIDES = ['/about-rishikesh', '/places-to-visit', '/things-to-do-in-rishikesh', '/triveni-ghat', '/kedarnath-yatra', '/haridwar-kumbh-2027', '/driving-from-delhi-to-rishikesh'];
// lead pages and the one unit each may get; contact, list-your-homestay, thanks and 404 are deliberately absent
// /hotels/stay and our own listing get none (owner, 2026-10-06: no rival hotels under our booking buttons)
const LEAD = {
  '/homestays': 'grid',
  '/bike-and-taxi-rental-in-rishikesh': 'article',
};
function pageType(path) {
  if (GUIDES.includes(path)) return 'guide';
  if (path === '') return 'home';
  if (path in LEAD) return 'lead';
  // stays lists: best-*, landmark and search-phrase pages; not the stay page or our own listing
  if (/^\/hotels\/(?!stay$)(?!advaitam-)[a-z0-9-]+$/.test(path)) return 'stays';
  return null;
}
const PATH = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
const PLAN = {
  home: ['slots', 'grid', 'rails'], // grid before rails, so the rails can watch it
  guide: ['feed', 'slots', 'sidebar', 'grid', 'rails'],
  stays: ['side', 'slots', 'feed', 'grid', 'rails'],
  lead: ['lead'],
};

// AdSense units. Translating AdSense's AMP code: data-ad-slot → slot;
// data-auto-format="mcrspv" (Multiplex/grid) → format 'autorelaxed';
// "rspv" (display) → format 'auto' (+ fullWidth for data-full-width).
// In-feed and in-article units are 'fluid' with the layoutKey / layout their AdSense code gives.
// label/h: only for the local preview boxes (see PREVIEW).
const UNITS = {
  display: { slot: '2403902056', format: 'auto', fullWidth: true, label: 'Display', h: 250 }, // responsive display ("display_ads")
  grid: { slot: '9264823876', format: 'autorelaxed', label: 'Multiplex (grid of related ads)', h: 320 },
  rail: { slot: '2403902056', label: 'Side rail' }, // the display unit at a fixed tall size; swap for a vertical unit's slot if one is made
  sidebar: { slot: '2403902056', label: 'Sidebar (sticky)' }, // the display unit at a fixed size, in a sidebar column
  inArticle: { slot: '2212330362', format: 'fluid', layout: 'in-article', label: 'In-article', h: 250 },
  infeedPhoto: { slot: '8371553765', format: 'fluid', layoutKey: '-5j+bz-w-4c+q5', label: 'In-feed (photo cards)', h: 260 },
  infeedText: { slot: '4838493701', format: 'fluid', layoutKey: '-5f+c0-2d-6n+10l', label: 'In-feed (text cards)', h: 200 },
};
// On localhost every unit shows as a labelled box where it would go, and nothing loads from Google
// (owner, 2026-10-05: see where the ads sit). Automated browsers (tests) get no ads at all, unless the
// URL asks for the preview with ?adpreview=1 (tests that check where the ads go).
const PREVIEW = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
const FORCE_PREVIEW = PREVIEW && /[?&]adpreview=1\b/.test(window.location.search);
const FEED_AFTER = 4; // guide in-feed: lists of 5+ cards, never before the 4th card
const CONTENT = 1180; // --max in styles.css

const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
const belowFold = (el) => docTop(el) > window.innerHeight; // the first-screen rule
// In-content ads (in-article, display, in-feed) keep at least one screen height of page between them, so
// two of them are never on screen together; one that can't is dropped. AdSense units are 0px tall until
// they load, so an ad counts as at least MIN_AD_H tall.
const MIN_AD_H = 280;
const IN_CONTENT = '.rh-ad-article, .rh-ad-display, .rh-ad-infeed, .rh-ad-sxfeed';
const spaced = (top, h = MIN_AD_H) => [...document.querySelectorAll(IN_CONTENT)].every((a) => {
  const at = docTop(a);
  const ah = Math.max(a.offsetHeight, MIN_AD_H);
  return top >= at + ah + window.innerHeight || top + h + window.innerHeight <= at;
});
const RAILS_OK = () => window.innerWidth >= 1580 && window.innerHeight >= 900;

const ins = (u, style = u.layout === 'in-article' ? 'display:block;text-align:center' : 'display:block') => (PREVIEW
  ? `<div class="rh-ad-preview" style="${style};min-height:${u.h || 250}px">Ad area: ${u.label}<small>slot ${u.slot}</small></div>`
  : `<ins class="adsbygoogle" style="${style}" data-ad-client="${ADSENSE_CLIENT}" data-ad-slot="${u.slot}"`
  + `${u.format ? ` data-ad-format="${u.format}"` : ''}${u.layout ? ` data-ad-layout="${u.layout}"` : ''}`
  + `${u.layoutKey ? ` data-ad-layout-key="${u.layoutKey}"` : ''}${u.fullWidth ? ' data-full-width-responsive="true"' : ''}></ins>`);
const push = () => { if (!PREVIEW) (window.adsbygoogle = window.adsbygoogle || []).push({}); };
function block(name, html) {
  const wrap = document.createElement('section');
  wrap.className = `rh-ad rh-ad-${name}`;
  wrap.setAttribute('aria-label', 'Advertisement');
  wrap.innerHTML = `<p class="rh-ad-label">Advertisement</p>${html}`;
  return wrap;
}

const PLACE = {
  // HTML anchors: <div class="rh-ad-slot" data-ad="display|article|infeed" [data-min-width="N"]>;
  // an anchor that isn't used stays invisible (CSS)
  slots() {
    document.querySelectorAll('.rh-ad-slot').forEach((s) => {
      const min = +s.dataset.minWidth || 0;
      if (window.innerWidth < min) return;
      s.style.display = 'block'; // anchors are display:none (no box to measure) until used
      const ok = belowFold(s) && spaced(docTop(s));
      s.style.display = '';
      if (!ok) return;
      const kind = s.dataset.ad;
      const b = kind === 'infeed' ? block('infeed info-card', ins(UNITS.infeedText))
        : block(kind === 'display' ? 'display' : 'article', ins(UNITS.inArticle));
      s.replaceWith(b); push();
    });
  },
  // guide pages: in-feed cards at a row boundary of the first list of 5+ cards
  feed() {
    if (pageType(PATH) === 'stays') return PLACE.sxfeed();
    const grid = [...document.querySelectorAll('main .card-grid, main .info-grid, main .kumbh-plan-grid')]
      .find((g) => !g.hasAttribute('data-no-ad') && g.offsetParent && g.querySelectorAll(':scope > article').length > FEED_AFTER);
    if (!grid) return;
    const cards = [...grid.querySelectorAll(':scope > article')];
    const n = cards.length;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    let k = Math.max(FEED_AFTER, cols * 2);
    if (k >= n) k = (n + 1) % cols === 0 ? n : FEED_AFTER; // close the last row, else after card 4
    const unit = cards[0].querySelector('img, picture') ? UNITS.infeedPhoto : UNITS.infeedText;
    const put = (after) => {
      if (!belowFold(cards[after - 1]) || !spaced(docTop(cards[after - 1]) + cards[after - 1].offsetHeight)) return;
      cards[after - 1].after(block(`infeed ${cards[0].className.split(' ')[0]}`, ins(unit))); push();
    };
    put(k);
    const second = Math.max(cols * 5, k + 6); // places-to-visit: a second card about 5 rows on
    if (n >= 12 && second < n) put(second);
  },
  // stays: one text in-feed between two groups, only when nothing sits beside the list. Never right after
  // the first group (on phones its first rows are all a reader sees before it), and at least two screens
  // of stays above it.
  sxfeed() {
    if (document.querySelector('.rh-ad-side') || RAILS_OK()) return;
    const g = [...document.querySelectorAll('#sx-out > .sx-group')].slice(2)
      .find((s) => docTop(s) > window.innerHeight * 2 && spaced(docTop(s)));
    if (!g) return; // pages with one or two groups (top-10, Haridwar homestays): none
    g.before(block('sxfeed', ins(UNITS.infeedText))); push();
  },
  // stays: sticky ad under the filters (≥ 901px, the two-column layout)
  side() {
    const side = document.querySelector('.sx-side');
    const f = side?.querySelector('.sx-filters');
    const main = document.querySelector('.sx-main');
    if (!f || !main || window.innerWidth < 901) return;
    const tall = window.innerHeight >= 740;
    const h = tall ? 600 : 250;
    const w = tall ? (window.innerWidth >= 1280 ? 300 : 160) : Math.min(side.clientWidth, 300);
    // below the first screen, and only when the list is long enough to give it room
    if (f.getBoundingClientRect().bottom + window.scrollY < window.innerHeight) return;
    if (main.offsetHeight < f.offsetHeight + h + 600) return;
    side.classList.add('has-ad');
    side.append(block('side', ins(UNITS.sidebar, `display:inline-block;width:${w}px;height:${h}px`))); push();
  },
  // guides at 1381–1579px: sticky 300×600 in the right column under .side-panel
  sidebar() {
    if (window.innerWidth < 1381 || window.innerWidth >= 1580 || window.innerHeight < 740) return;
    const aside = document.querySelector('.guide-grid > aside.side-panel');
    const copy = document.querySelector('.guide-grid > .guide-copy');
    if (!aside || !copy || copy.offsetHeight < aside.offsetHeight + 1300) return;
    const col = document.createElement('div');
    col.className = 'rh-side-col';
    aside.before(col);
    const ad = block('sidebar', ins(UNITS.sidebar, 'display:inline-block;width:300px;height:600px'));
    col.append(aside, ad);
    if (!belowFold(ad)) { col.replaceWith(aside); return; } // first-screen rule
    push();
  },
  // after all the content, just above the footer
  grid() {
    const footer = document.querySelector('footer.rhs-footer');
    if (!footer || docTop(footer) < window.innerHeight * 1.5) return;
    footer.before(block('grid', ins(UNITS.grid))); push();
  },
  // tall ads fixed in the empty side margins, wide and tall windows only
  rails() {
    if (!RAILS_OK() || document.querySelector('.rh-ad-side, .rh-ad-sidebar')) return;
    const type = pageType(PATH);
    // homepage: only from "Plan beyond the room" (<section data-ad-start>); elsewhere past the first screen
    const start = type === 'home' ? document.querySelector('[data-ad-start]') : null;
    const grid = document.querySelector('.rh-ad-grid');
    // homepage: none when that section and the grid are so close that the rails would only
    // blink in for a moment between the two (the usual case today)
    if (type === 'home' && (!start
      || (grid && (docTop(grid) - window.innerHeight) - (docTop(start) - 100) < window.innerHeight * 0.5))) return;
    // stays pages: left only (the right margin is too close to the "View property" column)
    const sides = type === 'stays' ? ['left'] : ['left', 'right'];
    const width = window.innerWidth - CONTENT >= 680 ? 300 : 160;
    const rails = sides.map((side) => {
      const r = block(`rail rh-ad-rail-${side} rh-ad-rail-hidden`, ins(UNITS.rail, `display:inline-block;width:${width}px;height:600px`));
      r.style.setProperty('--rail-w', `${width}px`);
      document.body.append(r); push();
      return r;
    });
    // hidden while the Multiplex grid or the footer is on screen, while so many in-content ads are in view
    // that the rails would make more than 3 ads on screen, while the WhatsApp drawer is open, and (right
    // rail) wherever it would cover the WhatsApp hint bubble
    const stops = new Set(document.querySelectorAll('.rh-ad-grid, footer.rhs-footer'));
    const inContent = [...document.querySelectorAll(IN_CONTENT)];
    const stopsInView = new Set();
    const adsInView = new Set();
    const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const hints = () => [...document.querySelectorAll('#whatsapp-nudge:not([hidden]), .whatsapp-btn-hint.is-visible')]
      .map((h) => h.getBoundingClientRect()).filter((b) => b.width && b.height);
    const update = () => {
      const past = start ? start.getBoundingClientRect().top < 100 : window.scrollY > window.innerHeight * 0.8;
      const show = past && !stopsInView.size && rails.length + adsInView.size <= 3
        && !document.body.classList.contains('whatsapp-drawer-open');
      const bubbles = show ? hints() : [];
      rails.forEach((r) => {
        // a hidden rail keeps its box (visibility/opacity only), so it can be measured where it would sit
        const covers = r.classList.contains('rh-ad-rail-right') && bubbles.some((b) => overlaps(r.getBoundingClientRect(), b));
        r.classList.toggle('rh-ad-rail-hidden', !show || covers);
      });
    };
    let queued = false;
    const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const set = stops.has(e.target) ? stopsInView : adsInView;
          if (e.isIntersecting) set.add(e.target); else set.delete(e.target);
        });
        update();
      });
      [...stops, ...inContent].forEach((el) => io.observe(el));
    }
    // the WhatsApp drawer and hint bubble come and go without a scroll
    new MutationObserver(later).observe(document.body, {
      attributes: true, attributeFilter: ['class', 'hidden'], childList: true, subtree: true,
    });
    window.addEventListener('scroll', update, { passive: true });
    update();
  },
  // lead pages: at most one unit, well below the main action
  lead() {
    if (PATH === '/homestays') { // only where the form sits beside the cards and the cards run on past it
      const form = document.querySelector('#contactForm');
      const list = document.querySelector('.listing-grid');
      if (window.innerWidth < 1381 || !form || !list
        || list.getBoundingClientRect().bottom - form.getBoundingClientRect().bottom < 300) return;
    }
    if (LEAD[PATH] === 'article') return PLACE.slots(); // the rental page's anchor before its FAQ
    // nothing within 400px below the last form / booking panel / WhatsApp or submit button
    const sel = 'form, .booking-panel, .side-panel, .cta-band .btn, a[href*="wa.me"], button[type=submit]';
    const ctas = [...document.querySelectorAll(`main ${sel.split(', ').join(', main ')}`)].filter((e) => e.offsetParent);
    const lastCta = Math.max(0, ...ctas.map((e) => e.getBoundingClientRect().bottom + window.scrollY));
    const footer = document.querySelector('footer.rhs-footer');
    if (!footer || docTop(footer) - lastCta < 400) return;
    PLACE.grid();
  },
};

(function loadAds() {
  const type = pageType(PATH);
  if (!type) return;
  // Local dev shows preview boxes instead (never for automated browsers unless ?adpreview=1, so tests stay
  // ad-free); the owner's own browsers (the GA opt-out in analytics.js) never load ads: never view or click your own ads.
  if (PREVIEW && navigator.webdriver && !FORCE_PREVIEW) return;
  if (!PREVIEW) {
    try { if (localStorage.getItem('rh-analytics-opt-out') === '1') return; } catch { /* storage blocked: still show ads */ }
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    document.head.appendChild(s);
  }
  // this script loads async from <head>: wait for the page before placing units
  const place = () => PLAN[type].forEach((p) => PLACE[p]());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place);
  else place();
})();
