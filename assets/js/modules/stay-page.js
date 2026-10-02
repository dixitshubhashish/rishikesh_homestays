// Single-stay info page (/stay?s=<id>), shared by every listing on the
// best-*-in-rishikesh pages. Renders the stay from stays-index-data.js, then
// "Book this stay" opens a lead popup (name, email, phone) with two choices:
//   - Submit: the lead is emailed to us via /api/contact (awaited), then the
//     guest goes to the stay's one verified booking page (Booking.com, MMT,
//     Agoda or Airbnb, from scripts/stays/ota-links.tsv). Stays without a
//     verified page go to /thanks.
//   - Chat on WhatsApp: opens a chat with the stay prefilled.
import { STAYS_INDEX, STAYS_INDEX_META, STAYS_OWN } from './stays-index-data.js';
import { validatePhone } from './validators.js';
import { setupCountryPhoneField } from './country-select.js';
import { setButtonLoading, clearButtonLoading } from './button-loading.js';
import { buildWhatsAppLink } from './whatsapp-link.js';

const WHATSAPP_PHONE = '919027212484';
// Same icon as the site's other "WhatsApp" buttons (index.html etc.).
const WA_ICON = '<svg class="whatsapp-inline-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.386.7 4.61 1.902 6.482L4 29l7.72-1.867A11.94 11.94 0 0016.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3zm0 21.75c-1.94 0-3.75-.53-5.303-1.45l-.38-.225-4.582 1.108 1.127-4.463-.248-.394A9.71 9.71 0 016.25 15c0-5.376 4.377-9.75 9.754-9.75 5.375 0 9.746 4.374 9.746 9.75s-4.371 9.75-9.746 9.75zm5.34-7.297c-.293-.147-1.734-.856-2.003-.954-.269-.098-.464-.147-.66.147-.196.293-.758.954-.929 1.15-.171.196-.342.22-.635.073-.293-.147-1.235-.455-2.353-1.452-.87-.776-1.457-1.735-1.628-2.028-.171-.293-.018-.452.128-.598.132-.132.293-.343.44-.514.147-.171.196-.367.293-.488.098-.196.049-.367-.024-.514-.073-.147-.66-1.59-.904-2.178-.238-.572-.48-.494-.66-.503l-.562-.01c-.196 0-.514.073-.783.367-.269.293-1.026 1.002-1.026 2.444s1.05 2.836 1.197 3.032c.147.196 2.067 3.157 5.008 4.427.7.302 1.246.483 1.672.618.702.223 1.34.192 1.845.116.563-.084 1.734-.709 1.979-1.394.244-.685.244-1.271.171-1.394-.073-.122-.269-.196-.562-.343z"/></svg>';

