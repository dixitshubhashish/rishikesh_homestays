import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import contactHandler from './api/contact.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API route — reuse the serverless handler
app.post('/api/contact', (req, res) => {
  contactHandler(req, res);
});

// Serve the project files statically
app.use(express.static(__dirname));

app.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
});
