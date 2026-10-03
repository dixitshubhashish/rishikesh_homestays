import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

test('404 uses corrected, cache-versioned artwork for every responsive source', () => {
  const html = readFileSync('404.html', 'utf8');
  const document = new JSDOM(html, { virtualConsole: new VirtualConsole() }).window.document;
  const sources = [
    document.querySelector('.error-art source').getAttribute('srcset'),
    document.querySelector('.error-stage-image').getAttribute('src'),
    document.querySelector('.error-stage-image-wide').getAttribute('src'),
  ];
  assert.equal(new Set(sources).size, 3);
  for (const source of sources) {
    assert.match(source, /-choti\.webp$/);
    assert.ok(existsSync(`.${source}`), `Missing responsive artwork: ${source}`);
    const bytes = readFileSync(`.${source}`);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  assert.equal(document.querySelector('.error-choti'), null, 'Hair must be part of the artwork');
});
