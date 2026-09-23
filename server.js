import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import contactHandler from './api/contact.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Restaurants & Cafes was merged into Places to Visit as an in-page tab —
// redirect both its old clean and .html URLs to the new location.
app.get(['/pages/restaurants-cafes', '/pages/restaurants-cafes.html'], (req, res) => {
  res.redirect(301, '/pages/places-to-visit#restaurants');
});

// Things to Do was renamed to Things to Do in Rishikesh.
app.get(['/pages/things-to-do', '/pages/things-to-do.html'], (req, res) => {
  res.redirect(301, '/pages/things-to-do-in-rishikesh');
});

// Redirect old-style .html URLs to their clean equivalent (e.g.
// /pages/contact.html -> /pages/contact) so there's a single canonical URL
// and any bookmarked/indexed .html links still work.
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
// file on disk, e.g. /pages/contact -> pages/contact.html.
app.use((req, res, next) => {
  if (req.path !== '/' && !path.extname(req.path)) {
    const htmlPath = path.join(__dirname, req.path + '.html');
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

app.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
});
