import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { validatePhone, validateDateRange } from '../../assets/js/modules/validators.js';

// Load the real libphonenumber-js vendor bundle the same way a browser
// <script src="..."> tag would (a plain global-scope UMD execution), so
// these tests exercise the actual per-country validation rules rather than
// a mock. jsdom's own window.eval() subtly breaks this UMD bundle (it ends
// up missing the country-calling-code prefix), so load it via a bare vm
// sandbox instead and attach the result onto the jsdom window.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
const bundleCode = fs.readFileSync('assets/vendor/libphonenumber/libphonenumber-min.js', 'utf8');
const sandbox = {};
sandbox.window = sandbox;
vm.runInNewContext(bundleCode, sandbox);
dom.window.libphonenumber = sandbox.libphonenumber;

global.window = dom.window;
global.document = dom.window.document;

test('validatePhone', async (t) => {
  await t.test('rejects empty input', () => {
    const result = validatePhone('', 'IN');
    assert.strictEqual(result.valid, false);
    assert.match(result.message, /required/i);
  });

  await t.test('rejects when no country is selected', () => {
    const result = validatePhone('9876543210', '');
    assert.strictEqual(result.valid, false);
    assert.match(result.message, /country/i);
  });

  await t.test('accepts a valid Indian mobile number', () => {
    const result = validatePhone('9876543210', 'IN');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.normalized, '+919876543210');
  });

  await t.test('accepts an Indian number with spaces', () => {
    const result = validatePhone('98765 43210', 'IN');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.normalized, '+919876543210');
  });

  await t.test('rejects a too-short Indian number', () => {
    const result = validatePhone('12345', 'IN');
    assert.strictEqual(result.valid, false);
  });

  await t.test('rejects an Indian number starting with 0 (not a valid leading digit)', () => {
    const result = validatePhone('0234567890', 'IN');
    assert.strictEqual(result.valid, false);
  });

  await t.test('accepts a valid US number for US country code', () => {
    const result = validatePhone('2015550123', 'US');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.normalized, '+12015550123');
  });

  await t.test('rejects a valid Indian number when checked against the wrong country', () => {
    const result = validatePhone('9876543210', 'US');
    assert.strictEqual(result.valid, false);
  });
});

test('validateDateRange', async (t) => {
  await t.test('valid when both dates are empty', () => {
    assert.strictEqual(validateDateRange('', '').valid, true);
  });

  await t.test('invalid when only check-out is given', () => {
    const result = validateDateRange('', '2026-10-10');
    assert.strictEqual(result.valid, false);
    assert.match(result.message, /check-in/i);
  });

  await t.test('valid when check-out is after check-in', () => {
    const result = validateDateRange('2026-10-05', '2026-10-08');
    assert.strictEqual(result.valid, true);
  });

  await t.test('invalid when check-out equals check-in', () => {
    const result = validateDateRange('2026-10-05', '2026-10-05');
    assert.strictEqual(result.valid, false);
    assert.match(result.message, /after/i);
  });

  await t.test('invalid when check-out is before check-in', () => {
    const result = validateDateRange('2026-10-08', '2026-10-05');
    assert.strictEqual(result.valid, false);
  });

  await t.test('invalid when a date string cannot be parsed', () => {
    const result = validateDateRange('not-a-date', '2026-10-08');
    assert.strictEqual(result.valid, false);
  });
});
