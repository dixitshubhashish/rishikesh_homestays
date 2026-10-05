import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES } from '../../scripts/i18n/extract.mjs';
import { SNIPPET } from '../../scripts/i18n/snippet.mjs';
import { LANGS } from '../../scripts/i18n/build-runtime.mjs';
import { LANGUAGES } from '../../assets/js/modules/lang-picker.js';

const root = process.cwd();

// One English page per URL, translated in the browser: every hand-made page
// (and thanks.html, whose head the generated stays pages copy) carries the
// same rh-i18n snippet. Fix with: node scripts/i18n/snippet.mjs
test('every hand-made page has the current rh-i18n head snippet', () => {
  for (const page of PAGES) {
    const html = readFileSync(join(root, `${page}.html`), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    assert(head.includes(SNIPPET), `${page}.html: rh-i18n snippet missing or out of date (node scripts/i18n/snippet.mjs)`);
    assert.strictEqual(head.split('rh-i18n:').length, 2, `${page}.html: exactly one snippet`);
    assert(/<html lang="en"/.test(html), `${page}.html: the source page stays English`);
  }
});

test('the snippet, the picker and the build agree on the languages', () => {
  assert.deepStrictEqual(LANGUAGES.map(([code]) => code).filter((c) => c !== 'en').sort(), [...LANGS].sort());
  for (const code of LANGS) assert(SNIPPET.includes(` ${code} `), `snippet lacks ${code}`);
  assert(!SNIPPET.includes('navigator.language'), 'never switch from the browser language (owner, 2026-10-06)');
});

test('site.js builds the language picker on every page', () => {
  const site = readFileSync(join(root, 'assets/js/site.js'), 'utf8');
  assert.match(site, /import \{ setupLangPicker \} from '\.\/modules\/lang-picker\.js'/);
  assert.match(site, /setupLangPicker\(\);/);
});

test('no translated copies of pages: one page, translated on the go', () => {
  assert(!existsSync(join(root, 'hi')), 'the hi/ copies were replaced by the runtime');
  assert(!existsSync(join(root, 'scripts/i18n/render.mjs')));
  const server = readFileSync(join(root, 'server.js'), 'utf8');
  assert(!/\/hi\b/.test(server), 'server.js has no /hi routes');
});

test('built runtime files parse (node scripts/i18n/build-runtime.mjs)', () => {
  for (const code of LANGS) {
    const file = join(root, 'i18n', code, '_common.json');
    if (!existsSync(file)) continue; // not built yet in this checkout
    const common = JSON.parse(readFileSync(file, 'utf8'));
    assert.strictEqual(typeof common.strings, 'object', code);
    assert.strictEqual(typeof common.patterns, 'object', code);
  }
});
