import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import contactHandler from './api/contact.js';
import otpStatusHandler from './api/otp-status.js';
import otpSendHandler from './api/otp-send.js';
import otpVerifyHandler from './api/otp-verify.js';
import geoHandler from './api/geo.js';
import captchaChallengeHandler from './api/captcha-challenge.js';
import currencyRatesHandler from './api/currency-rates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Restaurants & Cafes was merged into Places to Visit as an in-page tab —
// redirect both its old clean and .html URLs to the new location.
app.get(['/pages/restaurants-cafes', '/pages/restaurants-cafes.html'], (req, res) => {
  res.redirect(301, '/places-to-visit#restaurants');
});

// Things to Do was renamed to Things to Do in Rishikesh.
app.get(['/pages/things-to-do', '/pages/things-to-do.html'], (req, res) => {
  res.redirect(301, '/things-to-do-in-rishikesh');
});

// Kedarnath & Garhwal was renamed from gateway-to-kedarnath to kedarnath-yatra.
app.get(['/pages/gateway-to-kedarnath', '/pages/gateway-to-kedarnath.html'], (req, res) => {
  res.redirect(301, '/kedarnath-yatra');
});

// Individual property listing pages live under /hotels/, not /pages/ — this
// one briefly existed at the /pages/ path before moving.
app.get(['/pages/advaitam-ganga-hill-view-luxury-3bhk', '/pages/advaitam-ganga-hill-view-luxury-3bhk.html'], (req, res) => {
  res.redirect(301, '/hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh');
});

// These guide/content pages used to live under /pages/ (both on disk and
// in the URL); they've since moved to the repo root and dropped the
// segment from the URL too (e.g. /pages/contact -> /contact). Catch any
// remaining old-style `/pages/<slug>` or `/pages/<slug>.html` request
// (bookmarks, indexed links, anything not already handled by a rename
// redirect above) and send it straight to the new canonical URL.
app.get(/^\/pages\/([a-z0-9-]+)(?:\.html)?$/, (req, res) => {
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect(301, '/' + req.params[0] + query);
});

// Stays pages moved from the root into hotels/: 301 the old URLs (keeping the
// query string) to match vercel.json and _redirects.
app.get(/^\/(best-[a-z0-9-]+-in-[a-z]+)(?:\.html)?$/, (req, res) => {
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect(301, '/hotels/' + req.params[0] + query);
});
// /hotels/stay needs ?s=<stay>; without one, send visitors to the city's
// stays page instead of an empty template (mirrors vercel.json).
app.get(['/hotels/stay', '/hotels/stay.html'], (req, res, next) => {
  if (req.query.s) return next();
  const city = /^[a-z-]+$/.test(String(req.query.c || '')) ? req.query.c : 'rishikesh';
  res.redirect(302, `/hotels/best-hotels-in-${city}`);
});
// /stays (a guessed URL) and old /stays/best-… links → the stays pages in hotels/
// Shareable link that opens the WhatsApp form (Instagram bio, social posts); keeps ?utm_… etc.
app.get('/whatsapp', (req, res) => { const q = new URLSearchParams(req.query); q.set('whatsapp', 'open'); res.redirect(302, `/?${q}`); });
app.get(['/stays', '/stays.html'], (req, res) => res.redirect(301, '/hotels/best-hotels-in-rishikesh'));
app.get(/^\/stays\/(best-[a-z0-9-]+-in-[a-z]+)$/, (req, res) => res.redirect(301, `/hotels/${req.params[0]}`));
app.get(['/stay', '/stay.html'], (req, res) => {
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect(301, '/hotels/stay' + query);
});

// Redirect old-style .html URLs to their clean equivalent (e.g.
// /about-rishikesh.html -> /about-rishikesh) so there's a single canonical
// URL and any bookmarked/indexed .html links still work.
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    const query = req.originalUrl.slice(req.path.length);
    let cleanPath = req.path.slice(0, -'.html'.length) || '/';
    if (cleanPath === '/index') cleanPath = '/';
    return res.redirect(301, cleanPath + query);
  }
  next();
});

// Serve clean URLs (no extension) by mapping them to the matching .html
// file on disk, e.g. /contact -> contact.html. Every guide/content page's
// URL matches its filename directly (no /pages/ folder segment) — see
// vercel.json/_redirects for the same rule in production.
app.use((req, res, next) => {
  if (req.path !== '/' && !path.extname(req.path)) {
    const htmlPath = path.join(__dirname, req.path + '.html');
    // A raw backslash is a separator on Windows, so '..\' could walk out of the repo.
    if (!htmlPath.startsWith(__dirname + path.sep)) return next();
    fs.stat(htmlPath, (err, stats) => {
      if (!err && stats.isFile()) return res.sendFile(htmlPath);
      next();
    });
  } else {
    next();
  }
});

app.use(express.static(path.join(__dirname)));

app.post('/api/contact', contactHandler);
app.get('/api/otp-status', otpStatusHandler);
app.get('/api/geo', geoHandler);
app.get('/api/captcha-challenge', captchaChallengeHandler);
app.get('/api/currency-rates', currencyRatesHandler);
app.post('/api/otp-send', otpSendHandler);
app.post('/api/otp-verify', otpVerifyHandler);

// Anything that reaches here matched no route, redirect, or static file —
// serve the custom 404 page (Vercel/Netlify do this automatically for a
// root-level 404.html; Express needs it spelled out explicitly).
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

app.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
});
