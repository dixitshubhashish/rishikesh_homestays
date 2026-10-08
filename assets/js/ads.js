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
//                block under the filters from 901px wide; a minor break after every ~15-20 stays (owner, 2026-10-08:
//                "after 15 or 20 listings", across every category group) that alternates a text in-feed
//                AdSense unit with a Booking.com banner (never beside a View property button: it sits between
//                two rows or two groups, full width, with its own divider); the Booking.com search widget and
//                the grid above the footer. The mix: a fair coin per page view (SIDEBAR_BOOKING) decides whether the
//                sidebar holds AdSense and the breaks start with Booking.com, or the other way round. Wide windows (≥ 1860px, a
//                300px margin each side) also get a right rail with the other kind than the sidebar's; landmark
//                pages (no sidebar) get an AdSense left rail from ≥ 1580×900 and the Booking.com right rail from ≥ 1860.
//   lead pages   at most one ad, well below the main action: /homestays' in-article anchor between the top-brand
//                and the Nirmal Bagh lists (below the form on every screen); the rental pages' anchor before their FAQ.
//   no ads       /hotels/stay and our own listing (no rival hotels under our booking buttons), contact,
//                list-your-homestay, report-a-bug, thanks and 404: that's where guests book, enquire and report problems.
// Fixed rails sit in the empty margins beside the 1180px content (≥ 1580px wide and ≥ 900px tall, so they
// never run under the WhatsApp button), never with a sidebar ad, and hide over the grid/footer, while in-content
// ads in view would make more than 3 on screen, while the WhatsApp drawer is open (body.whatsapp-drawer-open),
// and (right rail) wherever it would cover the WhatsApp hint bubble.
const ADSENSE_CLIENT = 'ca-pub-7016219170450293';
const GUIDES = ['/about-rishikesh', '/places-to-visit', '/things-to-do-in-rishikesh', '/triveni-ghat', '/kedarnath-yatra', '/haridwar-kumbh-2027', '/driving-from-delhi-to-rishikesh',
  '/driving-from-delhi-to-haridwar', '/driving-from-gurugram-to-rishikesh', '/driving-from-gurugram-to-haridwar', '/driving-from-noida-to-rishikesh', '/driving-from-noida-to-haridwar', '/driving-from-greater-noida-to-rishikesh', '/driving-from-greater-noida-to-haridwar', '/driving-from-ghaziabad-to-rishikesh', '/driving-from-ghaziabad-to-haridwar', '/driving-from-faridabad-to-rishikesh', '/driving-from-faridabad-to-haridwar', '/driving-from-sonipat-to-rishikesh', '/driving-from-sonipat-to-haridwar', '/driving-from-meerut-to-rishikesh', '/driving-from-meerut-to-haridwar',
  '/driving-from-delhi-to-dehradun', '/driving-from-delhi-to-mussoorie', '/driving-from-gurugram-to-dehradun', '/driving-from-gurugram-to-mussoorie', '/driving-from-noida-to-dehradun', '/driving-from-noida-to-mussoorie', '/driving-from-greater-noida-to-dehradun', '/driving-from-greater-noida-to-mussoorie', '/driving-from-ghaziabad-to-dehradun', '/driving-from-ghaziabad-to-mussoorie', '/driving-from-faridabad-to-dehradun', '/driving-from-faridabad-to-mussoorie', '/driving-from-sonipat-to-dehradun', '/driving-from-sonipat-to-mussoorie', '/driving-from-meerut-to-dehradun', '/driving-from-meerut-to-mussoorie'];
