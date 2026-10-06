// Keeps the translations in step with the English site (docs/I18N.md).
// When one of these fails after an English edit:
//   npm run i18n:extract                       refresh i18n/en.json
//   node scripts/i18n/sync.mjs jobs <dir>      what each language is missing
//   (translate)  node scripts/i18n/sync.mjs merge <dir>
//   node scripts/i18n/build-runtime.mjs        rebuild i18n/dist/
// The stays pages' texts are checked by `npm run i18n:check` (slower), which
// the stays build runs.
import test from 'node:test';
import assert from 'node:assert';
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { buildEnglish, NO_TRANSLATE as EXTRACT_NO } from '../../scripts/i18n/extract.mjs';
import { readEn, LANGS, segId as nodeId } from '../../scripts/i18n/catalog.mjs';
import { NO_TRANSLATE as RUNTIME_NO, compilePatterns, makeLookup, segId } from '../../assets/js/i18n-runtime.js';
import { LANGS as BUILD_LANGS } from '../../scripts/i18n/build-runtime.mjs';
import { LANGS as SYNC_LANGS, problem } from '../../scripts/i18n/sync.mjs';
import { LANGUAGES } from '../../assets/js/modules/lang-picker.js';

const ROOT = join(import.meta.dirname, '..', '..');
const node = (...args) => execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });

test('i18n/en.json "site" matches the pages, the footer and the scripts (run npm run i18n:extract)', async () => {
  const fresh = await buildEnglish({ stays: false });
  assert.deepStrictEqual(readEn().site, fresh.site);
});

test('one flat file per language, ids are content hashes', () => {
  const files = readdirSync(join(ROOT, 'i18n')).sort();
  assert.deepStrictEqual(files.filter((f) => f.endsWith('.json')).sort(), ['en.json', ...LANGS.map((l) => `${l}.json`)].sort());
  for (const old of ['footer', 'ui', 'stays']) assert(!existsSync(join(ROOT, 'i18n', old)), `i18n/${old}/ was folded into the flat files`);
  assert(!files.some((f) => /^qa-/.test(f)), 'house styles live in i18n/STYLE.md');
  const en = readEn();
  for (const part of ['site', 'stays']) for (const [id, t] of Object.entries(en[part])) assert.strictEqual(nodeId(t), id, t.slice(0, 60));
});

test('every language lists the same codes everywhere', () => {
  assert.deepStrictEqual(SYNC_LANGS, BUILD_LANGS);
  assert.deepStrictEqual(LANGUAGES.map(([c]) => c).filter((c) => c !== 'en'), BUILD_LANGS);
});

test('the browser and the extractor skip the same things (brand, contact forms, stay names)', () => {
  assert.strictEqual(RUNTIME_NO, EXTRACT_NO);
  for (const sel of ['form:not([data-search-form])', '.brand', '.sx-name', '[data-stay-name]']) assert.ok(RUNTIME_NO.includes(sel), sel);
});

test('every language has every site text: pages, footer, scripts (sync.mjs check)', () => {
  let out = '';
  try { out = node('scripts/i18n/sync.mjs', 'check', '--no-stays'); } catch (e) { assert.fail(`${e.stdout}\n${e.stderr}`); }
  assert.match(out, /complete/);
});

test('patterns: repeated slots keep their order, names in slots are translated, numbers kept', () => {
  const lookup = makeLookup(
    { [segId('Guest Houses')]: 'गेस्ट हाउस', [segId('Haridwar')]: 'हरिद्वार' },
    compilePatterns([
      ['{n1} of the {n2} {t1} in {t2} allow pets.', '{t2} के {n2} {t1} में से {n1} में पालतू जानवर आ सकते हैं।'],
      ['Take you to {n} on {n}.', 'आपको {n} पर {n} ले जाएँ।'],
      ['{n1} to compare', 'तुलना के लिए {n1}'],
      ['{n1}, {n2} and {n3} star', '{n1}, {n2} और {n3} स्टार'],
    ]),
  );
  assert.strictEqual(lookup('12 of the 340 Guest Houses in Haridwar allow pets.'), 'हरिद्वार के 340 गेस्ट हाउस में से 12 में पालतू जानवर आ सकते हैं।');
  assert.strictEqual(lookup('Take you to Ganga View on Agoda.'), 'आपको Ganga View पर Agoda ले जाएँ।');
  assert.strictEqual(lookup('1,250 to compare'), 'तुलना के लिए 1,250');
  assert.strictEqual(lookup('3, 4 and 5 star'), '3, 4 और 5 स्टार'); // a number slot never swallows the comma
  assert.strictEqual(lookup('Hotels to compare'), null); // a {n1} slot only takes digits
});

test('merge rejects broken placeholders, slots and dropped numbers, allows extra numbers', () => {
  assert.strictEqual(problem('See <0>the map</0>', 'देखें <0>नक्शा</0>'), null);
  assert.match(problem('See <0>the map</0>', 'नक्शा देखें'), /placeholders/);
  assert.match(problem('{n1} stays in {t1}', '{t1} में ठहरने की जगहें'), /slots/);
  assert.match(problem('Open 24 hours', 'हमेशा खुला', true), /numbers/);
  assert.strictEqual(problem('January {n1}', '1月{n1}日', true), null);
});