// Straight-line distance in km between two [lat, lng] points.
function kmBetween(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Our nearest own homestay and how far it is, for the WhatsApp reference line.
function nearestOwn(d) {
  if (!d.ll) return null;
  return STAYS_OWN.filter((o) => o.ll && o.id !== d.id)
    .map((o) => ({ o, km: kmBetween(d.ll, o.ll) }))
    .sort((x, y) => x.km - y.km)[0] || null;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inr = (n) => Number(n).toLocaleString('en-IN');

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
let libPromise = null;
function ensureLibphonenumber() {
  if (typeof window.libphonenumber === 'object') return Promise.resolve();
  libPromise ||= loadScript('/assets/vendor/libphonenumber/libphonenumber-min.js')
    .catch((err) => console.error('Stay page: failed to load phone number library', err));
  return libPromise;
}

function matchFilter(d, filter) {
  if (!filter || filter === 'all') return true;
  const [kind, value] = filter.split(':');
  return kind === 'k' ? d.ks.includes(value) : d.t.includes(value);
}

// The most specific category page this stay belongs to, for the breadcrumb.
function categoryFor(stay) {
  const cats = STAYS_INDEX_META.categories.filter((c) => c.filter !== 'all');
  return cats.find((c) => c.filter.startsWith('k:') && matchFilter(stay, c.filter)) ||
    cats.find((c) => matchFilter(stay, c.filter)) ||
    STAYS_INDEX_META.categories.find((c) => c.filter === 'all');
}

// One total-guests question, picked at random each time the popup opens:
// a Rishikesh moment the whole group does together, always counting kids.
const GUEST_QUESTIONS = [
  'How many of you are coming to the Triveni Ghat aarti, little ones included? 🪔',
  'How many diyas should we float at the Parmarth Niketan aarti, kids included? 🪔',
  'How many of you are taking a holy dip, a Ganga snan, kids too? 🙏',
  'How many of you are dipping your toes in the Ganga, kids included? 🏞️',
  'How many of you are crossing Laxman Jhula with us, tiny feet too? 🌉',
  'How many of you are walking Ram Jhula to Swarg Ashram, kids included? 🌉',
  'How many plates at Chotiwala, kids\' plates included? 🍛',
  'How many seats at a riverside cafe in Tapovan, little ones too? ☕',
  'How many cups of kulhad chai by the ghat, kids\' cups included? 🍵',
  'How many of you are sharing a Ganga-view thali, kids included? 🥘',
  'How many life jackets for the rafting trip? Count the kids too. 🌊',
  'How many yoga mats should we roll out at sunrise, kids included? 🧘',
  'How many seats for the Beatles Ashram walk, little ones too? 🎸',
  'How many of you are chasing the Kunjapuri sunrise, kids too? 🌄',
  'How many of you are hiking to Neer Garh waterfall, kids included? 💦',
  'How many of you are visiting Neelkanth Mahadev, little ones too? 🕉️',
  'How many of you are watching the bungee jumpers at Shivpuri, kids included? 🪂',
  'How many of you are joining the evening bhajan by the river, kids too? 🎶'
];

const MODAL_HTML = `
  <div class="ota-gate-backdrop" hidden></div>
  <div class="ota-gate-modal" hidden role="dialog" aria-modal="true" aria-labelledby="sp-gate-title">
    <button type="button" class="ota-gate-close" aria-label="Close">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </button>
    <h3 id="sp-gate-title">Book <span data-sp-name></span></h3>
    <p data-sp-lead></p>
    <form class="ota-gate-form" novalidate>
      <div class="whatsapp-field">
        <label for="sp-name">Name *</label>
        <input type="text" id="sp-name" name="name" required placeholder="Your name" maxlength="50" autocomplete="name">
        <span class="whatsapp-error" data-err-name hidden></span>
      </div>
      <div class="whatsapp-field">
        <label for="sp-email">Email</label>
        <input type="email" id="sp-email" name="email" placeholder="you@example.com" autocomplete="email">
        <span class="whatsapp-error" data-err-email hidden></span>
      </div>
      <div class="whatsapp-field">
        <label for="sp-phone">Phone *</label>
        <div class="whatsapp-phone-row">
          <select id="sp-country" aria-label="Country code"></select>
          <input type="tel" id="sp-phone" name="phone" required placeholder="98765 43210" inputmode="tel" autocomplete="tel">
        </div>
        <span class="whatsapp-error" data-err-phone hidden></span>
      </div>
      <div class="whatsapp-field">
        <label for="sp-guests" data-sp-guests-q></label>
        <div class="sp-stepper">
          <button type="button" data-step="-1" aria-label="One fewer guest">−</button>
          <input type="number" id="sp-guests" name="guests" min="1" max="40" value="2" inputmode="numeric">
          <button type="button" data-step="1" aria-label="One more guest">+</button>
          <span class="sp-stepper-hint">guests in total, kids included</span>
        </div>
      </div>
      <div class="sp-gate-actions">
        <button type="submit" class="btn btn-primary ota-gate-submit" data-sp-submit></button>
        <button type="button" class="btn btn-whatsapp sp-gate-wa" data-sp-wa>${WA_ICON} Chat on WhatsApp</button>
      </div>
    </form>
  </div>`;

function factRows(d) {
  const rows = [
    ['Type', esc(d.ks.join(', '))],
    ['Area', `${esc(d.a)}, Rishikesh`],
  ];
  if (d.ad && d.ad.length > 6) rows.push(['Address', esc(d.ad)]);
  if (d.ll) rows.push(['Map', `<a href="https://www.google.com/maps?q=${d.ll[0]},${d.ll[1]}" target="_blank" rel="noopener">Open in Google Maps</a>`]);
  rows.push(['Star rating', d.s ? `${'★'.repeat(d.s)} ${d.s}-star` : 'Not star-rated']);
  if (d.g) rows.push(['Guest rating', `${d.g}/10${d.c ? ` from ${d.c} reviews` : ''}`]);
  if (d.p) rows.push(['Price', `From ₹${inr(d.p)} a night (listed starting price)`]);
  return rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

function render(root, d, isOwn) {
  const cat = categoryFor(d);
  const similar = STAYS_INDEX.filter((x) => x.id !== d.id && x.a === d.a && x.ks.some((k) => d.ks.includes(k))).slice(0, 6);
  const ota = d.o;
  document.title = `${d.n} | ${d.a}, Rishikesh | Rishikesh Homestays`;
  root.innerHTML = `
    <nav class="sx-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">›</span>
      <a href="/best-${cat.slug}-in-rishikesh">${cat.filter === 'all' ? 'Best Hotels in Rishikesh' : `Best ${esc(cat.title)} in Rishikesh`}</a> <span aria-hidden="true">›</span> <span>${esc(d.n)}</span></nav>
    <p class="eyebrow">${esc(d.k)} · ${esc(d.a)}</p>
    <h1 class="sx-title">${esc(d.n)}</h1>
    <div class="sp-grid">
      <section class="sp-card" aria-labelledby="sp-facts-h">
        <h2 id="sp-facts-h">At a glance</h2>
        <dl class="sp-facts">${factRows(d)}</dl>
      </section>
      <section class="sp-card sp-book" aria-labelledby="sp-book-h">
        <h2 id="sp-book-h">Book this stay</h2>
        <p>${ota ? `Leave your details and we'll take you straight to this stay's page on <b>${esc(ota.n)}</b>. We can also help with dates, groups and long-stay discounts.`
          : `Leave your details and we'll check availability and prices for you, or chat with us on WhatsApp.`}</p>
        <div class="sp-gate-actions">
          <button type="button" class="btn btn-primary" data-sp-open>${ota ? `Book on ${esc(ota.n)}` : 'Check availability'}</button>
          <button type="button" class="btn btn-whatsapp" data-sp-wa-direct>${WA_ICON} Chat on WhatsApp</button>
        </div>
      </section>
    </div>
    ${d.ll ? `<section class="sp-map" aria-labelledby="sp-map-h">
      <h2 id="sp-map-h">Where it is, and what's around it</h2>
      <div class="sp-map-slot" id="sp-map"><a href="https://www.google.com/maps?q=${d.ll[0]},${d.ll[1]}" target="_blank" rel="noopener">Open ${esc(d.n)} in Google Maps</a></div>
      <ul class="sp-map-key" aria-hidden="true"><li><i class="k-this"></i>This stay</li><li><i class="k-own"></i>Our homestays</li><li><i class="k-near"></i>Other stays nearby</li></ul>
      <p class="sp-small"><a href="https://www.google.com/maps/dir/?api=1&amp;destination=${d.ll[0]},${d.ll[1]}" target="_blank" rel="noopener">Get directions in Google Maps</a></p>
    </section>` : ''}
    ${d.f.length ? `<section class="sx-guide" aria-labelledby="sp-fac-h"><h2 id="sp-fac-h">Facilities</h2><ul class="sp-fac">${d.f.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
    ${isOwn ? '' : `<section class="sx-own" aria-labelledby="sx-own-h">
      <h2 id="sx-own-h">Our homestays <span>Book direct with us</span></h2>
      <ul class="sx-list">${STAYS_OWN.map((o) => `<li class="sx-item sx-item-own"><span class="sx-name">${esc(o.n)}</span><span class="sx-meta"><span>${esc(o.a)}</span><span>Book direct, best price</span></span><a class="sx-go" href="${esc(o.u)}">${o.u === '/contact' ? 'Enquire' : 'View'}</a></li>`).join('')}</ul>
    </section>`}
    ${similar.length ? `<section class="sx-group" aria-labelledby="sp-sim-h"><h2 id="sp-sim-h">Similar stays in ${esc(d.a)}</h2>
      <ul class="sx-list">${similar.map((x) => `<li class="sx-item"><span class="sx-name">${esc(x.n)}</span><span class="sx-meta"><span>${esc(x.k)}</span>${x.p ? `<span>From ₹${inr(x.p)}</span>` : ''}</span><a class="sx-go" href="/stay?s=${esc(x.id)}">View property</a></li>`).join('')}</ul>
      <div class="sx-actions"><a class="sx-open" href="/best-${cat.slug}-in-rishikesh">See all ${cat.filter === 'all' ? 'stays' : esc(cat.title.toLowerCase())}</a></div></section>` : ''}
    <p class="sx-note">Rishikesh moves with the seasons, and so do room rates. Prices, availability and facilities can shift between rafting season and the monsoon, so give the property a quick check before you pack.</p>`;
}

function setupGate(root, d) {
  document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
  const backdrop = document.querySelector('.ota-gate-backdrop');
  const modal = document.querySelector('.ota-gate-modal');
  const form = modal.querySelector('form');
  const $m = (sel) => modal.querySelector(sel);
  const nameIn = $m('#sp-name'), emailIn = $m('#sp-email'), phoneIn = $m('#sp-phone'), country = $m('#sp-country');
  const guestsIn = $m('#sp-guests');
  const guests = () => Math.min(40, Math.max(1, parseInt(guestsIn.value, 10) || 1));
  modal.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    guestsIn.value = String(Math.min(40, Math.max(1, guests() + Number(b.dataset.step))));
  }));
  const submitBtn = $m('[data-sp-submit]');
  const ota = d.o;
  $m('[data-sp-name]').textContent = d.n;
  $m('[data-sp-lead]').textContent = ota
    ? `Leave your details and we'll take you straight to ${d.n} on ${ota.n}.`
    : `Leave your details and we'll check availability and the best price for ${d.n}.`;
  submitBtn.textContent = ota ? `Submit & continue to ${ota.n}` : 'Send enquiry';

  let countryReady = false;
  const err = (key, input, msg) => { const el = $m(`[data-err-${key}]`); el.textContent = msg || ''; el.hidden = !msg; input.classList.toggle('whatsapp-input-invalid', Boolean(msg)); };

  function open() {
    $m('[data-sp-guests-q]').textContent = GUEST_QUESTIONS[Math.floor(Math.random() * GUEST_QUESTIONS.length)];
    ensureLibphonenumber().then(() => { if (!countryReady) { countryReady = true; setupCountryPhoneField(country); } });
    backdrop.hidden = false; modal.hidden = false;
    requestAnimationFrame(() => { backdrop.classList.add('is-open'); modal.classList.add('is-open'); });
    nameIn.focus();
  }
  function close() {
    backdrop.classList.remove('is-open'); modal.classList.remove('is-open');
    setTimeout(() => { backdrop.hidden = true; modal.hidden = true; }, 350);
  }
  // Custom per-listing message: the stay's name and area for the guest, plus
  // a reference line for us (stay id + page, and distance from our nearest
  // homestay) so we know exactly which listing they came from.
  function whatsapp() {
    const who = nameIn.value.trim();
    const near = nearestOwn(d);
    const intro = [
      `Hi Rishikesh Homestays! I'm interested in booking ${d.n} (${d.ks[0]}, ${d.a}, Rishikesh).`,
      who ? `My name is ${who}.` : '',
      modal.hidden ? '' : `We're ${guests()} in total, kids included.`,
      'Could you help with availability and the best price?'
    ].filter(Boolean);
    const ref = [
      `Ref: ${d.id}`,
      `${location.origin}/stay?s=${encodeURIComponent(d.id)}`,
      near ? `About ${near.km < 1 ? `${Math.round(near.km * 1000)} m` : `${near.km.toFixed(1)} km`} from ${near.o.n.split(' – ')[0]}` : ''
    ].filter(Boolean);
    const msg = `${intro.join('\n')}\n\n${ref.join('\n')}`;
    window.open(buildWhatsAppLink(WHATSAPP_PHONE, msg), '_blank', 'noopener,noreferrer');
  }

  root.querySelector('[data-sp-open]').addEventListener('click', open);
  root.querySelector('[data-sp-wa-direct]').addEventListener('click', whatsapp);
  $m('[data-sp-wa]').addEventListener('click', whatsapp);
  backdrop.addEventListener('click', close);
  $m('.ota-gate-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
  [['name', nameIn], ['email', emailIn], ['phone', phoneIn]].forEach(([k, el]) => el.addEventListener('input', () => err(k, el)));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameIn.value.trim();
    const email = emailIn.value.trim();
    let bad = false;
    if (!name) { err('name', nameIn, 'Please enter your name.'); bad = true; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err('email', emailIn, 'Please check your email address.'); bad = true; }
    const phone = validatePhone(phoneIn.value, country.value);
    if (!phone.valid) { err('phone', phoneIn, phone.message); bad = true; }
    if (bad) return;

    setButtonLoading(submitBtn, 'Sending...');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email: email || undefined, phone: phone.normalized,
          preferred_stay: d.id, area: d.a, stay_name: d.n, guests_total: guests(),
          details: `Interested in ${d.n} (${d.ks.join(', ')}, ${d.a}).\nTotal guests (kids included): ${guests()}\n` +
            (ota ? `Sent on to ${ota.n}: ${ota.u}` : 'No verified booking page: please follow up with availability and price.') +
            `\nStay page: ${location.origin}/stay?s=${d.id}`,
          source: ota ? `stay_redirect_${ota.n.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'stay_enquiry'
        })
      });
      const result = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !result.success) throw new Error(result.message || 'Request failed');
      // Same-tab redirect (a window.open after an await is often blocked):
      // the stay's verified booking page, else our thank-you page.
      location.assign(ota ? ota.u : '/thanks');
      return;
    } catch (error) {
      console.error('Stay page: failed to record enquiry', error);
      err('phone', phoneIn, "Couldn't reach us just now. Please try again, or use WhatsApp.");
    } finally {
      clearButtonLoading(submitBtn);
    }
  });
}

// Map of this stay, our homestays and other stays within NEARBY_KM, drawn
// with self-hosted Leaflet (assets/vendor/leaflet) on OpenStreetMap tiles.
// Leaflet is only loaded when the map scrolls near the viewport.
const NEARBY_KM = 1.5;
function setupMap(d) {
  const el = document.getElementById('sp-map');
  if (!el || !d.ll) return;
  const start = () => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/assets/vendor/leaflet/leaflet.css';
    document.head.appendChild(css);
    loadScript('/assets/vendor/leaflet/leaflet.js').then(() => drawMap(el, d)).catch((err) => console.error('Stay page: map failed to load', err));
  };
  if (!('IntersectionObserver' in window)) { start(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
  }, { rootMargin: '400px' });
  io.observe(el);
}

function drawMap(el, d) {
  const L = window.L;
  el.innerHTML = '';
  const map = L.map(el, { scrollWheelZoom: false }).setView(d.ll, 15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  const pin = (ll, style, html) => L.circleMarker(ll, style).addTo(map).bindPopup(html);
  const nearby = STAYS_INDEX.filter((x) => x.ll && x.id !== d.id && kmBetween(d.ll, x.ll) <= NEARBY_KM).slice(0, 60);
  nearby.forEach((x) => pin(x.ll, { radius: 6, color: '#0f6f74', weight: 1, fillColor: '#0f6f74', fillOpacity: 0.55 },
    `<b>${esc(x.n)}</b><br>${esc(x.k)}${x.p ? ` · from ₹${inr(x.p)}` : ''}<br><a href="/stay?s=${esc(x.id)}">View property</a>`));
  const own = STAYS_OWN.filter((o) => o.ll && o.id !== d.id);
  own.forEach((o) => pin(o.ll, { radius: 9, color: '#9a5a10', weight: 2, fillColor: '#d98b2b', fillOpacity: 0.95 },
    `<b>${esc(o.n)}</b><br>Our homestay · book direct<br><a href="${esc(o.u)}">${o.u === '/contact' ? 'Enquire' : 'View'}</a>`));
  pin(d.ll, { radius: 11, color: '#7a2f1f', weight: 3, fillColor: '#b5573f', fillOpacity: 1 }, `<b>${esc(d.n)}</b><br>${esc(d.a)}`).openPopup();
  // Fit this stay and our nearest homestay in view, if it's within ~10 km.
  const near = nearestOwn(d);
  if (near && near.km <= 10) map.fitBounds(L.latLngBounds([d.ll, near.o.ll]).pad(0.25), { maxZoom: 16 });
}

export function setupStayPage() {
  const root = document.getElementById('sp-root');
  if (!root) return;
  const id = new URLSearchParams(location.search).get('s') || '';
  const own = STAYS_OWN.find((o) => o.id === id);
  const stay = own || STAYS_INDEX.find((d) => d.id === id);
  if (!stay) {
    root.innerHTML = `<h1 class="sx-title">Stay not found</h1><p>This stay may have been removed from the listings. <a href="/best-hotels-in-rishikesh">Browse all stays in Rishikesh</a> or <a href="/contact">send us your dates</a> and we'll suggest options.</p>`;
    return;
  }
  render(root, stay, Boolean(own));
  setupGate(root, stay);
  setupMap(stay);
}

setupStayPage();
