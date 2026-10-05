# Testing

The suite uses Node's built-in test runner (`node:test`), jsdom for DOM tests and Playwright (real Chromium) for the visual test. No Jest or Vitest.

## Run

```bash
npm install
npx playwright install chromium   # once, for the visual test
npm test                          # everything (node --test tests/**/*.test.js)
npm run test:watch                # re-run on file changes
npm run check:stays               # stays-content test only (after a stays build)
```

One file or one folder:

```bash
node --test tests/modules/data.test.js
node --test tests/modules/*.test.js
node --test tests/api/*.test.js tests/modules/*.test.js tests/integration/*.test.js tests/scripts/*.test.js   # all but the visual test
```

`npm run test:coverage` passes `--coverage`, which this Node version ignores, so it prints no coverage report. Coverage is not measured.

macOS has no `timeout` command. To cap a run: `perl -e 'alarm 300; exec @ARGV' node --test <file>`.

Tests exit 0 on pass and non-zero on failure. In CI: `- run: npm test`.

## Last full run

- **2026-10-05**: all tests except the visual one, **260 / 260 passing** (22 files). The visual test was not run that day because the booking-link search had browsers open (see below).
- **2026-10-04**: full `npm test`, **413 / 413 passing**, on main after the stays guide, Haridwar, Google Maps stays, CJ links, AdSense, Driving from Delhi and Bike & Taxi Rental. The visual test then covered fewer pages (175 subtests); it now covers about 270 pages × 2 widths, so a full run today is about 800 tests.
- The live Bike & Taxi Rental page was verified end to end on 2026-10-04 (9/9 checks, form POST intercepted).

Update this section after each full run (date + counts), not with a new file.

## What each file covers

| File | Tests | Covers |
|---|---|---|
| `tests/visual/no-horizontal-overflow.test.js` | ~540 | Every root `.html` page and every `hotels/*.html` page at 375px and 1440px in real Chromium; fails if anything overflows the viewport (guards the `minmax(0, 1fr)` rule) |
| `tests/integration/pages.test.js` | 33 | Page structure, doctype, title, charset/viewport, logo, stylesheet and vendor scripts, new pages registered |
| `tests/modules/validators.test.js` | 22 | Phone + date ranges (stay rules and same-day rental rules) |
| `tests/integration/navigation.test.js` | 17 | Header/footer links (Stays division, Driving from Delhi, Bike & Taxi Rental…) |
| `tests/modules/country-select.test.js` | 17 | Country-code select |
| `tests/modules/currency.test.js`, `whatsapp-link.test.js`, `whatsapp-widget.test.js` | 16 each | Currency display, device-aware WhatsApp links, widget drawer |
| `tests/api/contact-api.test.js` | 15 | `/api/contact`, incl. `rental_enquiry` (Resend and BigQuery mocked) |
| `tests/integration/styling.test.js` | 14 | CSS: logo rule (72px height, `object-fit: contain`), design tokens (`--ink`, `--river`, `--paper`, `--leaf`, `--marigold`, `--clay`), buttons, cards, forms, media queries, balanced braces |
| `tests/modules/rental-form.test.js`, `dom-helpers.test.js`, `stays-renderer.test.js` | 13 each | Rental form logic, DOM helpers, homestay cards |
| `tests/modules/data.test.js` | 11 | STAYS/AREAS data: required fields, areas exist, prices read "Starting ₹X onwards" |
| `tests/api/otp-helpers.test.js` | 10 | Email OTP helpers |
| `tests/integration/stays-content.test.js` | 8 | `npm run check:stays`: every stays page has 450+ words of guide text (landmark pages 300+), its own title/`<h1>`/lede/description, 2+ FAQs, one ad slot after the lists, a working city switch, a sitemap entry |
| `tests/scripts/ota-evidence.test.js`, `ota-match.test.js` | 7, 4 | Booking-link match rules (place evidence, name rules; real cases) |
| `tests/modules/page-tabs.test.js` | 6 | Page tabs |
| `tests/modules/site-shim.test.js` | 3 | `site.js` shim |
| `tests/scripts/indexnow.test.js` | 3 | IndexNow sends only changed pages |
| `tests/integration/analytics.test.js` | 2 | `analytics.js` on every root + `hotels/` page; no Google tag ID hardcoded in HTML |
| `tests/integration/404-artwork.test.js` | 1 | 404 page uses the `-choti.webp` artwork, no SVG overlay |

## Rules and setup notes

- If Chromium is missing, the visual test fails at once and the run can hang: run `npx playwright install chromium` again.
- The visual test's limit is 360 s. Heavy parallel browser jobs (the booking-link search, matching agents) slow it down or make it time out: run `npm test` after they finish.
- Never let a test send real email. The `resend` SDK ignores a stubbed `fetch`: mock `Resend` or unset `RESEND_API_KEY`.
- Live-site checks must intercept `POST /api/contact` (Playwright `page.route`); never send real enquiries.

