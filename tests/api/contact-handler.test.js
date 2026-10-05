// Behaviour tests for api/contact.js with BigQuery and Resend replaced by
// stand-ins (the resend SDK ignores a stubbed globalThis.fetch, so it is
// swapped out through createContactHandler instead). Nothing here touches
// the network, BigQuery or a real inbox.
import test from 'node:test';
import assert from 'node:assert';

// Belt and braces: no real Resend key or BigQuery credentials in this
// process, even if the handler's own defaults were ever reached. dotenv does
// not override variables that are already set.
process.env.RESEND_API_KEY = '';
process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '';

const { createContactHandler, normalizePageLang } = await import('../../api/contact.js');
const { addMissingColumns, schema } = await import('../../scripts/setup-bigquery.js');

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function setup({ insertError, sendError } = {}) {
  const inserted = [];
  const sent = [];
  const handler = createContactHandler({
    insertEnquiry: async (row) => {
      if (insertError) throw insertError;
      inserted.push(row);
    },
    sendEmail: async (message) => {
      if (sendError) throw sendError;
      sent.push(message);
      return { data: { id: 'test' } };
    }
  });
  return { handler, inserted, sent };
}

const validBody = (extra = {}) => ({
  name: 'Asha',
  phone: '+919876543210',
  details: 'Two nights near Tapovan',
  ...extra
});

const post = async (handler, body) => {
  const res = mockRes();
  await handler({ method: 'POST', body, headers: {}, connection: {} }, res);
  return res;
};

// Silence the handler's own console output for the failure paths.
function quietly(fn) {
  return async () => {
    const { log, error, warn } = console;
    console.log = console.error = console.warn = () => {};
    try { await fn(); } finally { Object.assign(console, { log, error, warn }); }
  };
}

test('unchanged form (no lang) still stores and emails, page_lang defaults to en', quietly(async () => {
  const { handler, inserted, sent } = setup();
  const res = await post(handler, validBody());
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.enquiryId);
  assert.strictEqual(inserted.length, 1);
  assert.strictEqual(inserted[0].page_lang, 'en');
  assert.strictEqual(inserted[0].source, 'website_form');
  assert.strictEqual(sent.length, 1);
  assert.match(sent[0].html, /logged in your database/);
}));

test('lang is stored as page_lang (lowercased); bad values fall back to en', quietly(async () => {
  const { handler, inserted } = setup();
  await post(handler, validBody({ lang: 'HI' }));
  await post(handler, validBody({ lang: 'de' }));
  await post(handler, validBody({ lang: 'hi-IN' }));
  await post(handler, validBody({ lang: '<script>' }));
  assert.deepStrictEqual(inserted.map((r) => r.page_lang), ['hi', 'de', 'en', 'en']);
}));

test('normalizePageLang accepts 2-5 letters only', () => {
  assert.strictEqual(normalizePageLang('he'), 'he');
  assert.strictEqual(normalizePageLang(' TA '), 'ta');
  assert.strictEqual(normalizePageLang('abcde'), 'abcde');
  assert.strictEqual(normalizePageLang('abcdef'), 'en');
  assert.strictEqual(normalizePageLang('x'), 'en');
  assert.strictEqual(normalizePageLang(undefined), 'en');
  assert.strictEqual(normalizePageLang(42), 'en');
});

test('a failed BigQuery insert still sends the email and answers success', quietly(async () => {
  const { handler, sent } = setup({ insertError: new Error('no such field: page_lang') });
  const res = await post(handler, validBody());
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(sent.length, 1, 'email must go out even though storage failed');
  assert.match(sent[0].html, /could NOT be saved to the database/);
}));

test('a failed BigQuery insert still emails the guest (with us cc\'d)', quietly(async () => {
  const { handler, sent } = setup({ insertError: new Error('BigQuery down') });
  const res = await post(handler, validBody({ email: 'asha@example.com' }));
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, 'asha@example.com');
  assert.ok(sent[0].cc);
}));

