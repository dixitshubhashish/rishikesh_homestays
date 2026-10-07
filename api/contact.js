import 'dotenv/config';
import { Resend } from 'resend';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { validateDateRange, validateRentalDateRange } from '../assets/js/modules/validators.js';
import { insertEnquiry } from './bigquery.js';
import { randomUUID } from 'crypto';
import { verifyCaptcha, CAPTCHA_FAILED_CODE, CAPTCHA_FAILED_MESSAGE } from './captcha.js';

// Every error response carries a machine-readable `code` next to the English
// `message`, so a translated page can show its own wording for the code and
// fall back to the message for codes it doesn't know.
const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, code, message });

// Language of the page the enquiry came from (`lang`, e.g. 'hi'), stored as
// page_lang. Anything that isn't 2-5 letters is ignored, never an error: a
// bad or missing language must not cost us a lead.
export function normalizePageLang(value) {
  const lang = String(value || '').trim().toLowerCase();
  return /^[a-z]{2,5}$/.test(lang) ? lang : 'en';
}

// ---- Bug reports (source 'bug_report', page /report-a-bug) -----------------
// Anonymous by design: no name or phone. The email goes ONLY to CONTACT_EMAIL;
// the reporter's address (optional) is never a recipient, so the form cannot be
// used to send mail to someone else. Everything is untrusted, so every value is
// length-capped, stripped of control characters and HTML-escaped in the email.
export const BUG_TYPES = {
  layout: 'Layout or looks',
  language: 'Translation or language',
  form: 'Form or enquiry',
  stays: 'Stays page',
  search: 'Search',
  map: 'Map',
  speed: 'Speed',
  other: 'Other'
};
export const BUG_SEVERITIES = {
  cosmetic: 'Cosmetic',
  minor: 'Small annoyance',
  serious: 'Serious',
  blocking: 'Blocks booking or enquiry'
};
export const BUG_LIMITS = { summaryMin: 5, summary: 120, steps: 2000, expected: 1000, actual: 1000, device: 300, page: 300, url: 500, email: 254, name: 80 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// One line: control characters (newlines too) become spaces, runs collapse.
const oneLine = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
// Several lines: keep \n, drop every other control character.
const multiLine = (value, max) => String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, max);

// Returns { report } or { code, message }. Required: summary (5-120), steps,
// expected, actual. Everything else is optional; over-long free text is cut,
// not rejected, so a long report is never lost.
export function normalizeBugReport(data) {
  const summary = oneLine(data.summary, 1000);
  const steps = multiLine(data.steps, BUG_LIMITS.steps);
  const expected = multiLine(data.expected, BUG_LIMITS.expected);
  const actual = multiLine(data.actual, BUG_LIMITS.actual);
  if (!summary || !steps || !expected || !actual) {
    return { code: 'missing_fields', message: 'Please complete the required fields before sending your report.' };
  }
  if (summary.length < BUG_LIMITS.summaryMin || summary.length > BUG_LIMITS.summary) {
    return { code: 'invalid_summary', message: `Please describe the problem in ${BUG_LIMITS.summaryMin} to ${BUG_LIMITS.summary} characters.` };
  }
  const bugType = String(data.bug_type || 'other').trim().toLowerCase();
  if (!Object.hasOwn(BUG_TYPES, bugType)) {
    return { code: 'invalid_bug_type', message: 'Please choose what kind of problem this is.' };
  }
  const severity = String(data.severity || 'minor').trim().toLowerCase();
  if (!Object.hasOwn(BUG_SEVERITIES, severity)) {
    return { code: 'invalid_severity', message: 'Please choose how serious the problem is.' };
  }
  const email = oneLine(data.email, 1000);
  if (email && (email.length > BUG_LIMITS.email || !EMAIL_RE.test(email))) {
    return { code: 'invalid_email', message: 'Please provide a valid email address, or leave it empty.' };
  }
  const screenshotUrl = oneLine(data.screenshot_url, 1000);
  if (screenshotUrl) {
    let ok = screenshotUrl.length <= BUG_LIMITS.url;
    try { ok = ok && /^https?:$/.test(new URL(screenshotUrl).protocol); } catch { ok = false; }
    if (!ok) return { code: 'invalid_url', message: 'Please give the screenshot link as a full web address (https://...), or leave it empty.' };
  }
  return {
    report: {
      summary,
      steps,
      expected,
      actual,
      bugType,
      severity,
      page: oneLine(data.page_url, BUG_LIMITS.page),
      device: oneLine(data.device, BUG_LIMITS.device),
      email,
      screenshotUrl,
      name: oneLine(data.name, BUG_LIMITS.name) || 'Anonymous'
    }
  };
}