## Debugging

```bash
grep 'site-logo' contact.html                       # logo in the page?
grep '/assets/images/logo.png' contact.html          # logo path
grep -A3 '\.site-logo' assets/css/styles.css         # logo CSS
node -e "import('./assets/js/modules/data.js').then(m => console.log(m.STAYS[0]))"   # data shape
```

## Writing a test

Put it in `tests/<modules|api|integration|scripts|visual>/<feature>.test.js`; `npm test` picks it up.

```javascript
import test from 'node:test';
import assert from 'node:assert';
import { newFunction } from '../../path/to/module.js';

test('New feature', async (t) => {
  await t.test('does something', () => {
    assert.strictEqual(newFunction(), expected, 'message');
  });
});
```

## 404 page artwork: manual acceptance cases

Automated checks cannot tell whether the artwork shows a natural ponytail, so changes to the 404 art (`404.html`, `assets/images/404/`) need these visual checks. The fix shipped on 2026-10-03 (release 7c6c4d7): the page uses `rishikesh-wrong-turn-mobile-choti.webp` (up to 760px), `rishikesh-wrong-turn-choti.webp` and `rishikesh-wrong-turn-wide-choti.webp`, and `404-artwork.test.js` guards against the old SVG overlay. Chromium passed at 11 widths (320–3440px) locally and live, plus `/404.html` and missing root/nested routes. Firefox, Safari, real devices and C13–C17 have no recorded result.

**Pass rule**: the guide (Chotiwala style) has a clearly visible ponytail (choti) attached naturally behind his head, matching the approved portrait. A bald head, a forehead tuft, a floating SVG or a clipped ponytail fails. The image loading is not a pass by itself.

**How**: CSS-pixel viewports, zoom 100%, fresh reload; cancel the auto-redirect home first (the page's stay option). Run locally (`http://localhost:3000/404`) and again live (`https://rishikeshhomestays.com/404`), with a full-page screenshot and a close-up of the guide per viewport. Record the URL of the image actually visible, not the hidden `<picture>` source: a script can pick the stacked wide artwork even at desktop sizes.

| ID | Viewport | Expected |
|---|---|---|
| C01 | 320 × 568 (small phone) | Portrait art; choti visible; no horizontal overflow |
| C02 | 390 × 844 (phone) | Approved portrait; ponytail and whole head visible |
| C03 | 430 × 932 (large phone) | Same natural ponytail placement |
| C04 | 760 × 1024 (last mobile width) | Portrait source; choti visible |
| C05 | 761 × 1024 (first non-mobile width) | Landscape/wide source; choti visible |
| C06 | 768 × 1024 (tablet portrait) | Choti visible |
| C07 | 1024 × 768 (tablet landscape) | Choti visible; no clipping or overlapping text |
| C08 | 1280 × 800 (small laptop) | Choti visible in wide/stacked layout |
| C09 | 1366 × 768 (laptop) | Choti visible whether stacked or side by side |
| C10 | 1440 × 900 (large laptop) | Choti visible |
| C11 | 1920 × 1080 (desktop) | Choti visible; whole head inside the image |
| C12 | 3440 × 1440 (ultrawide) | Choti visible with the scene stretched across |

At every size: the image decoded, the head and ponytail are not covered, the 404 sign is readable, and text/contact controls don't overlap the figures.

| ID | Action | Expected |
|---|---|---|
| C13 | Resize 390 → 761 → 1440 → 390 without reloading | Art switches correctly; choti visible at every step |
| C14 | Rotate tablet 768 × 1024 → 1024 × 768 | Choti visible after the change |
| C15 | Open and close the WhatsApp drawer at 1440 × 900 | Choti visible throughout; closing restores page width |
| C16 | 200% browser zoom | Choti visible; controls usable |
| C17 | Reduced motion on, reload | Static art still has the choti |
| C18 | Missing route, e.g. `/choti-qa-missing-page` | HTTP 404, same art |
| C19 | Open `/404` and `/404.html` | Both show the custom page with the same art |
| C20 | Hard reload live with cache disabled | Live HTML and all three WebPs match the release; no SVG overlay |
| C21 | Open each WebP directly | Mobile, standard and wide art each have the ponytail in their pixels |

Repeat a phone, tablet and laptop case in Chromium, Firefox and Safari, and on a real phone/tablet when one is available. Per case record: environment, browser/version, viewport, visible image URL, pass/fail, screenshot path, notes. A release needs every viewport case to pass in both environments.

