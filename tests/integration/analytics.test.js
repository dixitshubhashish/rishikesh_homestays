import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Discovered from disk rather than a hardcoded list, so a newly added page
// that forgets the analytics include fails here instead of silently going
// untracked.
const root = process.cwd();
const pages = [
  ...readdirSync(root).filter((f) => f.endsWith('.html')),
  ...readdirSync(join(root, 'hotels')).filter((f) => f.endsWith('.html')).map((f) => `hotels/${f}`)
];
const INCLUDE = '<script async src="/assets/js/analytics.js"></script>';

test('every page loads the shared analytics include near the top of <head>', () => {
  assert(pages.length > 0);
  for (const page of pages) {
    const html = readFileSync(join(root, page), 'utf-8');
    const head = html.slice(0, html.indexOf('</head>'));
    const charsetAt = head.indexOf('<meta charset');
    const includeAt = head.indexOf(INCLUDE);
    assert(includeAt !== -1, `${page} should include ${INCLUDE} in <head>`);
    // Only whitespace between <meta charset> and the include.
    const between = head.slice(head.indexOf('>', charsetAt) + 1, includeAt);
    assert.strictEqual(between.trim(), '', `${page}: include should come right after <meta charset>`);
    assert(!/GTM-|G-[A-Z0-9]{6,}|gtag\/js/.test(html), `${page} should not hardcode a Google tag — it lives in assets/js/analytics.js (one tag per page)`);
  }
});

test('analytics.js holds the GA4 measurement ID and loads only gtag.js', () => {
  const js = readFileSync(join(root, 'assets/js/analytics.js'), 'utf-8');
  assert.match(js, /const GA_MEASUREMENT_ID = 'G-[A-Z0-9]+';/);
  assert(js.includes('googletagmanager.com/gtag/js'));
  assert(!js.includes('gtm.js'), 'GTM must not also load, or page views double-count');
});
