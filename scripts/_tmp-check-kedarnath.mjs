import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push('pageerror: ' + err.message));

await page.goto('http://localhost:3000/pages/kedarnath-yatra');
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const footer = document.querySelector('footer');
  if (!footer) return { exists: false };
  const rect = footer.getBoundingClientRect();
  const style = getComputedStyle(footer);
  return {
    exists: true,
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    height: rect.height,
    width: rect.width,
    top: rect.top,
    innerHTMLLength: footer.innerHTML.length,
  };
});
console.log('footer info:', JSON.stringify(info, null, 2));
console.log('console errors:', JSON.stringify(errors, null, 2));

await page.screenshot({ path: '/tmp/kedarnath-full.png', fullPage: true });
await browser.close();
