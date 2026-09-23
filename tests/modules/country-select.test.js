import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { getCountryList, populateCountrySelect, detectCountryByIP } from '../../assets/js/modules/country-select.js';
import { _resetGeoCacheForTests } from '../../assets/js/modules/geo.js';

// See validators.test.js for why this loads via vm instead of
// dom.window.eval() — jsdom's eval subtly breaks this UMD bundle.
const dom = new JSDOM('<!doctype html><html><body><select id="country"></select></body></html>');
const bundleCode = fs.readFileSync('assets/vendor/libphonenumber/libphonenumber-min.js', 'utf8');
const sandbox = {};
sandbox.window = sandbox;
vm.runInNewContext(bundleCode, sandbox);
dom.window.libphonenumber = sandbox.libphonenumber;

global.window = dom.window;
global.document = dom.window.document;

test('getCountryList', async (t) => {
  await t.test('returns a non-empty list built from libphonenumber metadata', () => {
    const countries = getCountryList();
    assert(countries.length > 100, 'should list well over 100 countries');
  });

  await t.test('every entry has iso2, name, dialCode, and flag', () => {
    const countries = getCountryList();
    countries.slice(0, 20).forEach((c) => {
      assert.strictEqual(typeof c.iso2, 'string');
      assert.strictEqual(c.iso2.length, 2);
      assert.strictEqual(typeof c.name, 'string');
      assert(c.name.length > 0);
      assert(c.dialCode !== undefined && c.dialCode !== null);
      assert.strictEqual(typeof c.flag, 'string');
    });
  });

  await t.test('includes India with the correct dial code', () => {
    const countries = getCountryList();
    const india = countries.find((c) => c.iso2 === 'IN');
    assert(india, 'India should be in the list');
    assert.strictEqual(india.dialCode, '91');
  });

  await t.test('is sorted alphabetically by country name', () => {
    const countries = getCountryList();
    for (let i = 1; i < countries.length; i++) {
      const prev = countries[i - 1].name;
      const curr = countries[i].name;
      assert(prev.localeCompare(curr) <= 0, `"${prev}" should sort before "${curr}"`);
    }
  });

  await t.test('caches the list on repeated calls', () => {
    const first = getCountryList();
    const second = getCountryList();
    assert.strictEqual(first, second, 'should return the same cached array reference');
  });
});

test('populateCountrySelect', async (t) => {
  await t.test('fills the select with one option per country', () => {
    const select = document.getElementById('country');
    const countries = populateCountrySelect(select, 'IN');
    assert.strictEqual(select.options.length, countries.length);
  });

  await t.test('defaults to the requested country', () => {
    const select = document.getElementById('country');
    populateCountrySelect(select, 'US');
    assert.strictEqual(select.value, 'US');
  });

  await t.test('falls back to India if the requested default does not exist', () => {
    const select = document.getElementById('country');
    populateCountrySelect(select, 'ZZ');
    assert.strictEqual(select.value, 'IN');
  });

  await t.test('option labels use the compact ISO-code format, not the full name', () => {
    const select = document.getElementById('country');
    populateCountrySelect(select, 'IN');
    const indiaOption = [...select.options].find((o) => o.value === 'IN');
    assert.match(indiaOption.textContent, /\bIN\b/);
    assert.match(indiaOption.textContent, /\+91\b/);
    assert.doesNotMatch(indiaOption.textContent, /India/);
    assert.match(indiaOption.title, /India/);
  });

  await t.test('does nothing gracefully when given a null select element', () => {
    assert.doesNotThrow(() => populateCountrySelect(null, 'IN'));
  });
});

test('detectCountryByIP', async (t) => {
  await t.test('falls back to India when fetch fails', async () => {
    _resetGeoCacheForTests();
    const originalFetch = global.fetch;
    global.fetch = () => Promise.reject(new Error('network down'));
    const result = await detectCountryByIP(500);
    assert.strictEqual(result, 'IN');
    global.fetch = originalFetch;
  });

  await t.test('falls back to India when the response is not ok', async () => {
    _resetGeoCacheForTests();
    const originalFetch = global.fetch;
    global.fetch = () => Promise.resolve({ ok: false });
    const result = await detectCountryByIP(500);
    assert.strictEqual(result, 'IN');
    global.fetch = originalFetch;
  });

  await t.test('uses the detected country code when the lookup succeeds', async () => {
    _resetGeoCacheForTests();
    const originalFetch = global.fetch;
    global.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ country: 'gb' })
    });
    const result = await detectCountryByIP(500);
    assert.strictEqual(result, 'GB');
    global.fetch = originalFetch;
  });

  await t.test('falls back to India when the response has a malformed country code', () => {
    _resetGeoCacheForTests();
    const originalFetch = global.fetch;
    global.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ country: '123' })
    });
    return detectCountryByIP(500).then((result) => {
      assert.strictEqual(result, 'IN');
      global.fetch = originalFetch;
    });
  });
});
