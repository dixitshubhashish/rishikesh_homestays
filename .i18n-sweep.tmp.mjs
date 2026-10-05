import { chromium } from 'playwright';
const SP = '/private/tmp/claude-502/-Users-shubhashish-rishikesh-homestays/92564b8c-6e0b-4331-8b1c-9985be727f22/scratchpad/shots';
const [,, pagesArg, langsArg, wArg] = process.argv;
const browser = await chromium.launch();
for (const lang of langsArg.split(',')) for (const w of wArg.split(',').map(Number)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const p of pagesArg.split(',')) {
    await page.goto('http://localhost:3917' + p + '?lang=' + lang, { waitUntil: 'load' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('rh-i18n-wait'), null, { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    const o = await page.evaluate(() => {
      const cw = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.right > cw + 1 && getComputedStyle(el).position !== 'fixed'; }).slice(0, 3).map((el) => el.tagName + '.' + el.className);
      return { overflow: document.documentElement.scrollWidth - cw, wide, lang: document.documentElement.lang };
    });
    console.log(lang, w, p, JSON.stringify(o));
    if (o.overflow > 0) await page.screenshot({ path: `${SP}/ovf-${lang}-${w}-${p.replace(/\W+/g, '_')}.png` });
  }
  if (errors.length) console.log('ERRORS', lang, w, errors);
  await ctx.close();
}
await browser.close();
