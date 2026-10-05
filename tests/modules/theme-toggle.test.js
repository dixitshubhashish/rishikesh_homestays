import test from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

function setup({ storage = 'ok', theme = 'light' } = {}) {
  const dom = new JSDOM(`<!doctype html><html data-theme="${theme}"><head><meta name="theme-color" content="#fbfaf5"></head><body>
    <button data-theme-toggle aria-label="Dark theme" aria-pressed="false"></button></body></html>`, { url: 'https://rishikeshhomestays.com/' });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.CustomEvent = window.CustomEvent;
  const store = {};
  global.localStorage = storage === 'ok'
    ? { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } }
    : { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  return { window, store };
}

test('theme-toggle', async (t) => {
  const mod = await import('../../assets/js/modules/theme-toggle.js');

  await t.test('click switches to dark, stores it, updates aria-pressed and theme-color', () => {
    const { store } = setup();
    let fired = null;
    document.addEventListener('rh-themechange', (e) => { fired = e.detail.theme; });
    mod.setupThemeToggle();
    const btn = document.querySelector('[data-theme-toggle]');
    btn.click();
    assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark');
    assert.strictEqual(document.documentElement.style.colorScheme, 'dark');
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(btn.getAttribute('aria-label'), 'Dark theme');
    assert.strictEqual(store['rh-theme'], 'dark');
    assert.strictEqual(document.querySelector('meta[name="theme-color"]').content, mod.THEME_COLORS.dark);
    assert.strictEqual(fired, 'dark');
    btn.click();
    assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'light');
    assert.strictEqual(store['rh-theme'], 'light');
  });

  await t.test('aria-pressed reflects a theme set by the head snippet', () => {
    setup({ theme: 'dark' });
    mod.setupThemeToggle();
    assert.strictEqual(document.querySelector('[data-theme-toggle]').getAttribute('aria-pressed'), 'true');
  });

  await t.test('still switches when storage throws', () => {
    setup({ storage: 'blocked' });
    mod.setupThemeToggle();
    assert.strictEqual(mod.storedTheme(), null);
    document.querySelector('[data-theme-toggle]').click();
    assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark');
  });

  await t.test('setup twice does not double-bind the button', () => {
    setup();
    mod.setupThemeToggle();
    mod.setupThemeToggle();
    document.querySelector('[data-theme-toggle]').click();
    assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark');
  });

  await t.test('phase 1 is opt-in (does not follow the system setting yet)', () => {
    assert.strictEqual(mod.FOLLOW_SYSTEM, false);
  });
});
