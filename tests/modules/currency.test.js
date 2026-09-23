import test from 'node:test';
import assert from 'node:assert';
import { convertFromINR, formatConverted, detectVisitorCurrency, getRates, _resetRatesCacheForTests } from '../../assets/js/modules/currency.js';
import { _resetGeoCacheForTests } from '../../assets/js/modules/geo.js';

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
    _resetGeoCacheForTests();
    const originalFetch = global.fetch;
    global.fetch = () => Promise.reject(new Error('network down'));
    const result = await detectVisitorCurrency(500);
    assert.strictEqual(result, null);
    global.fetch = originalFetch;
  });
});

test('getRates', async (t) => {
  await t.test('returns the live rates from /api/currency-rates on success', async () => {
    _resetRatesCacheForTests();
    const originalFetch = global.fetch;
    const liveRates = { USD: 0.013, EUR: 0.012, GBP: 0.01, AUD: 0.019, CAD: 0.017, JPY: 1.9 };
    global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ rates: liveRates }) });
    const result = await getRates(500);
    assert.deepStrictEqual(result, liveRates);
    global.fetch = originalFetch;
  });

  await t.test('falls back to the static rates when the request fails', async () => {
    _resetRatesCacheForTests();
    const originalFetch = global.fetch;
    global.fetch = () => Promise.reject(new Error('network down'));
    const result = await getRates(500);
    // Same values as convertFromINR's default fallback — spot-check one.
    assert.strictEqual(result.USD, 0.012);
    global.fetch = originalFetch;
  });

  await t.test('falls back to the static rates when the response has no rates field', async () => {
    _resetRatesCacheForTests();
    const originalFetch = global.fetch;
    global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    const result = await getRates(500);
    assert.strictEqual(result.USD, 0.012);
    global.fetch = originalFetch;
  });
});

test('convertFromINR / formatConverted with explicit rates', async (t) => {
  await t.test('uses the passed-in rates instead of the default fallback', () => {
    const customRates = { USD: 0.02 };
    // 12800 * 0.02 = 256 -> rounds up to the nearest 5 -> 260
    assert.strictEqual(convertFromINR(12800, 'USD', customRates), 260);
    assert.strictEqual(formatConverted(12800, 'USD', customRates), '≈ $260');
  });
});
