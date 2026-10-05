import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const SP = '/private/tmp/claude-502/-Users-shubhashish-rishikesh-homestays/92564b8c-6e0b-4331-8b1c-9985be727f22/scratchpad/shots';
const base = 'http://localhost:3917';
const snippet = readFileSync('thanks.html', 'utf8').match(/<script>\/\* rh-i18n:[\s\S]*?<\/script>/)[0];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let posted = null;
await page.route('**/api/contact', (r) => { posted = r.request().postData(); r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }); });
// generated stays page: inject the snippet as the next build will
await page.route('**/hotels/best-hotels-in-rishikesh*', async (r) => {
  const res = await r.fetch(); let html = await res.text();
  html = html.replace(/(<meta name="viewport"[^>]*>)/, `$1${snippet}`);
  r.fulfill({ response: res, body: html, headers: { ...res.headers(), 'content-type': 'text/html' } });
});
await page.goto(base + '/hotels/best-hotels-in-rishikesh?lang=hi');
await page.waitForTimeout(2500);
console.log('stays', await page.evaluate(() => ({ lang: document.documentElement.lang, nav: [...document.querySelectorAll('.site-nav a')].map(a => a.textContent.trim()).slice(0, 4), foot: document.querySelector('.rhs-footer-stays')?.innerText.slice(0, 120) })));
await page.screenshot({ path: `${SP}/stays-hi.png` });
// internal navigation keeps the language (stored)
await page.goto(base + '/contact');
await page.waitForTimeout(1500);
console.log('contact after nav', await page.evaluate(() => [document.documentElement.lang, document.title]));
// calendar
const cal = await page.evaluate(() => { const i = [...document.querySelectorAll('input')].find(x => x._flatpickr); if (!i) return null; i._flatpickr.open(); return document.querySelector('.flatpickr-calendar.open')?.innerText.slice(0, 120); });
console.log('calendar', cal);
await page.screenshot({ path: `${SP}/cal-hi.png` });
await page.evaluate(() => fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x' }) }));
console.log('posted', posted);
// hero slider after a slide change
await page.goto(base + '/');
await page.waitForTimeout(9000);
console.log('hero', await page.evaluate(() => document.querySelector('.hero-headline')?.textContent));
// back to English via the picker
await page.selectOption('.rhs-footer-bottom-inner .rh-lang-picker select', 'en');
await page.waitForLoadState('load'); await page.waitForTimeout(800);
console.log('english', await page.evaluate(() => [location.search, document.documentElement.lang, localStorage.getItem('rh-lang'), document.title]));
await page.goto(base + '/contact'); await page.waitForTimeout(500);
console.log('english contact', await page.evaluate(() => [document.documentElement.lang, document.title]));
console.log('errors', errors);
await browser.close();
