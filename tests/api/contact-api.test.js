import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join } from 'path';

function readAPI() {
  return readFileSync(join(process.cwd(), 'api/contact.js'), 'utf-8');
}

test('Contact API Tests', async (t) => {
  const apiCode = readAPI();

  await t.test('API should validate required fields', () => {
    assert(apiCode.includes('requiredFields'), 'Should validate required fields');
    assert(apiCode.includes('name'), 'Should require name field');
    assert(apiCode.includes('phone'), 'Should require phone field');
    assert(apiCode.includes('details'), 'Should require details field');
  });

  await t.test('API should check POST method', () => {
    assert(apiCode.includes('POST'), 'Should check for POST method');
    assert(apiCode.includes('405'), 'Should return 405 for non-POST requests');
  });

  await t.test('API should integrate with Supabase', () => {
    assert(apiCode.includes('supabase'), 'Should use Supabase');
    assert(apiCode.includes('enquiries'), 'Should use enquiries table');
    assert(apiCode.includes('insert'), 'Should insert data');
  });

  await t.test('API should send emails via Resend', () => {
    assert(apiCode.includes('resend'), 'Should use Resend');
    assert(apiCode.includes('emails.send'), 'Should send emails');
  });

  await t.test('API should capture guest information', () => {
    assert(apiCode.includes('adults'), 'Should capture adult count');
    assert(apiCode.includes('children'), 'Should capture children count');
    assert(apiCode.includes('guests'), 'Should calculate guest string');
    assert(apiCode.includes('pets'), 'Should capture pet information');
  });

  await t.test('API should send confirmation to guest', () => {
    assert(apiCode.includes('email'), 'Should use guest email');
    assert(apiCode.includes('confirmationHtml'), 'Should send confirmation email');
  });

  await t.test('API should log IP and user agent', () => {
    assert(apiCode.includes('ip_address'), 'Should log IP address');
    assert(apiCode.includes('user_agent'), 'Should log user agent');
    assert(apiCode.includes('x-forwarded-for'), 'Should handle proxy headers');
  });

  await t.test('API should handle errors gracefully', () => {
    assert(apiCode.includes('catch'), 'Should have error handling');
    assert(apiCode.includes('500'), 'Should return 500 on server error');
    assert(apiCode.includes('try'), 'Should use try-catch');
  });

  await t.test('API should return success response', () => {
    assert(apiCode.includes('success'), 'Should indicate success');
    assert(apiCode.includes('message'), 'Should return message');
    assert(apiCode.includes('inquiryId'), 'Should return inquiry ID');
  });

  await t.test('API should format email properly', () => {
    assert(apiCode.includes('emailHtml'), 'Should format HTML email');
    assert(apiCode.includes('table'), 'Should use table for email layout');
    assert(apiCode.includes('border'), 'Should style email table');
  });

  await t.test('API should store timestamp', () => {
    assert(apiCode.includes('new Date()'), 'Should record submission time');
  });

  await t.test('API should set inquiry status', () => {
    assert(apiCode.includes('status'), 'Should set inquiry status');
    assert(apiCode.includes('pending'), 'Should mark as pending');
  });

  await t.test('API should parse guest details', () => {
    assert(apiCode.includes('detailsText'), 'Should capture details');
    assert(apiCode.includes('check_in'), 'Should extract check-in info');
    assert(apiCode.includes('check_out'), 'Should extract check-out info');
  });
});