test('when both storage and email fail the guest gets a 500 with code server_error', quietly(async () => {
  const { handler } = setup({ insertError: new Error('db'), sendError: new Error('resend') });
  const res = await post(handler, validBody());
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, 'server_error');
  assert.ok(res.body.message);
}));

test('every error response has a machine-readable code next to the message', quietly(async () => {
  const { handler, inserted, sent } = setup();
  const cases = [
    [{ method: 'GET' }, 405, 'method_not_allowed'],
    [validBody({ name: '' }), 400, 'missing_fields'],
    [validBody({ phone: '12' }), 400, 'invalid_phone'],
    [validBody({ check_out: '2026-12-02' }), 400, 'checkin_missing'],
    [validBody({ check_in: 'nope', check_out: 'later' }), 400, 'invalid_dates'],
    [validBody({ check_in: '2026-12-05', check_out: '2026-12-05' }), 400, 'checkout_not_after_checkin'],
    [validBody({ source: 'rental_enquiry', check_out: '2026-12-02' }), 400, 'start_date_missing'],
    [validBody({ source: 'rental_enquiry', check_in: '2026-12-05', check_out: '2026-12-04' }), 400, 'end_before_start']
  ];
  for (const [body, status, code] of cases) {
    const res = mockRes();
    if (body.method) {
      await handler({ method: body.method, headers: {}, connection: {} }, res);
    } else {
      await handler({ method: 'POST', body, headers: {}, connection: {} }, res);
    }
    assert.strictEqual(res.statusCode, status, code);
    assert.strictEqual(res.body.success, false, code);
    assert.strictEqual(res.body.code, code);
    assert.strictEqual(typeof res.body.message, 'string');
    assert.ok(res.body.message.length > 0);
  }
  assert.strictEqual(inserted.length, 0);
  assert.strictEqual(sent.length, 0);
}));

test('same-day rental is still accepted', quietly(async () => {
  const { handler, inserted } = setup();
  const res = await post(handler, validBody({ source: 'rental_enquiry', check_in: '2026-12-05', check_out: '2026-12-05' }));
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(inserted[0].page_lang, 'en');
}));

// scripts/setup-bigquery.js: an existing table gains missing columns.
function fakeTable(fields) {
  const calls = [];
  return {
    calls,
    async getMetadata() { return [{ schema: { fields }, etag: 'e1' }]; },
    async setMetadata(md) { calls.push(md); return [md]; }
  };
}

test('setup schema declares page_lang as a nullable STRING', () => {
  const col = schema.find((f) => f.name === 'page_lang');
  assert.deepStrictEqual(col, { name: 'page_lang', type: 'STRING', mode: 'NULLABLE' });
});

test('addMissingColumns adds page_lang to an existing table, keeping its columns', quietly(async () => {
  const existing = schema.filter((f) => f.name !== 'page_lang').map((f) => ({ ...f }));
  const table = fakeTable(existing);
  const added = await addMissingColumns(table);
  assert.deepStrictEqual(added, ['page_lang']);
  assert.strictEqual(table.calls.length, 1);
  const names = table.calls[0].schema.fields.map((f) => f.name);
  assert.deepStrictEqual(names, [...existing.map((f) => f.name), 'page_lang']);
  assert.strictEqual(table.calls[0].etag, 'e1');
}));

test('addMissingColumns is a no-op when every column exists', quietly(async () => {
  const table = fakeTable(schema.map((f) => ({ ...f })));
  assert.deepStrictEqual(await addMissingColumns(table), []);
  assert.strictEqual(table.calls.length, 0);
}));

test('addMissingColumns never adds a REQUIRED column to an existing table', quietly(async () => {
  const table = fakeTable([{ name: 'id', type: 'STRING', mode: 'REQUIRED' }]);
  const added = await addMissingColumns(table, [
    { name: 'id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'must', type: 'STRING', mode: 'REQUIRED' },
    { name: 'page_lang', type: 'STRING', mode: 'NULLABLE' }
  ]);
  assert.deepStrictEqual(added, ['page_lang']);
}));
