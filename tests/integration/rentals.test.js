// The bike / car / taxi rental pages (scripts/rentals/build-pages.mjs): three separate aspects, one template.
// When this fails after editing bike-and-taxi-rental-in-rishikesh.html or the config:
//   node scripts/rentals/build-pages.mjs
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RENTALS, buildPage, slugOf, KINDS, CITIES } from '../../scripts/rentals/build-pages.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const hub = read('bike-and-taxi-rental-in-rishikesh.html');
const options = (html) => [...html.match(/<select id="rental_service"[^]*?<\/select>/)[0].matchAll(/<option value="([a-z_]+)"/g)].map((m) => m[1]);

test('pages: bike, car, taxi for every city, each a real file', () => {
  assert.strictEqual(RENTALS.length, Object.keys(KINDS).length * Object.keys(CITIES).length);
  for (const kind of Object.keys(KINDS)) for (const city of Object.keys(CITIES)) assert(existsSync(join(ROOT, `${slugOf(kind, city)}.html`)), `${kind} ${city}`);
});

test('the committed pages are what the generator writes (run node scripts/rentals/build-pages.mjs)', () => {
  for (const r of RENTALS) assert.strictEqual(read(`${r.slug}.html`), buildPage(hub, r), r.slug);
});

test('the three kinds are not mixed: each page offers and describes only its own', () => {
  for (const r of RENTALS) {
    const html = read(`${r.slug}.html`);
    const main = html.slice(html.indexOf('<main>'), html.indexOf('</main>'));
    const opts = options(html);
    if (r.kind === 'bike') {
      assert.deepStrictEqual(opts, ['bike'], r.slug);
      assert(!/Taxi &amp; cab bookings|self-drive/i.test(main), `${r.slug} mentions cars or taxis`);
    } else if (r.kind === 'car') {
      assert.deepStrictEqual(opts, ['self_drive'], r.slug);
      assert(!/scooty|Royal Enfield|helmet/i.test(main), `${r.slug} mentions bikes`);
    } else {
      assert.deepStrictEqual(opts, ['taxi_local', 'taxi_pickup', 'taxi_outstation'], r.slug);
      assert(!/scooty|Royal Enfield|helmet|self-drive/i.test(main.replace(/<nav class="rental-switch".*?<\/nav>/s, '')), `${r.slug} mentions bikes or self-drive`);
    }
    assert(html.includes(`name="city" value="${CITIES[r.city]}"`), `${r.slug} sends its city`);
    assert(!/<!--\/?rent:/.test(html), `${r.slug} has template markers left`);
  }
});

test('every page has the switch: the kinds for its city, the cities for its kind, itself marked current', () => {
  for (const r of RENTALS) {
    const html = read(`${r.slug}.html`);
    const nav = html.match(/<nav class="rental-switch"[^]*?<\/nav>/)[0];
    for (const k of Object.keys(KINDS)) assert(nav.includes(`href="/${slugOf(k, r.city)}"`), `${r.slug} -> ${k}`);
    for (const c of Object.keys(CITIES)) assert(nav.includes(`href="/${slugOf(r.kind, c)}"`), `${r.slug} -> ${c}`);
    assert.strictEqual((nav.match(/aria-current="page"/g) || []).length, 2, r.slug);
  }
});

test('each page has its own title, h1, canonical and one FAQ block', () => {
  const titles = new Set();
  for (const r of RENTALS) {
    const html = read(`${r.slug}.html`);
    titles.add(html.match(/<title>([^<]*)<\/title>/)[1]);
    assert(html.includes(`<link rel="canonical" href="https://rishikeshhomestays.com/${r.slug}">`), r.slug);
    assert.strictEqual((html.match(/<h1>/g) || []).length, 1, r.slug);
    assert.strictEqual((html.match(/"@type": "FAQPage"/g) || []).length, 1, r.slug);
    assert(html.includes(CITIES[r.city]), r.slug);
  }
  assert.strictEqual(titles.size, RENTALS.length);
});

test('the footer, the sitemap and the ad plan know the pages', () => {
  const footer = read('thanks.html');
  const sitemap = read('sitemap.xml');
  const ads = read('assets/js/ads.js');
  for (const r of RENTALS) {
    assert(footer.includes(`<a href="${r.url}">`), `footer ${r.slug}`);
    assert(sitemap.includes(`<loc>https://rishikeshhomestays.com${r.url}</loc>`), `sitemap ${r.slug}`);
    assert(ads.includes(`'${r.url}': 'article'`), `ads ${r.slug}`);
  }
});

test('the nav says "Bike & Taxi Rental" on every hand-made page', () => {
  for (const f of ['index.html', 'thanks.html', 'contact.html', 'hotels/stay.html']) {
    const nav = read(f).match(/<nav class="site-nav"[^]*?<\/nav>/)[0];
    assert(nav.includes('>Bike &amp; Taxi Rental</a>'), f);
  }
});