// lead pages and the one unit each may get; contact, list-your-homestay, report-a-bug, thanks and 404 are deliberately absent
// /hotels/stay and our own listing get none (owner, 2026-10-06: no rival hotels under our booking buttons)
const LEAD = {
  '/homestays': 'article', // the anchor between the top brands and the Nirmal Bagh homes (generated, build_pages.py)
  '/bike-and-taxi-rental-in-rishikesh': 'article',
  '/bike-rental-in-rishikesh': 'article', '/bike-rental-in-haridwar': 'article',
  '/car-rental-in-rishikesh': 'article', '/car-rental-in-haridwar': 'article',
  '/taxi-rental-in-rishikesh': 'article', '/taxi-rental-in-haridwar': 'article',
  '/bike-rental-in-dehradun': 'article', '/bike-rental-in-mussoorie': 'article',
  '/car-rental-in-dehradun': 'article', '/car-rental-in-mussoorie': 'article',
  '/taxi-rental-in-dehradun': 'article', '/taxi-rental-in-mussoorie': 'article',
};
function pageType(path) {
  // 404.html answers any unknown address (even /hotels/nothing): the Booking.com widget only, a dead end with nothing to book here, no AdSense
  if (document.documentElement.dataset.i18nPage === '404') return 'widget';
  if (GUIDES.includes(path)) return 'guide';
  if (path === '') return 'home';
  if (path in LEAD) return 'lead';
  // stays lists: best-*, landmark and search-phrase pages; not the stay page or our own listing
  if (/^\/hotels\/(?!stay$)(?!advaitam-)[a-z0-9-]+$/.test(path)) return 'stays';
  return null;
}
const PATH = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
const PLAN = {
  home: ['slots', 'widget', 'grid', 'rails'], // grid before rails, so the rails can watch it
  guide: ['feed', 'slots', 'sidebar', 'widget', 'grid', 'rails'],
  stays: ['side', 'slots', 'feed', 'widget', 'grid', 'rails'],
  lead: ['lead'],
  widget: ['widget'],
};
// lead pages that also get the Booking.com widget above the footer (travellers renting a bike or car need a bed too);
// /homestays, contact, thanks, list-your-homestay, report-a-bug, /hotels/stay and our own listing never do (owner, 2026-10-06:
// no rival hotels where guests book or enquire with us)
const LEAD_WIDGET = Object.keys(LEAD).filter((p) => /-rental-in-/.test(p));

// The Booking.com search widget (owner, 2026-10-07: "place it like the ads"). Not an AdSense unit, but it is placed
// by the same rules and in the same page types: below the first screen, never on lead pages, our own listing,
// contact, report-a-bug, thanks or 404, never in the owner's opt-out browser (no self-clicks), nothing in automated
// tests, a labelled box on localhost. Home: the page's own <div data-booking-widget> (below the homestay sections);
// guides and stays lists: a section just above the footer (before the Multiplex grid). Same CJ link and pixel as
// CJ_PID / CJ_BOOKING_LINK_ID in assets/js/modules/affiliate-links.js (this file is not a module: keep them in step).
const BOOKING = {
  id: 'bookingAffiliateWidget_386d39d7-2d08-41b5-af0f-0fc2c536b862',
  link: 'http://www.jdoqocy.com/click-101895722-17323528?sid=',
  pixel: 'https://www.awltovhc.com/image-101895722-17323528',
  sdk: 'https://www.booking.com/affiliate/prelanding_sdk',
};

