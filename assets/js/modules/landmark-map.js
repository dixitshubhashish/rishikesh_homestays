// Map for hotels/best-stays-near-<landmark> pages: the landmark, the stays
// listed on the page (each linking to its /hotels/stay page) and our own
// homestays. Data comes from the page's <script id="lm-data"> JSON (written
// by scripts/stays/build_pages.py); Leaflet (self-hosted) loads only when the
// map scrolls near the viewport.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function draw(el, data) {
  const L = window.L;
  el.innerHTML = '';
  const map = L.map(el, { scrollWheelZoom: false }).setView(data.center, 15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  const pin = (ll, style, html) => L.circleMarker(ll, style).addTo(map).bindPopup(html);
  const bounds = [data.center];
  data.stays.forEach(([lat, lng, name, id, dist]) => {
    bounds.push([lat, lng]);
    pin([lat, lng], { radius: 6, color: '#0f6f74', weight: 1, fillColor: '#0f6f74', fillOpacity: 0.55 },
      `<b data-stay-name>${esc(name)}</b><br>${esc(dist)} away<br><a href="/hotels/stay?s=${esc(id)}${esc(data.cq)}">View property</a>`);
  });
  data.own.forEach(([lat, lng, name, url]) => pin([lat, lng], { radius: 9, color: '#9a5a10', weight: 2, fillColor: '#d98b2b', fillOpacity: 0.95 },
    `<b data-stay-name>${esc(name)}</b><br>Our homestay · book direct<br><a href="${esc(url)}">${url === '/contact' ? 'Enquire' : 'View'}</a>`));
  pin(data.center, { radius: 11, color: '#7a2f1f', weight: 3, fillColor: '#b5573f', fillOpacity: 1 }, `<b>${esc(data.name)}</b>`).openPopup();
  map.fitBounds(L.latLngBounds(bounds.slice(0, 60)).pad(0.1), { maxZoom: 16 });
}

export function setupLandmarkMap() {
  const el = document.getElementById('lm-map');
  const raw = document.getElementById('lm-data');
  if (!el || !raw) return;
  const data = JSON.parse(raw.textContent);
  const start = () => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/assets/vendor/leaflet/leaflet.css';
    document.head.appendChild(css);
    loadScript('/assets/vendor/leaflet/leaflet.js').then(() => draw(el, data)).catch((err) => console.error('Landmark map failed to load', err));
  };
  if (!('IntersectionObserver' in window)) { start(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
  }, { rootMargin: '400px' });
  io.observe(el);
}

setupLandmarkMap();
