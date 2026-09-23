import test from 'node:test';
import assert from 'node:assert';
import { convertFromINR, formatConverted, detectVisitorCurrency } from '../../assets/js/modules/currency.js';

test('convertFromINR', async (t) => {
  await t.test('converts and rounds UP to the nearest 5 in the target currency', () => {
    // 12800 INR * 0.012 USD/INR = 153.6 -> rounds up to 155, not 153.6 or 150
    assert.strictEqual(convertFromINR(12800, 'USD'), 155);
  });

  await t.test('rounds up even when already close to a multiple of 5', () => {
    // 3600 * 0.011 = 39.6 -> ceil(39.6/5)*5 = 40
    assert.strictEqual(convertFromINR(3600, 'EUR'), 40);
  });

  await t.test('never rounds down', () => {
    const result = convertFromINR(100, 'GBP'); // 100 * 0.0095 = 0.95 -> 5
    assert.strictEqual(result, 5);
    assert(result >= 100 * 0.0095, 'rounded value should never be less than the raw conversion');
  });

  await t.test('returns null for an unsupported currency code', () => {
    assert.strictEqual(convertFromINR(10000, 'XYZ'), null);
  });
});

test('formatConverted', async (t) => {
  await t.test('formats with the correct symbol and a leading approx marker', () => {
    assert.strictEqual(formatConverted(12800, 'USD'), '≈ $155');
  });

  await t.test('returns null when conversion is not possible', () => {
    assert.strictEqual(formatConverted(12800, 'INR'), null);
  });
});

test('detectVisitorCurrency', async (t) => {
  await t.test('returns null when the geolocation request fails', async () => {
    const originalFetch = global.fetch;
    global.fetch = () => Promise.reject(new Error('network down'));
    // Note: detectVisitorCurrency caches its result across calls within the
    // module's lifetime, but this is the first call in this test file's
    // process, so the network path is still exercised here.
    const result = await detectVisitorCurrency(500);
    assert.strictEqual(result, null);
    global.fetch = originalFetch;
  });
});
