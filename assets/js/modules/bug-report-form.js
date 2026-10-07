// "Report a bug" form (/report-a-bug): source 'bug_report'.
//
// Fields: a short title, the page, what it is about, how serious, steps to reproduce, what was expected,
// what happened, the device (filled in here, editable), an optional reply email and an optional screenshot
// link. There is no phone or name. The rules live in validators.js (validateBugReport) and api/contact.js
// applies the same ones; the report goes through postEnquiry like every other form. The server emails
// CONTACT_EMAIL only: the reporter's address is for us to write back, the site never writes to it.
import { setButtonLoading, clearButtonLoading } from './button-loading.js';
import { postEnquiry, SOURCES } from './enquiry.js';
import { CAPTCHA_FAILED_CODE, CAPTCHA_FAILED_MESSAGE } from './captcha.js';
import { validateBugReport, buildBugReportDetails, BUG_LIMITS } from './validators.js';

const FIELDS = ['summary', 'page', 'type', 'severity', 'steps', 'expected', 'actual', 'device', 'email', 'screenshot'];

// "Chrome 126 on Windows, screen 1920x1080, viewport 1200x800, language en-IN, theme dark".
// Pure: reads only the window it is given, never throws on a missing property.
export function describeDevice(win = window) {
  const nav = win.navigator || {};
  const ua = String(nav.userAgent || '');
  const pick = (re) => (ua.match(re) || [])[1];
  let browser = 'Unknown browser';
  let m;
  if ((m = pick(/\bEdg(?:e|A|iOS)?\/(\d+)/))) browser = `Edge ${m}`;
  else if ((m = pick(/\b(?:OPR|Opera)\/(\d+)/))) browser = `Opera ${m}`;
  else if ((m = pick(/\b(?:Firefox|FxiOS)\/(\d+)/))) browser = `Firefox ${m}`;
  else if ((m = pick(/(?:Chrome|CriOS)\/(\d+)/))) browser = `Chrome ${m}`;
  else if ((m = pick(/\bVersion\/(\d+)[^]*Safari\//))) browser = `Safari ${m}`;
  let os = 'unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux|X11/i.test(ua)) os = 'Linux';
  const parts = [`${browser} on ${os}`];
  const scr = win.screen;
  if (scr && scr.width && scr.height) parts.push(`screen ${scr.width}x${scr.height}`);
  if (win.innerWidth && win.innerHeight) parts.push(`viewport ${win.innerWidth}x${win.innerHeight}`);
  if (nav.language) parts.push(`language ${nav.language}`);
  const theme = win.document && win.document.documentElement && win.document.documentElement.getAttribute('data-theme');
  parts.push(`theme ${theme === 'dark' ? 'dark' : 'light'}`);
  return parts.join(', ').slice(0, BUG_LIMITS.device.max);
}

// The page the person was on: ?page=<path or link> first, else the page they came from when it is on this
// site (a referrer from a search engine or another site says nothing about a bug here). Empty when unknown.
export function initialPageValue(win = window) {
  const { max } = BUG_LIMITS.page;
  try {
    const wanted = new URL(win.location.href).searchParams.get('page');
    if (wanted) {
      const text = wanted.trim();
      if (text.startsWith('/') && !text.startsWith('//')) return text.slice(0, max);
      const url = new URL(text);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.href.slice(0, max);
    }
  } catch { /* an unreadable ?page= is ignored */ }
  try {
    const ref = win.document.referrer;
    if (ref) {
      const url = new URL(ref);
      if (url.origin === win.location.origin && url.pathname !== win.location.pathname) {
        return `${url.pathname}${url.search}`.slice(0, max);
      }
    }
  } catch { /* no usable referrer */ }
  return '';
}

export function setupBugReportForm() {
  const form = document.querySelector('#bugForm');
  if (!form) return null;

  const btn = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-form-status]');
  const thanks = document.querySelector('[data-bug-thanks]');
  const reference = document.querySelector('[data-bug-reference]');
  const input = (name) => form.querySelector(`#bug_${name}`);
  const errorEl = (name) => document.getElementById(`bug-${name}-error`);

  const setStatus = (text, ok) => {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle('is-ok', Boolean(ok) && Boolean(text));
    status.classList.toggle('is-err', !ok && Boolean(text));
  };
  const showError = (name, message) => {
    const el = errorEl(name);
    const field = input(name);
    if (el) {
      el.textContent = message || '';
      el.hidden = !message;
    }
    if (field) {
      field.classList.toggle('field-invalid', Boolean(message));
      if (message) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    }
  };

  // Prefill what we can know. Anything the person already typed (browser autofill, a reload) is kept.
  const pageField = input('page');
  if (pageField && !pageField.value) pageField.value = initialPageValue(window);
  const deviceField = input('device');
  if (deviceField && !deviceField.value) deviceField.value = describeDevice(window);

  // A field's error goes away as soon as it is edited.
  for (const name of FIELDS) {
    const field = input(name);
    const clear = () => showError(name, '');
    field?.addEventListener('input', clear);
    field?.addEventListener('change', clear);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('', false);

    const raw = {};
    for (const name of FIELDS) raw[name] = input(name)?.value ?? '';
    const { valid, errors, values } = validateBugReport(raw);
    for (const name of FIELDS) showError(name, errors[name]);
    if (!valid) {
      const firstBad = FIELDS.find((name) => errors[name]);
      input(firstBad)?.focus();
      setStatus('Please fix the highlighted fields and send it again.', false);
      return;
    }

    setButtonLoading(btn, 'Sending...');
    try {
      const result = await postEnquiry({
        source: SOURCES.bugReport,
        name: 'Anonymous',
        summary: values.summary,
        page_url: values.page,
        bug_type: values.type,
        severity: values.severity,
        steps: values.steps,
        expected: values.expected,
        actual: values.actual,
        device: values.device,
        email: values.email,
        screenshot_url: values.screenshot,
        details: buildBugReportDetails(values),
        lang: document.documentElement.lang || 'en'
      }, { button: btn });

      if (result.success) {
        form.reset();
        if (pageField) pageField.value = initialPageValue(window);
        if (deviceField) deviceField.value = describeDevice(window);
        if (reference && result.enquiryId) {
          reference.textContent = String(result.enquiryId).slice(0, 8);
          reference.closest('[data-bug-reference-line]')?.removeAttribute('hidden');
        }
        if (thanks) {
          form.hidden = true;
          thanks.hidden = false;
          thanks.focus();
          thanks.scrollIntoView?.({ block: 'start' });
        } else {
          setStatus(result.message || 'Thank you. Your report is with us.', true);
        }
      } else if (result.code === CAPTCHA_FAILED_CODE) {
        setStatus(result.message || CAPTCHA_FAILED_MESSAGE, false);
      } else {
        setStatus(result.message || 'We could not send your report just now. Please try again, or email us instead.', false);
      }
    } catch {
      setStatus('We could not send your report just now. Please check your connection and try again, or email us instead.', false);
    } finally {
      clearButtonLoading(btn);
    }
  });

  // "Report another problem" on the thank-you panel.
  document.querySelector('[data-bug-again]')?.addEventListener('click', () => {
    if (thanks) thanks.hidden = true;
    form.hidden = false;
    setStatus('', false);
    input('summary')?.focus();
  });

  return form;
}

// Starts itself on the page (like host-form.js); skipped where there is no document (tests call it directly).
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupBugReportForm);
  else setupBugReportForm();
}
