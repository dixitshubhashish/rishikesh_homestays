import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import {
  setupRentalForm,
  buildRentalDetails,
  buildRentalPayload,
  buildRentalWhatsAppMessage,
  needsNotes,
  serviceLabel
} from '../../assets/js/modules/rental-form.js';

// Real libphonenumber vendor bundle, loaded the way validators.test.js does
// (a bare vm sandbox; jsdom's own eval breaks this UMD bundle).
const bundleCode = fs.readFileSync('assets/vendor/libphonenumber/libphonenumber-min.js', 'utf8');
const sandbox = {};
sandbox.window = sandbox;
vm.runInNewContext(bundleCode, sandbox);

// Mirrors the form markup in bike-and-taxi-rental-in-rishikesh.html.
const FORM_HTML = `
  <form id="rentalForm">
    <input id="rental_name" name="name">
    <select id="rental_country" name="country"></select>
    <input id="rental_phone" name="phone">
    <span id="rental-phone-error" hidden></span>
    <input id="rental_email" name="email">
    <select id="rental_service" name="service">
      <option value="bike" selected>Bike / Scooty</option>
      <option value="taxi_local">Taxi – local</option>
      <option value="taxi_pickup">Taxi – airport/railway pickup</option>
      <option value="taxi_outstation">Taxi – outstation</option>
      <option value="self_drive">Self-drive car</option>
    </select>
    <input id="rental_start" name="start_date">
    <input id="rental_end" name="end_date">
    <span id="rental-dates-error" hidden></span>
    <input id="rental_pickup" name="pickup_point">
    <input id="rental_people" name="people">
    <span id="rental-description-hint"></span>
    <textarea id="rental_description" name="description"></textarea>
    <span id="rental-description-error" hidden></span>
    <p data-form-status></p>
    <button type="submit">Send rental enquiry</button>
    <button type="button" data-rental-whatsapp>Send on WhatsApp</button>
  </form>`;

// Fresh page + stubs per test: fetch (records calls, answers /api/contact),
// window.open, FormData (Node's own can't read a jsdom form) and a redirect
// spy instead of a real navigation.
function setup(t, { apiResult = { success: true } } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${FORM_HTML}</body>`, { url: 'http://localhost/bike-and-taxi-rental-in-rishikesh' });
  dom.window.libphonenumber = sandbox.libphonenumber;
  global.window = dom.window;
  global.document = dom.window.document;
  const realFormData = globalThis.FormData;
  const realFetch = globalThis.fetch;
  globalThis.FormData = dom.window.FormData;
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, body: opts.body ? JSON.parse(opts.body) : null });
    return { json: async () => apiResult };
  };
  const opened = [];
  dom.window.open = (url) => { opened.push(url); };
  const redirects = [];
  t.after(() => {
    globalThis.FormData = realFormData;
    globalThis.fetch = realFetch;
  });

  setupRentalForm({ redirect: (url) => redirects.push(url), autoDetectCountry: false });

  const $ = (sel) => document.querySelector(sel);
  const fill = (values) => {
    for (const [id, value] of Object.entries(values)) {
      const el = $(`#${id}`);
      el.value = value;
      el.dispatchEvent(new dom.window.Event('change'));
    }
  };
  const submit = async () => {
    $('#rentalForm').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    // Let the async submit handler (fetch + json) settle.
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  };
  const apiCalls = () => calls.filter((c) => c.url === '/api/contact');
  return { $, fill, submit, apiCalls, opened, redirects };
}

test('rental-form helpers', async (t) => {
  await t.test('only the car/taxi options need a description', () => {
    assert.strictEqual(needsNotes('bike'), false);
    for (const v of ['taxi_local', 'taxi_pickup', 'taxi_outstation', 'self_drive']) {
      assert.strictEqual(needsNotes(v), true, v);
    }
    assert.strictEqual(serviceLabel('taxi_outstation'), 'Taxi – outstation');
  });

  await t.test('details text carries service, dates, pickup, people and notes', () => {
    const details = buildRentalDetails({
      service: 'taxi_outstation', start_date: '2030-05-01', end_date: '2030-05-04',
      pickup_point: 'Tapovan', people: '4', description: 'Kedarnath, Innova, 4 bags'
    });
    assert.match(details, /Service: Taxi – outstation/);
    assert.match(details, /Dates: 2030-05-01 to 2030-05-04/);
    assert.match(details, /Pickup point: Tapovan/);
    assert.match(details, /People: 4/);
    assert.match(details, /Notes: Kedarnath, Innova, 4 bags/);
  });

  await t.test('details are never empty, even with only a service picked', () => {
    const details = buildRentalDetails({ service: 'bike' });
    assert.match(details, /Service: Bike \/ Scooty/);
    assert.match(details, /Dates: Not decided yet/);
    assert.match(details, /Notes: none/);
  });

  await t.test('payload maps dates to check_in/check_out and tags the source', () => {
    const payload = buildRentalPayload({
      name: ' Asha ', phone: '+919876543210', service: 'bike',
      start_date: '2030-05-01', end_date: '2030-05-01', people: '2'
    });
    assert.strictEqual(payload.source, 'rental_enquiry');
    assert.strictEqual(payload.name, 'Asha');
    assert.strictEqual(payload.service, 'Bike / Scooty');
    assert.strictEqual(payload.check_in, '2030-05-01');
    assert.strictEqual(payload.check_out, '2030-05-01');
    assert.strictEqual(payload.people, 2);
    assert.match(payload.details, /Dates: 2030-05-01\n/);
  });

  await t.test('WhatsApp message lists what was filled in', () => {
    const msg = buildRentalWhatsAppMessage({ name: 'Asha', service: 'taxi_pickup', pickup_point: 'Jolly Grant airport' });
    assert.match(msg, /Need: Taxi – airport\/railway pickup/);
    assert.match(msg, /Pickup point: Jolly Grant airport/);
    assert(!/[•✅]/.test(msg), 'no emoji/unicode bullets');
  });
});