// The Booking.com banner (owner, 2026-10-08: mix Booking.com in with the ads): our own HTML, one CJ deep link (same CJ_PID / CJ_BOOKING_LINK_ID as assets/js/modules/affiliate-links.js: a test keeps them
// equal), shown wherever an AdSense unit may go, labelled "Sponsored". Not an iframe: no sizing surprises, it follows the theme,
// and any number of them can sit on a page (the iframe widget above is one instance per page).
const CJ_DEEP = 'https://www.kqzyfj.com/click-101895722-17293139?url=';
const CITY_NAMES = { rishikesh: 'Rishikesh', haridwar: 'Haridwar', dehradun: 'Dehradun', mussoorie: 'Mussoorie' };
const PAGE_CITY = (() => {
  const c = document.getElementById('sx-root')?.dataset.city || (window.location.pathname.match(/(rishikesh|haridwar|dehradun|mussoorie)/) || [])[1];
  return CITY_NAMES[c] ? c : 'rishikesh';
})();
const CITY_NAME = CITY_NAMES[PAGE_CITY];
// Where the banner's link lands (owner, 2026-10-08): our own property pages on Booking.com, through the CJ link, so the visitor
// starts from our stay and searches the rest from there. Advaitam always; Yoga Retreat at the Ganges (Booking.com's listing is named
// "Yoga Retreat at The Ganges in Rishikesh", confirmed ours by the owner) in every second banner on a page. Change the URLs here.
const OWN_BOOKING = [
  'https://www.booking.com/hotel/in/rishikesh-homestay-luxury-3-bhk-ganges-hill-view-by-the-ghats.en-gb.html',
  'https://www.booking.com/hotel/in/yoga-retreat-at-the-ganges-in-rishikesh.html',
];
let bannerCount = 0;
const bookingBanner = (tall = false) => {
  const own = OWN_BOOKING[bannerCount++ % 2];
  return `<a class="rh-bk${tall ? ' rh-bk-tall' : ''}" target="_blank" rel="sponsored noopener" href="${CJ_DEEP}${encodeURIComponent(own)}">`
    + '<span class="rh-bk-name">Booking.com</span>'
    + `<strong>Compare ${CITY_NAME} stays and live prices</strong>`
    + '<span class="rh-bk-sub">Pick your dates on Booking.com to see what is open and what it costs.</span>'
    + '<span class="rh-bk-go">Search Booking.com</span></a>';
};
// Which kind goes where (owner, 2026-10-08): a fair coin flipped once per page view, so on every visit and every refresh AdSense and
// Booking.com have exactly equal chances of the sidebar / first slot and the other kind gets the next one. It uses the browser's own
// random source (crypto.getRandomValues, one unbiased bit): no id, cookie, address or storage, nothing that sticks to a visitor.
// The page's layout reads the result once, so one view never flips half way; the choice is written to <html data-ad-mix> for analytics.
const coin = () => { try { return (crypto.getRandomValues(new Uint8Array(1))[0] & 1) === 1; } catch { return Math.random() < 0.5; } };
const SIDEBAR_BOOKING = coin(); // true: Booking.com in the first slot (sidebar / left rail), the breaks start with AdSense; false: the reverse
document.documentElement.dataset.adMix = SIDEBAR_BOOKING ? 'booking-first' : 'adsense-first';

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
const MAX_BREAKS = 8; // stays lists: at most this many mid-list breaks on a page
const MAX_BREAK_ADS = 6; // and at most this many AdSense requests for them in one page view (re-draws included)
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
function block(name, html, label = 'Advertisement') {
  const wrap = document.createElement('section');
  wrap.className = `rh-ad rh-ad-${name}`;
  wrap.setAttribute('aria-label', label || 'Stay options');
  wrap.innerHTML = `${label ? `<p class="rh-ad-label">${label}</p>` : ''}${html}`;
  return wrap;
}
// a Booking.com banner block: an affiliate link, so it says "Sponsored"
const bookingBlock = (name, tall) => block(`${name} bookad`, bookingBanner(tall), 'Sponsored');

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
  // stays: a minor break after every ~15-20 stays, across every category group (owner, 2026-10-08), alternating a text in-feed
  // AdSense unit with a Booking.com banner. It goes between two rows (a full-width <li>) or, at the end of a group, between
  // two groups; never in a group's last rows, never within a screen of another in-content ad. How many stays make "15 or 20":
  // enough rows to fill one screen height (rows are about 66px, so 15 on a laptop, up to 24 on a tall window), which is also
  // what keeps two breaks from ever being on screen together. Placed again after the list is re-drawn (a filter, "View all"),
  // with at most MAX_BREAK_ADS AdSense requests per page view; the banners are only links.
  sxfeed() {
    const out = document.getElementById('sx-out');
    if (!out) return;
    let busy = false, timer = 0, adRequests = 0;
    const place = () => {
      if (busy || out.querySelector('.sx-break, :scope > .rh-ad-sxfeed')) return;
      busy = true;
      try { PLACE.sxbreaks(() => ++adRequests <= MAX_BREAK_ADS); } finally { busy = false; }
    };
    place();
    new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(place, 800); }).observe(out, { childList: true });
  },
  sxbreaks(mayRequestAd) {
    const groups = [...document.querySelectorAll('#sx-out > .sx-group')];
    const first = document.querySelector('#sx-out .sx-item');
    if (!first || !groups.length) return;
    const rowH = Math.max(first.offsetHeight, 48);
    const every = Math.min(24, Math.max(15, Math.ceil((window.innerHeight + 120) / rowH)));
    let count = 0, n = 0;
    const kind = () => ((n % 2 === 0) === SIDEBAR_BOOKING ? 'ad' : 'booking'); // the first break is the opposite of the first slot's kind
    const make = () => (kind() === 'ad' && mayRequestAd() ? block('sxfeed', ins(UNITS.infeedText)) : bookingBlock('sxfeed'));
    // between two rows (a full-width <li> after `anchor`) or before `anchor`, a whole group
    const put = (anchor, betweenRows) => {
      if (n >= MAX_BREAKS || !belowFold(anchor) || !spaced(docTop(anchor) + (betweenRows ? anchor.offsetHeight : 0))) return;
      const b = make();
      if (betweenRows) { const li = document.createElement('li'); li.className = 'sx-break'; li.append(b); anchor.after(li); } else anchor.before(b);
      if (b.querySelector('ins.adsbygoogle')) push();
      n++; count = 0;
    };
    groups.forEach((g, gi) => {
      if (g.querySelector('.sx-scroll')) return; // the master page's scrolling list: leave it alone
      const items = [...g.querySelectorAll('.sx-list > .sx-item')];
      items.forEach((it, i) => {
        count++;
        if (count >= every && i >= 2 && items.length - 1 - i >= 4) put(it, true);
      });
      // enough stays have gone by and this group ends: the break goes between this group and the next
      if (count >= every && groups[gi + 1]) put(groups[gi + 1], false);
    });
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
    // the mix: odd pages show the Booking.com banner here (it needs a column of at least 220px), even pages AdSense
    if (SIDEBAR_BOOKING && w >= 220) { side.append(bookingBlock('side bookside', true)); return; }
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
  // the Booking.com widget: the home page's own anchor, else a section above the footer (long pages only)
  widget() {
    const anchor = document.querySelector('[data-booking-widget]');
    let host = anchor;
    if (!host) {
      const footer = document.querySelector('footer.rhs-footer');
      if (pageType(PATH) === 'home' || !footer || docTop(footer) < window.innerHeight * 1.5) return;
      const sec = document.createElement('section');
      sec.className = 'section booking-widget';
      sec.innerHTML = '<div class="container"></div>';
      footer.before(sec);
      host = sec.firstChild;
    }
    if (PREVIEW) { host.innerHTML = '<div class="rh-ad-preview" style="display:block;min-height:200px">Booking.com search widget</div>'; return; }
    host.innerHTML = `<div id="${BOOKING.id}">&nbsp;</div>`;
    const px = new Image(1, 1); px.alt = ''; px.src = BOOKING.pixel; host.append(px);
    const start = () => new window.Booking.AffiliateWidget({
      iframeSettings: { selector: BOOKING.id, responsive: true },
      widgetSettings: { destinationurloverride: BOOKING.link },
    });
    if (window.Booking) { start(); return; }
    const s = document.createElement('script');
    s.async = true; s.src = BOOKING.sdk; s.onload = start;
    document.head.append(s);
  },
  // after all the content, just above the footer
  grid() {
    const footer = document.querySelector('footer.rhs-footer');
    if (!footer || docTop(footer) < window.innerHeight * 1.5) return;
    footer.before(block('grid', ins(UNITS.grid))); push();
  },
  // tall ads fixed in the empty side margins, wide and tall windows only
  rails() {
    const hasSide = !!document.querySelector('.rh-ad-side, .rh-ad-sidebar');
    const type = pageType(PATH);
    const wideMargins = window.innerWidth - CONTENT >= 680; // 300px rails: room for the Booking.com banner
    // a sidebar means no rails, except stays pages on very wide windows: one right rail of the other kind than the sidebar's
    if (!RAILS_OK() || (hasSide && !(type === 'stays' && wideMargins))) return;
    // homepage: only from "Plan beyond the room" (<section data-ad-start>); elsewhere past the first screen
    const start = type === 'home' ? document.querySelector('[data-ad-start]') : null;
    const grid = document.querySelector('.rh-ad-grid');
    // homepage: none when that section and the grid are so close that the rails would only
    // blink in for a moment between the two (the usual case today)
    if (type === 'home' && (!start
      || (grid && (docTop(grid) - window.innerHeight) - (docTop(start) - 100) < window.innerHeight * 0.5))) return;
    // stays pages: left only (the right margin is too close to the "View property" column)
    // stays pages: the left rail (AdSense) and, on very wide windows, a right Booking.com rail; with a sidebar only the right
    // rail, of the kind the sidebar is not. Guides keep two AdSense rails.
    // first slot (the sidebar, else the left rail) takes the coin's kind, the right rail the other; a 160px rail cannot hold the banner
    const firstBooking = hasSide ? !!document.querySelector('.rh-ad-side.bookside') : SIDEBAR_BOOKING && wideMargins;
    const sides = type === 'stays' ? (hasSide ? ['right'] : wideMargins ? ['left', 'right'] : ['left']) : ['left', 'right'];
    const width = wideMargins ? 300 : 160;
    const rails = sides.map((side) => {
      const booking = type === 'stays' && (side === 'right' ? !firstBooking : firstBooking);
      const name = `rail rh-ad-rail-${side} rh-ad-rail-hidden`;
      const r = booking ? bookingBlock(`${name} bookrail`, true) : block(name, ins(UNITS.rail, `display:inline-block;width:${width}px;height:600px`));
      r.style.setProperty('--rail-w', `${width}px`);
      document.body.append(r); if (!booking) push();
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
      const show = past && !stopsInView.size && rails.length + adsInView.size + (hasSide ? 1 : 0) <= 3
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
    if (LEAD[PATH] === 'article') return PLACE.slots(); // the rental pages' anchor before the FAQ; /homestays' between the brand and area lists
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
  }
  if (!PREVIEW && type !== 'widget') {
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    document.head.appendChild(s);
  }
  // this script loads async from <head>: wait for the page before placing units
  const plan = type === 'lead' && LEAD_WIDGET.includes(PATH) ? [...PLAN.lead, 'widget'] : PLAN[type];
  const place = () => plan.forEach((p) => PLACE[p]());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place);
  else place();
})();
