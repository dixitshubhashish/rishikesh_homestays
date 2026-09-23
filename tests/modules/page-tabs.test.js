import test from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { setupPageTabs } from '../../assets/js/modules/page-tabs.js';

function buildDom(url = 'http://localhost/pages/places-to-visit') {
  const dom = new JSDOM(`
    <div class="page-tabs">
      <button data-tab-target="places">Places to Visit</button>
      <button data-tab-target="restaurants">Restaurants & Cafes</button>
    </div>
    <section data-tab-panel="places">Places content</section>
    <section data-tab-panel="restaurants" hidden>Restaurants content</section>
  `, { url });
  global.document = dom.window.document;
  global.window = dom.window;
  global.history = dom.window.history;
  // jsdom doesn't implement scroll/layout APIs (it's a DOM emulation, not a
  // real rendering engine) — scrollIntoView is standard in every real
  // browser, just missing here, so stub it to keep test output clean.
  dom.window.Element.prototype.scrollIntoView = () => {};
  return dom;
}

test('setupPageTabs', async (t) => {
  await t.test('defaults to the first tab when there is no hash', () => {
    buildDom();
    setupPageTabs();
    assert.strictEqual(document.querySelector('[data-tab-panel="places"]').hidden, false);
    assert.strictEqual(document.querySelector('[data-tab-panel="restaurants"]').hidden, true);
    assert(document.querySelector('[data-tab-target="places"]').classList.contains('is-active'));
  });

  await t.test('honours a valid URL hash on load (deep link)', () => {
    buildDom('http://localhost/pages/places-to-visit#restaurants');
    setupPageTabs();
    assert.strictEqual(document.querySelector('[data-tab-panel="restaurants"]').hidden, false);
    assert.strictEqual(document.querySelector('[data-tab-panel="places"]').hidden, true);
    assert(document.querySelector('[data-tab-target="restaurants"]').classList.contains('is-active'));
  });

  await t.test('falls back to the first tab for an unrecognised hash', () => {
    buildDom('http://localhost/pages/places-to-visit#nonsense');
    setupPageTabs();
    assert.strictEqual(document.querySelector('[data-tab-panel="places"]').hidden, false);
  });

  await t.test('clicking a tab button switches the visible panel', () => {
    buildDom();
    setupPageTabs();
    document.querySelector('[data-tab-target="restaurants"]').click();
    assert.strictEqual(document.querySelector('[data-tab-panel="restaurants"]').hidden, false);
    assert.strictEqual(document.querySelector('[data-tab-panel="places"]').hidden, true);
    assert(document.querySelector('[data-tab-target="restaurants"]').classList.contains('is-active'));
    assert(!document.querySelector('[data-tab-target="places"]').classList.contains('is-active'));
  });

  await t.test('does nothing when the page has no tab buttons', () => {
    const dom = new JSDOM('<p>No tabs here</p>', { url: 'http://localhost/pages/contact' });
    global.document = dom.window.document;
    global.window = dom.window;
    assert.doesNotThrow(() => setupPageTabs());
  });
});
