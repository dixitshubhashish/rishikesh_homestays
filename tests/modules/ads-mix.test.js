// ads.js is a classic script (not importable), so these read its source: the Booking.com banner must use the same CJ ids as
// affiliate-links.js, the mid-list breaks and the widget pages must stay where the owner put them (2026-10-08).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CJ_PID, CJ_BOOKING_LINK_ID, CJ_CLICK_HOST } from '../../assets/js/modules/affiliate-links.js';

const ads = readFileSync(new URL('../../assets/js/ads.js', import.meta.url), 'utf8');

test('the Booking.com banner uses the same CJ deep link as affiliate-links.js', () => {
  assert.ok(ads.includes(`const CJ_DEEP = '${CJ_CLICK_HOST}/click-${CJ_PID}-${CJ_BOOKING_LINK_ID}?url=';`));
});

test('the banner is a Sponsored CJ link that lands on our own Booking.com pages', () => {
  assert.match(ads, /rel="sponsored noopener"/);
  assert.match(ads, /'Sponsored'/);
  assert.match(ads, /const OWN_BOOKING = \[\s*'https:\/\/www\.booking\.com\/hotel\/in\/rishikesh-homestay-luxury-3-bhk-ganges-hill-view-by-the-ghats\.en-gb\.html',\s*'https:\/\/www\.booking\.com\/hotel\/in\/yoga-retreat-at-the-ganges-in-rishikesh\.html',/);
  assert.ok(!/Our own homestays first/.test(ads), 'the ours-first block is gone');
});

test('stays lists get breaks between rows and groups; the Booking.com widget is on rentals and 404 but never on booking or enquiry pages', () => {
  assert.match(ads, /sxbreaks\(/);
  assert.match(ads, /MAX_BREAKS = \d+/);
  assert.match(ads, /LEAD_WIDGET = Object\.keys\(LEAD\)\.filter\(\(p\) => \/-rental-in-\/\.test\(p\)\)/);
  assert.match(ads, /dataset\.i18nPage === '404'/);
  const lead = ads.slice(ads.indexOf('const LEAD = {'), ads.indexOf('function pageType'));
  assert.ok(lead.includes("'/homestays': 'article'"));
  for (const page of ['/contact', '/thanks', '/list-your-homestay', '/report-a-bug', '/hotels/stay']) assert.ok(!lead.includes(`'${page}'`), page);
});

test('AdSense and Booking.com get an even chance: one fair coin per page view, no stored id', () => {
  assert.match(ads, /crypto\.getRandomValues\(new Uint8Array\(1\)\)\[0\] & 1/);
  assert.match(ads, /const SIDEBAR_BOOKING = coin\(\)/);
  assert.ok(!/MIX_ODD/.test(ads), 'no longer tied to the path');
  const mix = ads.slice(ads.indexOf('const coin'), ads.indexOf('const SIDEBAR_BOOKING') + 80);
  assert.ok(!/localStorage|sessionStorage|cookie/.test(mix));
});
