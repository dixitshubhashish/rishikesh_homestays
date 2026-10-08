// The per-city driving guides (scripts/drives/build-pages.mjs): every Delhi NCR city to Rishikesh and Haridwar.
// When this fails after editing the master guide or the config:  node scripts/drives/build-pages.mjs
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES, CITIES, DESTS, buildPage, pageUrl } from '../../scripts/drives/build-pages.mjs';

const DEST_INDEX = Object.fromEntries(Object.keys(DESTS).map((d, i) => [d, i]));

const ROOT = join(import.meta.dirname, '..', '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const master = read('driving-from-delhi-to-rishikesh.html');

test('every NCR city has a page to Rishikesh and to Haridwar (Delhi to Rishikesh is the master guide)', () => {
  assert.strictEqual(Object.keys(CITIES).length, 8);
  assert.strictEqual(PAGES.length, 8 * Object.keys(DESTS).length - 1);
  for (const city of Object.keys(CITIES)) for (const dest of Object.keys(DESTS)) {
    const file = pageUrl(city, dest).slice(1) + '.html';
    assert(existsSync(join(ROOT, file)), file);
  }
});

test('the committed pages are what the generator writes (run node scripts/drives/build-pages.mjs)', () => {
  for (const { city, dest, slug } of PAGES) assert.strictEqual(read(`${slug}.html`), buildPage(master, city, dest), slug);
});

test('each page: its own title, h1, canonical, distance, one FAQ, no master text left', () => {
  const titles = new Set();
  for (const { city, dest, slug } of PAGES) {
    const html = read(`${slug}.html`);
    titles.add(html.match(/<title>([^<]*)<\/title>/)[1]);
    assert(html.includes(`<link rel="canonical" href="https://rishikeshhomestays.com/${slug}">`), slug);
    assert(html.includes(`<h1>Driving from ${CITIES[city].name} to ${DESTS[dest]}.</h1>`), slug);
    assert(new RegExp(`is about ${CITIES[city].km[DEST_INDEX[dest]]} km by road`).test(html), slug);
    assert.strictEqual((html.match(/"@type": "FAQPage"/g) || []).length, 1, slug);
    assert.strictEqual((html.match(/"@type": "Article"/g) || []).length, 1, slug);
    assert(!html.includes('Kumbh 2027 brings Haridwar'), `${slug} copied the master body`);
  }
  assert.strictEqual(titles.size, PAGES.length);
});

test('the switch links to the other destination and every city, itself marked current', () => {
  for (const { city, dest, slug } of PAGES) {
    const nav = read(`${slug}.html`).match(/<nav class="rental-switch drive-switch"[^]*?<\/nav>/)[0];
    for (const d of Object.keys(DESTS)) assert(nav.includes(`href="${pageUrl(city, d)}"`), `${slug} -> ${d}`);
    for (const c of Object.keys(CITIES)) assert(nav.includes(`href="${pageUrl(c, dest)}"`), `${slug} -> ${c}`);
    assert.strictEqual((nav.match(/aria-current="page"/g) || []).length, 2, slug);
  }
});

test('the master guide, the sitemap and the ad plan know every page', () => {
  const sitemap = read('sitemap.xml'), ads = read('assets/js/ads.js');
  for (const { slug, url } of PAGES) {
    assert(master.includes(`href="${url}"`), `master links ${slug}`);
    assert(sitemap.includes(`<loc>https://rishikeshhomestays.com${url}</loc>`), `sitemap ${slug}`);
    assert(ads.includes(`'${url}'`), `ads ${slug}`);
  }
});

test('the footer lists every driving guide under "Driving to <town>" (found on disk by file name, scripts/stays/footer_links.py)', () => {
  const footer = read('thanks.html');
  for (const dest of Object.keys(DESTS)) assert(footer.includes(`<h3>Driving to ${DESTS[dest]}</h3>`), dest);
  for (const { slug, url } of PAGES) assert(footer.includes(`<a href="${url}">`), `footer ${slug}`);
  assert(footer.includes(`<a href="/${'driving-from-delhi-to-rishikesh'}">Delhi to Rishikesh</a>`));
});

test('the master guide has the switch too (Delhi to Rishikesh current), with "Planning to:" and "From city:" rows', () => {
  const nav = master.match(/<nav class="rental-switch drive-switch"[^]*?<\/nav>/)[0];
  assert(nav.includes('Planning to:') && nav.includes('From city:'));
  assert(nav.includes('<a href="/driving-from-delhi-to-rishikesh" aria-current="page">Rishikesh</a>'));
  assert(nav.includes('<a href="/driving-from-delhi-to-haridwar">Haridwar</a>'));
  for (const { url } of PAGES.filter((p) => p.dest === 'rishikesh')) assert(nav.includes(`href="${url}"`), url);
});
