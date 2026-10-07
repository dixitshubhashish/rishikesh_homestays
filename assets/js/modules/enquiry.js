// The one place the site sends an enquiry to /api/contact (docs/ARCHITECTURE.md "Enquiries").
//
// Every form (contact, rental, host application, WhatsApp popup, booking lead gate, stay popup) builds its own
// fields and validates its own inputs, then hands the payload to postEnquiry(). Keeping the request, the
// `source` names and the response shape here means the data the team and BigQuery receive stays in step: change
// the endpoint, a header or a source name once. tests/modules/enquiry.test.js fails when another file posts to
// /api/contact itself.
//
// The captcha (captcha.js, a self-hosted proof of work) is attached here too: one solved payload per request goes
// in the "captcha" field, the submit button shows "Checking you are not a bot…" while it is worked out, and one
// retry with a fresh challenge happens on captcha_failed. Nothing is attached while the server has no
// CAPTCHA_SECRET.
//
// The server's matching rules are in api/contact.js (`source` decides the email: stay_* and ota_redirect_* leads
// are internal-only, rental_enquiry and host_application have their own subjects).

import { withCaptcha } from './captcha.js';

export const ENQUIRY_ENDPOINT = '/api/contact';

// Every `source` a page sends (website_form is the server's default when a payload has none).
export const SOURCES = {
  contact: 'website_form',
  whatsapp: 'whatsapp_widget',
  host: 'host_application',
  rental: 'rental_enquiry',
  stayEnquiry: 'stay_enquiry',
  bugReport: 'bug_report'
};

const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_');
// "ota_redirect_booking_com": a click-through from our own listing to a booking site.
export const otaRedirectSource = (siteName) => `ota_redirect_${slug(siteName)}`;
// "stay_redirect_agoda": the stay-page popup, then a redirect to that stay's booking page.
export const stayRedirectSource = (siteName) => `stay_redirect_${slug(siteName)}`;

// POSTs the enquiry. Resolves with the server's JSON plus `ok` (HTTP ok and `success: true`) and `status`;
// rejects only when the network fails, like fetch. An unreadable response counts as a failure with no message.
// `button` (optional): the submit button, which reads "Checking you are not a bot…" while the captcha is solved.
// A captcha_failed answer (after its one retry) has `code: 'captcha_failed'` and the site's own friendly message.
export async function postEnquiry(payload, { button } = {}) {
  return withCaptcha(async (captcha) => {
    const response = await fetch(ENQUIRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(captcha ? { ...payload, captcha } : payload)
    });
    const result = await response.json().catch(() => ({ success: false }));
    return { ...result, ok: response.ok && result.success === true, status: response.status };
  }, { button });
}