function bugReportText(r) {
  return [
    `Summary: ${r.summary}`,
    `Type: ${BUG_TYPES[r.bugType]}`,
    `Severity: ${BUG_SEVERITIES[r.severity]}`,
    `Page: ${r.page || 'Not given'}`,
    `Device: ${r.device || 'Not given'}`,
    `Reporter email: ${r.email || 'Not given'}`,
    `Screenshot: ${r.screenshotUrl || 'None'}`,
    '',
    'Steps to reproduce:', r.steps,
    '',
    'Expected:', r.expected,
    '',
    'Actual:', r.actual
  ].join('\n');
}

function bugReportHtml(r, stored, id) {
  const row = (label, value) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#66726f;font-size:13px;width:34%;vertical-align:top;">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#17211f;font-size:14px;vertical-align:top;white-space:pre-wrap;">${value}</td></tr>`;
  const link = (value) => (/^https?:\/\//i.test(value) ? `<a href="${escapeHtml(value)}">${escapeHtml(value)}</a>` : escapeHtml(value || 'Not given'));
  const email = r.email ? `<a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a>` : 'Not given';
  return `<div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;max-width:640px;">
    <h1 style="color:#14524a;font-size:20px;margin:0 0 12px;">Bug report: ${escapeHtml(r.summary)}</h1>
    <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #ded8ca;">
      ${row('Type', escapeHtml(BUG_TYPES[r.bugType]))}
      ${row('Severity', escapeHtml(BUG_SEVERITIES[r.severity]))}
      ${row('Page', link(r.page))}
      ${row('Device', escapeHtml(r.device || 'Not given'))}
      ${row('Reporter email', email)}
      ${row('Screenshot', r.screenshotUrl ? link(r.screenshotUrl) : 'None')}
      ${row('Steps to reproduce', escapeHtml(r.steps))}
      ${row('Expected', escapeHtml(r.expected))}
      ${row('Actual', escapeHtml(r.actual))}
    </table>
    <p style="color:#66726f;font-size:12px;margin-top:16px;">${stored ? 'Logged in your database.' : `Could NOT be saved to the database (id ${escapeHtml(id)}); this email is the only copy.`} The reporter was not emailed.</p>
  </div>`;
}

async function handleBugReport(req, res, data, { storeEnquiry, sendEmail }) {
  const result = normalizeBugReport(data);
  if (!result.report) return fail(res, 400, result.code, result.message);
  const report = result.report;
  const id = randomUUID();
  const headers = req.headers || {};

  try {
    // Fits the existing table with no schema change: name and phone are REQUIRED
    // columns, so they get 'Anonymous' and an empty string (a REQUIRED column
    // refuses NULL, not ''); every other column that does not apply stays null.
    const row = {
      id,
      created_at: new Date().toISOString(),
      name: report.name,
      email: report.email || null,
      email_verified: false,
      phone: '',
      check_in: null,
      check_out: null,
      adults: null,
      children: null,
      guests: null,
      property_slug: null,
      area: null,
      coming_from_city: null,
      pets: null,
      pet_count: null,
      message: bugReportText(report),
      source: 'bug_report',
      page_lang: normalizePageLang(data.lang),
      status: 'pending',
      ip_address: headers['x-forwarded-for'] || (req.connection && req.connection.remoteAddress) || null,
      user_agent: headers['user-agent'] || null,
      referrer: headers['referer'] || null
    };
    let stored = false;
    try {
      await storeEnquiry(row);
      stored = true;
      console.log('✅ Bug report stored in BigQuery:', id);
    } catch (dbError) {
      console.error('❌ BigQuery insert failed for a bug report, sending the email anyway:', id, dbError && dbError.message);
    }

    const message = {
      from: 'noreply@rishikeshhomestays.com',
      to: process.env.CONTACT_EMAIL || 'hello@rishikeshhomestays.com',
      subject: `Bug report [${report.severity}]: ${report.summary}`,
      html: bugReportHtml(report, stored, id),
      text: bugReportText(report)
    };
    // Replying from the inbox goes to the reporter; they are never a recipient.
    if (report.email) message.reply_to = report.email;
    await sendEmail(message);
    console.log('✅ Bug report email sent via Resend:', id);

    return res.json({ success: true, message: 'Thank you! We will look into it.', enquiryId: id });
  } catch (error) {
    console.error('Error processing bug report:', error.message);
    return fail(res, 500, 'server_error', 'We encountered an error. Please try again or contact us directly.');
  }
}

// Resend is created on first use, so tests (and a missing RESEND_API_KEY)
// never build a real client at import time.
let resendClient;
function defaultSendEmail(message) {
  resendClient = resendClient || new Resend(process.env.RESEND_API_KEY);
  return resendClient.emails.send(message);
}

// Factory so tests can pass stand-ins for BigQuery and Resend (the resend SDK
// ignores a stubbed globalThis.fetch, so it has to be replaced outright).
export function createContactHandler({
  insertEnquiry: storeEnquiry = insertEnquiry,
  sendEmail = defaultSendEmail
} = {}) {
return async function handler(req, res) {
  if (req.method !== "POST") {
    return fail(res, 405, 'method_not_allowed', "Method not allowed");
  }

  const data = req.body || {};

  // Bot check first, for every source (a no-op while CAPTCHA_SECRET is empty).
  // Each solved challenge is single-use, so a client that gets any other error
  // back (say a bad phone) must fetch a fresh challenge before it retries.
  if (!(await verifyCaptcha(data.captcha))) {
    return fail(res, 400, CAPTCHA_FAILED_CODE, CAPTCHA_FAILED_MESSAGE);
  }

  if (data.source === 'bug_report') {
    return handleBugReport(req, res, data, { storeEnquiry, sendEmail });
  }

  const requiredFields = ["name", "phone", "details"];
  const missingFields = requiredFields.filter((field) => !String(data[field] || "").trim());

  if (missingFields.length) {
    return fail(res, 400, 'missing_fields', "Please complete the required fields before sending your enquiry.");
  }

  // The frontend always sends the phone number in E.164 form (+<country
  // code><number>) after resolving it against the country the guest picked,
  // so no country hint is needed here — libphonenumber-js can validate a
  // full E.164 string on its own.
  const parsedPhone = parsePhoneNumberFromString(String(data.phone || ''));
  if (!parsedPhone || !parsedPhone.isValid()) {
    return fail(res, 400, 'invalid_phone', "Please provide a valid phone number, including country code.");
  }
  data.phone = parsedPhone.number;

  // Bike/taxi rental enquiries (/bike-and-taxi-rental-in-rishikesh) send
  // their start/end dates as check_in/check_out; a rental may start and end
  // on the same day, so they get the looser end >= start check.
  const isRental = data.source === 'rental_enquiry';
  const dateRangeResult = isRental
    ? validateRentalDateRange(data.check_in, data.check_out)
    : validateDateRange(data.check_in, data.check_out);
  if (!dateRangeResult.valid) {
    return fail(res, 400, dateRangeResult.code || 'invalid_dates', dateRangeResult.message);
  }

  try {
    // Parse details to extract check_in, check_out, guests info
    // Details format: "Arriving 15th July, staying 7 days. Family of 4 (2 adults, 2 kids). Need 2 rooms with kitchen..."
    const detailsText = data.details || '';
    const rentalPeople = isRental ? parseInt(data.people) || 0 : 0;
    const adults = isRental ? rentalPeople || 1 : parseInt(data.adults) || 1;
    const children = parseInt(data.children) || 0;
    const petCount = parseInt(data.pet_count) || 0;
    const petType = data.pets || 'none';
    
    // Prepare enquiry data mapping form fields to table columns
    const enquiryId = randomUUID();
    const enquiryData = {
      id: enquiryId,
      created_at: new Date().toISOString(),
      name: data.name,
      email: data.email || null,
      email_verified: Boolean(data.email_verified),
      phone: data.phone,
      check_in: data.check_in || null,
      check_out: data.check_out || null,
      adults: adults,
      children: children,
      guests: isRental
        ? (rentalPeople ? `${rentalPeople} ${rentalPeople === 1 ? 'person' : 'people'}` : null)
        : parseInt(data.guests_total) > 0
        ? `${parseInt(data.guests_total)} guest(s) in total incl. kids`
        : `${adults} adult(s), ${children} child(ren)${petCount > 0 ? ', ' + petCount + ' pet(s)' : ''}`,
      property_slug: data.preferred_stay || null,
      area: data.area || null,
      coming_from_city: data.coming_from_city || null,
      pets: petType,
      pet_count: petCount,
      message: detailsText,
      source: data.source || 'website_form',
      page_lang: normalizePageLang(data.lang),
      status: 'pending',
      ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
      referrer: req.headers['referer'] || null
    };

    // Store in BigQuery. A failed insert (BigQuery down, a schema mismatch)
    // must not lose the lead: log it and still send the email below, which
    // carries every detail of the enquiry.
    let stored = false;
    try {
      await storeEnquiry(enquiryData);
      stored = true;
      console.log("✅ Data stored in BigQuery:", enquiryId);
    } catch (dbError) {
      console.error("❌ BigQuery insert failed, sending the email anyway:", enquiryId, dbError && dbError.message, dbError && dbError.errors ? JSON.stringify(dbError.errors) : '');
    }

    // Send email via Resend. Wrapped in a branded header/footer (logo, brand
    // colors) instead of a bare unstyled div, since this is a guest-facing
    // moment too now (see the combined email below), not just an internal
    // notice — a well-designed confirmation reads as more trustworthy than
    // a plain data dump.
    const isHostApplication = data.source === 'host_application';
    // Leads from the "Book this stay" popup on /stay pages (stay_redirect_*,
    // stay_enquiry) are for our awareness only: never email the guest, even
    // if they typed an address.
    const isStayLead = String(data.source || '').startsWith('stay_');
    const totalGuests = parseInt(data.guests_total) || 0;
    const contactEmail = process.env.CONTACT_EMAIL || 'hello@rishikeshhomestays.com';
    const LOGO_URL = 'https://rishikeshhomestays.com/assets/images/logo.png';
    const BRAND_DARK = '#0f2f2b';
    const BRAND = '#14524a';
    const BRAND_LIGHT = '#e7f1ef';

    const row = (label, value) => `
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #66726f; font-size: 13px; width: 40%; vertical-align: top;">${label}</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #17211f; font-size: 14px; font-weight: 600; vertical-align: top;">${value}</td>
          </tr>`;

    // Rentals show service/pickup/people instead of the stay-specific rows.
    const rentalService = data.service || 'Bike / taxi';
    const rentalRowsHtml = `
          ${row('Name', data.name)}
          ${row('Phone', data.phone)}
          ${row('Email', data.email || 'Not provided')}
          ${row('Service', rentalService)}
          ${row('Start date', data.check_in || 'Not specified')}
          ${row('End date', data.check_out || 'Not specified')}
          ${row('Pickup point', data.pickup_point || 'Not specified')}
          ${row('People', rentalPeople || 'Not specified')}
          ${row('Details', `<span style="font-weight: 400; white-space: pre-wrap;">${data.details}</span>`)}
          ${row('Submitted At', new Date().toLocaleString())}`;

    const detailsCardHtml = isRental ? `
        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 22px 0; background: #fbfaf5; border: 1px solid #ded8ca; border-radius: 12px; padding: 4px 18px;">
          ${rentalRowsHtml}
        </table>` : `
        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 22px 0; background: #fbfaf5; border: 1px solid #ded8ca; border-radius: 12px; padding: 4px 18px;">
          ${row('Name', data.name)}
          ${row('Phone', data.phone)}
          ${row('Email', `${data.email || 'Not provided'}${data.email ? (enquiryData.email_verified ? ' ✅ Verified' : ' (not verified)') : ''}`)}
          ${row('Check-in', data.check_in || 'Not specified')}
          ${row('Check-out', data.check_out || 'Not specified')}
          ${row('Preferred Property', data.preferred_stay || 'Open to suggestions')}
          ${row('Preferred Area', data.area || 'Not specified')}
          ${row('Coming from (City)', data.coming_from_city || 'Not specified')}
          ${row('Guests', totalGuests ? `${totalGuests} in total (kids included)` : `${adults} adult(s), ${children} child(ren)`)}
          ${row('Pets', petCount > 0 ? `${petType} (${petCount})` : 'None')}
          ${row('Trip Details', `<span style="font-weight: 400; white-space: pre-wrap;">${data.details}</span>`)}
          ${row('Submitted At', new Date().toLocaleString())}
        </table>`;

    const whatsappCtaHtml = `
        <table role="presentation" style="width: 100%; margin: 26px 0;"><tr><td align="center">
          <a href="https://wa.me/918050091290" style="display: inline-block; background: #25D366; color: #fff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 30px; border-radius: 999px;">💬 Chat with us on WhatsApp</a>
        </td></tr></table>
        <p style="text-align: center; color: #66726f; font-size: 13px; margin: 0 0 4px;">or call us directly</p>
        <p style="text-align: center; color: #17211f; font-size: 14px; font-weight: 600; margin: 0;">+91 90272 12484 &nbsp;·&nbsp; +91 80500 91290</p>`;

    // Shared header/footer chrome — every email from the site looks like it
    // came from the same place, guest-facing or internal.
    // A custom hand-drawn illustration would need a hosted image asset we
    // don't have yet, and SVG is unreliable across email clients anyway —
    // an emoji "skyline" motif gets the same hand-drawn, illustrated warmth
    // cheaply, renders everywhere (Gmail, Outlook, Apple Mail alike), and
    // needs no asset hosting or dark-mode handling.
    const skylineHtml = `
        <div style="text-align: center; font-size: 26px; letter-spacing: 6px; padding: 14px 0 2px; opacity: 0.9;">🏔️⛰️🛖🌊🛖⛰️🏔️</div>`;

    const emailShell = (bodyHtml) => `
      <div style="font-family: -apple-system, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #ede8dc;">
        <div style="background: linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%); padding: 28px 32px; text-align: center;">
          <img src="${LOGO_URL}" width="84" height="84" alt="Rishikesh Homestays" style="border-radius: 50%; background: #fff; padding: 6px; display: inline-block;">
          <div style="color: #fff; font-size: 19px; font-weight: 700; margin-top: 12px; letter-spacing: 0.02em;">Rishikesh Homestays</div>
          <div style="color: #cfe8e2; font-size: 13px; font-weight: 600; margin-top: 4px;">You've found your Ganges getaway 🎉</div>
        </div>
        ${skylineHtml}
        <div style="padding: 8px 32px 32px;">
          ${bodyHtml}
        </div>
        <div style="background: ${BRAND_LIGHT}; padding: 18px 32px; text-align: center; color: #45534f; font-size: 12px;">
          Handpicked homestays near the Ganges, Tapovan &amp; Triveni Ghat<br>
          <a href="https://rishikeshhomestays.com" style="color: ${BRAND}; font-weight: 600; text-decoration: none;">rishikeshhomestays.com</a>
        </div>
      </div>`;

    // A little personality + a reason to book direct rather than through an
    // OTA — guest-facing only, since it's a booking pitch, not something an
    // internal "new enquiry" alert needs.
    const bookDirectApppealHtml = `
        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 22px 0; background: ${BRAND_LIGHT}; border-radius: 12px;"><tr><td style="padding: 18px 20px;">
          <p style="margin: 0 0 6px; color: ${BRAND}; font-weight: 800; font-size: 14px;">🌤️ Psst — a little insider tip</p>
          <p style="margin: 0; color: #314b47; font-size: 14px; line-height: 1.6;">Book directly with us (like you just did!) and there's no middleman fee baked into your price — plus you get a real human on WhatsApp who actually knows the ghats, the good chai stalls, and which room has the best sunrise view. Airbnb can't tell you that. 😉</p>
        </td></tr></table>`;

    // One-tap reply for us: opens WhatsApp to the guest's number with a
    // friendly opener about the stay they asked for.
    const guestWaDigits = String(data.phone || '').replace(/\D/g, '');
    const stayName = data.stay_name || data.preferred_stay || 'your Rishikesh stay';
    // Deliberately doesn't name the listing they clicked: the goal is to steer
    // them to our own homestay network, so just ask for dates and offer picks.
    // The book-direct pitch ends with one random way to enjoy the commission
    // they save by not booking through a platform.
    const SAVED_COMMISSION_IDEAS = [
      'a proper feast at Chotiwala',
      'a white-water rafting trip on the Ganga',
      'an offering at the Triveni Ghat aarti',
      'a donation at Triveni Ghat',
      'a sunrise yoga class by the river',
      'kulhad chai and hot jalebis by the ghat, every evening',
      'a sunrise taxi up to Kunjapuri Devi',
      'a diya (or ten) at the Parmarth Niketan aarti',
      'an Ayurvedic massage after the trek',
      'a cafe crawl through Tapovan'
    ];
    const savedIdea = SAVED_COMMISSION_IDEAS[Math.floor(Math.random() * SAVED_COMMISSION_IDEAS.length)];
    const guestOpener = isRental
      ? `Hi ${data.name}! 🙏 This is Rishikesh Homestays. Thanks for your ${rentalService} enquiry. ` +
        'We\'re checking with our local partners and will share the options and a quote shortly. ' +
        'Need a place to stay too? We can line up one of our handpicked homestays near your pickup. 🌊'
      : `Hi ${data.name}! 🙏 This is Rishikesh Homestays. Thanks for reaching out about your Rishikesh trip` +
      `${totalGuests ? ` for ${totalGuests} guest${totalGuests > 1 ? 's' : ''}` : ''}. ` +
      'Could you share your check-in and check-out dates? We\'ll line up our best handpicked homestays and hotels for you. ' +
      `Book direct with us and skip the booking-site commission. Spend what you save on ${savedIdea} instead! 🌊`;
    const replyOnWhatsAppHtml = guestWaDigits ? `
        <table role="presentation" style="width: 100%; margin: 6px 0 18px;"><tr><td align="center">
          <a href="https://wa.me/${guestWaDigits}?text=${encodeURIComponent(guestOpener)}" style="display: inline-block; background: #25D366; color: #fff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 30px; border-radius: 999px;">💬 WhatsApp ${data.name} now</a>
        </td></tr></table>
        <p style="text-align: center; color: #66726f; font-size: 12px; margin: 0 0 8px;">Opens a chat with ${data.phone}, with a ready-to-send opener you can edit.</p>` : '';

    const rentalSubject = `Rental enquiry: ${data.name} → ${rentalService}`;

    if (data.email && !isStayLead) {
      // One shared thread instead of two disconnected emails: the guest is
      // the primary recipient (so it reads as "your enquiry", not an
      // internal notice) and we're CC'd on the same message, so replying
      // all keeps guest and owner in the same conversation from message one.
      const greetingHtml = `
          <h1 style="color: ${BRAND}; font-size: 22px; margin: 0 0 6px;">${isHostApplication ? `Thanks, ${data.name}! Let's get your homestay listed 🏡` : isRental ? `Thanks, ${data.name}! Your wheels are being lined up 🛵` : `Thanks, ${data.name} — your Rishikesh trip is taking shape! 🌊`}</h1>
          <p style="color: #45534f; font-size: 15px; line-height: 1.6; margin: 0 0 4px;">${isHostApplication
            ? "We've received your application to list your property with us — there's no listing fee. Our team will review your details and reach out within 24 hours to confirm next steps."
            : isRental
            ? "We've got your rental enquiry and we're checking it with our trusted local partners. Expect a call or WhatsApp from us shortly with options and a quote. Helmets on, playlist ready 🏔️"
            : "We've got your enquiry and we're already matching it against our handpicked homestays. Expect personalized recommendations from our team within 24 hours — pack your sense of adventure (and maybe some flip-flops for the ghats) 🏔️"}</p>
          ${detailsCardHtml}
          ${isHostApplication || isRental ? '' : bookDirectApppealHtml}
          ${whatsappCtaHtml}
          <p style="color: #45534f; font-size: 14px; margin: 26px 0 0;">Warm regards,<br><strong style="color: #17211f;">Rishikesh Homestays Team</strong></p>`;

      const emailResponse = await sendEmail({
        from: 'hello@rishikeshhomestays.com',
        to: data.email,
        cc: contactEmail,
        subject: isHostApplication
          ? 'Your Rishikesh Homestays listing application is received'
          : isRental
            ? rentalSubject
            : 'We received your Rishikesh homestay enquiry!',
        html: emailShell(greetingHtml)
      });

      console.log("✅ Combined guest+owner email sent via Resend:", emailResponse);
    } else {
      // No guest email to make the primary recipient — just notify us
      // internally, same branded shell but framed as an internal alert.
      const internalHtml = `
          <h1 style="color: ${BRAND}; font-size: 20px; margin: 0 0 6px;">${isHostApplication ? 'New Homestay Listing Application' : isRental ? `New rental enquiry: ${rentalService}` : isStayLead ? `New stay lead: ${stayName}` : 'New Rishikesh Homestay Enquiry'}</h1>
          <p style="color: #66726f; font-size: 14px; margin: 0 0 4px;">${isStayLead
            ? `For your eyes only: the guest was not emailed.${data.source.startsWith('stay_redirect_') ? ' They were sent on to the booking site after this.' : ''}`
            : 'No email on file for this guest — reach out by phone or WhatsApp.'}</p>
          ${replyOnWhatsAppHtml}
          ${detailsCardHtml}
          <p style="color: #66726f; font-size: 12px; margin-top: 20px;">${stored ? 'This enquiry has been logged in your database.' : `This enquiry could NOT be saved to the database (id ${enquiryId}); this email is the only copy.`}</p>`;

      const emailResponse = await sendEmail({
        from: 'noreply@rishikeshhomestays.com',
        to: contactEmail,
        subject: isHostApplication
          ? `New Listing Application from ${data.name} - Rishikesh Homestays`
          : isRental
            ? rentalSubject
            : isStayLead
            ? `Stay lead: ${data.name}${totalGuests ? ` (${totalGuests} guests)` : ''} → ${stayName}`
            : `New Enquiry from ${data.name} - Rishikesh Homestay`,
        html: emailShell(internalHtml)
      });

      console.log("✅ Email sent via Resend:", emailResponse);
    }

    return res.json({
      success: true,
      message: "Thank you! We will contact you shortly.",
      enquiryId
    });

  } catch (error) {
    console.error("Error processing enquiry:", error.message);
    return fail(res, 500, 'server_error', "We encountered an error. Please try again or contact us directly.");
  }
};
}

export default createContactHandler();
