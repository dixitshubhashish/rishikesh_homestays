# Rishikesh Homestays

A modern hospitality platform for discovering premium homestays in Rishikesh, India.

## 🏗️ Architecture

**Frontend:** Static HTML5/CSS3/Vanilla JS (no framework)
- `index.html` — Main landing page
- `pages/` — Dedicated pages (homestays, about-rishikesh, places-to-visit, things-to-do, contact, thanks, triveni-ghat)
- `assets/css/styles.css` — All styles (~28KB)
- `assets/js/site.js` — Frontend logic (~7KB), data, and event handlers
- `assets/js/contact.js` — Contact form client-side code (~2.5KB)
- `assets/images/` — Property and hero images

**Backend:** Node.js/Express
- `server.js` — Dev server serving static files + API route
- `api/contact.js` — POST `/api/contact` handler that:
  - Validates form data (name, phone, details required)
  - Stores inquiry in Supabase `enquiries` table
  - Sends tabular email to `CONTACT_EMAIL` via Resend
  - Sends confirmation email to guest (if email provided)
  - Returns success/error JSON

**Database:** Supabase (PostgreSQL)
- Table: `enquiries` — stores homestay booking inquiries with guest details, dates, preferences

**Email:** Resend — transactional email service

**Hosting:** Netlify (static export; redirects defined in `_redirects`)

## 📁 Key Files to Edit

- **Contact Email:** `api/contact.js:138` → from address
- **Property/Site Data:** `assets/js/site.js` — homestay listings, amenities, phone numbers, WhatsApp links, Google Maps
- **Hero Images:** Replace PNGs in `assets/images/`
- **Styling:** `assets/css/styles.css`
- **Contact Form Endpoint:** `assets/js/contact.js` — client-side submission logic

## 🚀 Local Development

```bash
npm install
npm run dev
# Opens at http://localhost:3000
```

### Environment Variables (`.env`)
```
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
RESEND_API_KEY=<your-resend-api-key>
CONTACT_EMAIL=hello@rishikeshhomestays.com
PORT=3000
```

**⚠️ SECURITY NOTE:** The `.env` file is currently tracked in git. Before pushing any changes:
1. Create `.gitignore` (see below)
2. Remove `.env` and `node_modules/` from git history
3. Redact/rotate exposed keys from Supabase and Resend

### Setup `.gitignore`
```
node_modules/
.env
.env.local
.DS_Store
*.log
```

## 🔑 Dependencies

- **express** — Web server
- **dotenv** — Environment variables
- **body-parser** — Parse form submissions
- **@supabase/supabase-js** — Database + auth
- **resend** — Email service

## 📜 Netlify Deployment

- **Publish directory:** `.` (root)
- **Build command:** None (static files)
- **Custom domain:** rishikeshhomestays.com
- Contact form works via `/api/contact` route (may need serverless function adjustment for production)

## 💡 Development Rules

- Keep styling in single CSS file for performance
- Site data lives in `assets/js/site.js` (phone numbers, property details, WhatsApp links)
- Form validation happens in both frontend (`assets/js/contact.js`) and backend (`api/contact.js`)
- Images should be optimized before committing (avoid large uncompressed assets)

## 📊 Current State

- 6 main pages + homepage
- Contact form with email & database storage
- Responsive design, SEO-optimized
- Static hosting on Netlify
- ~10 untracked media files in working directory (ChatGPT screenshots, rafting video)
