import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Every page carries the dark/light theme head snippet (sets <html data-theme>
// before the first paint, so there is no flash of the wrong theme) and exactly
// one header toggle. Discovered from disk like analytics.test.js, so a new page
// that misses them fails here. Generated stays pages copy both from thanks.html
// at the next `npm run build:stays`: until that first build none of them has
// the snippet and they are reported as todo; once any has it, all must.
const root = process.cwd();
const pages = [
  ...readdirSync(root).filter((f) => f.endsWith('.html')),
  ...readdirSync(join(root, 'hotels')).filter((f) => f.endsWith('.html')).map((f) => `hotels/${f}`),
];
const read = (p) => readFileSync(join(root, p), 'utf-8');
const isGenerated = (html) => /modules\/(stays-index|stay-page|landmark-map)\.js/.test(html);

const ADS = '<script async src="/assets/js/ads.js"></script>';
const META = '<meta name="theme-color" content="#fbfaf5">';
// The snippet, as it must appear (byte for byte) in every page.
const SNIPPET = `<script>/* theme before first paint, see assets/js/modules/theme-toggle.js */(function(){var t,d=document.documentElement;try{t=localStorage.getItem('rh-theme')}catch(e){}if(t!=='dark'&&t!=='light')t='light';d.setAttribute('data-theme',t);d.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==='dark'?'#0f1715':'#fbfaf5'})()</script>`;

function problems(page, html) {
  const out = [];
  const head = html.slice(0, html.indexOf('</head>'));
  const adsAt = head.indexOf(ADS);
  const metaAt = head.indexOf(META);
  const snipAt = head.indexOf(SNIPPET);
  const cssAt = head.search(/<link rel="stylesheet"/);
  if (snipAt === -1) return [`${page}: theme head snippet missing`];
  if (!(adsAt !== -1 && adsAt < snipAt)) out.push(`${page}: theme snippet should come after the ads.js line`);
  if (cssAt !== -1 && snipAt > cssAt) out.push(`${page}: theme snippet should come before the first stylesheet`);
  if (metaAt === -1 || metaAt > snipAt) out.push(`${page}: <meta name="theme-color"> should come just before the snippet`);
  if ((html.match(/<meta name="theme-color"/g) || []).length !== 1) out.push(`${page}: exactly one theme-color meta`);
  const toggles = html.match(/<[^>]*\bdata-theme-toggle\b[^>]*>/g) || [];
  if (toggles.length !== 1) out.push(`${page}: exactly one [data-theme-toggle], found ${toggles.length}`);
  else {
    const btn = toggles[0];
    if (!/^<button\b/.test(btn) || !/type="button"/.test(btn)) out.push(`${page}: the toggle should be a <button type="button">`);
    if (!/aria-label="Dark theme"/.test(btn) || !/aria-pressed="false"/.test(btn)) out.push(`${page}: the toggle needs aria-label="Dark theme" and aria-pressed="false"`);
    const header = html.match(/<header class="site-header">[\s\S]*?<\/header>/);
    if (!header || !header[0].includes('data-theme-toggle')) out.push(`${page}: the toggle belongs in the site header`);
    else if (header[0].indexOf('data-theme-toggle') > header[0].indexOf('data-nav-toggle')) out.push(`${page}: the toggle should come before the menu button`);
  }
  if (!/<script type="module" src="\/assets\/js\/site\.js"><\/script>/.test(html)) out.push(`${page}: site.js (which starts theme-toggle.js) should load as a module`);
  return out;
}

test('every hand-made page has the theme snippet and one toggle', () => {
  const hand = pages.filter((p) => !isGenerated(read(p)));
  assert(hand.length >= 15, `expected the hand-made pages, found ${hand.length}`);
  assert(hand.includes('thanks.html'), 'thanks.html is the shell for the generated pages');
  assert.deepStrictEqual(hand.flatMap((p) => problems(p, read(p))), []);
});

test('every generated stays page has the theme snippet and one toggle', (t) => {
  const gen = pages.filter((p) => isGenerated(read(p)));
  assert(gen.length > 0);
  const withIt = gen.filter((p) => read(p).includes('data-theme-toggle'));
  if (withIt.length === 0) {
    t.todo(`${gen.length} generated pages get the theme snippet at the next npm run build:stays`);
    return;
  }
  assert.deepStrictEqual(gen.flatMap((p) => problems(p, read(p))), []);
});

test('styles.css has the dark block, the logo chip and the toggle styles', () => {
  const css = read('assets/css/styles.css');
  assert(css.includes(':root[data-theme="dark"] {'), 'dark token block');
  assert(/color-scheme:\s*dark/.test(css) && /color-scheme:\s*light/.test(css), 'color-scheme for both themes');
  assert(css.includes('.theme-toggle {'), 'toggle styles');
  assert(/:root\[data-theme="dark"\] \.nav-drawer-logo/.test(css), 'white chip behind the logo in dark');
});