test('rental form submission', async (t) => {
  await t.test('valid bike enquiry posts to /api/contact with an E.164 phone, then goes to /thanks', async (t) => {
    const { fill, submit, apiCalls, redirects } = setup(t);
    fill({ rental_name: 'Asha', rental_country: 'IN', rental_phone: '98765 43210', rental_start: '2030-05-01', rental_end: '2030-05-01', rental_pickup: 'Tapovan', rental_people: '2' });
    await submit();
    assert.strictEqual(apiCalls().length, 1);
    const body = apiCalls()[0].body;
    assert.strictEqual(body.phone, '+919876543210');
    assert.strictEqual(body.source, 'rental_enquiry');
    assert.strictEqual(body.service, 'Bike / Scooty');
    assert.strictEqual(body.check_in, '2030-05-01');
    assert.strictEqual(body.pickup_point, 'Tapovan');
    assert.match(body.details, /People: 2/);
    assert.deepStrictEqual(redirects, ['/thanks']);
  });

  await t.test('invalid phone shows an error and sends nothing', async (t) => {
    const { $, fill, submit, apiCalls } = setup(t);
    fill({ rental_name: 'Asha', rental_country: 'IN', rental_phone: '123' });
    await submit();
    assert.strictEqual(apiCalls().length, 0);
    assert.strictEqual($('#rental-phone-error').hidden, false);
    assert($('#rental_phone').classList.contains('field-invalid'));
  });

  await t.test('a taxi needs a description: the box becomes required and an empty one blocks sending', async (t) => {
    const { $, fill, submit, apiCalls } = setup(t);
    assert.strictEqual($('#rental_description').required, false);
    fill({ rental_name: 'Asha', rental_country: 'IN', rental_phone: '9876543210', rental_service: 'taxi_outstation' });
    assert.strictEqual($('#rental_description').required, true);
    assert.match($('#rental-description-hint').textContent, /required/);
    await submit();
    assert.strictEqual(apiCalls().length, 0);
    assert.strictEqual($('#rental-description-error').hidden, false);

    fill({ rental_description: 'Rishikesh to Kedarnath and back, 4 days, Innova' });
    await submit();
    assert.strictEqual(apiCalls().length, 1);
    assert.match(apiCalls()[0].body.details, /Notes: Rishikesh to Kedarnath/);
  });

  await t.test('an end date before the start date is rejected', async (t) => {
    const { $, fill, submit, apiCalls } = setup(t);
    fill({ rental_name: 'Asha', rental_country: 'IN', rental_phone: '9876543210', rental_start: '2030-05-03', rental_end: '2030-05-01' });
    await submit();
    assert.strictEqual(apiCalls().length, 0);
    assert.strictEqual($('#rental-dates-error').hidden, false);
  });

  await t.test('an API error shows a message, restores the button and stays on the page', async (t) => {
    const { $, fill, submit, apiCalls, redirects } = setup(t, { apiResult: { success: false, message: 'Nope' } });
    fill({ rental_name: 'Asha', rental_country: 'IN', rental_phone: '9876543210' });
    await submit();
    assert.strictEqual(apiCalls().length, 1);
    assert.strictEqual($('[data-form-status]').textContent, 'Nope');
    const btn = $('button[type="submit"]');
    assert.strictEqual(btn.disabled, false);
    assert.strictEqual(btn.textContent, 'Send rental enquiry');
    assert.deepStrictEqual(redirects, []);
  });

  await t.test('the WhatsApp button opens a prefilled chat without posting', async (t) => {
    const { $, fill, apiCalls, opened } = setup(t);
    fill({ rental_name: 'Asha', rental_country: 'IN', rental_phone: '9876543210', rental_service: 'self_drive' });
    $('[data-rental-whatsapp]').click();
    assert.strictEqual(opened.length, 1);
    assert.match(opened[0], /918050091290/);
    const text = decodeURIComponent(opened[0].split('text=')[1]);
    assert.match(text, /Need: Self-drive car/);
    assert.match(text, /Phone: \+919876543210/);
    assert.strictEqual(apiCalls().length, 0);
  });
});
