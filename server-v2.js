const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload());

// static
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

/* =========================
   🔥 DEBUG ROUTE (핵심)
========================= */
app.get('/debug-files', (req, res) => {
  res.json({
    dirname: __dirname,
    cwd: process.cwd(),
    publicPath,
    publicExists: fs.existsSync(path.join(__dirname, 'public')),
    indexExists: fs.existsSync(path.join(__dirname, 'public', 'index.html')),
    files: fs.existsSync(__dirname) ? fs.readdirSync(__dirname) : []
  });
});

/* =========================
   API
========================= */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/* =========================
   ROOT
========================= */
app.get('/', (req, res) => {
  const filePath = path.join(publicPath, 'index.html');
  if (!fs.existsSync(filePath)) {
    return res.status(500).send('index.html missing on server');
  }
  res.sendFile(filePath);
});

/* =========================
   SPA fallback
========================= */
app.get('*', (req, res) => {
  const filePath = path.join(publicPath, 'index.html');
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('index.html not found (Railway deploy issue)');
  }
  res.sendFile(filePath);
});

/* =========================
   START
========================= */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`포트: ${PORT}`);
  console.log(`공개 폴더: ${publicPath}`);
  console.log("public exists:", fs.existsSync(publicPath));
  console.log("index exists:", fs.existsSync(path.join(publicPath, 'index.html')));
});
