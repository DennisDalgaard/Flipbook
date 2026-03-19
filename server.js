const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Simple token store (in-memory, survives until restart)
const validTokens = new Set();

app.use(express.json());

// Auth middleware – checks Bearer token
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Login påkrævet' });
  }
  const token = auth.slice(7);
  if (!validTokens.has(token)) {
    return res.status(401).json({ error: 'Ugyldigt token' });
  }
  next();
}

// Login endpoint
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Forkert adgangskode' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  validTokens.add(token);
  res.json({ token });
});

// Check if currently authenticated
app.get('/api/auth-check', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.json({ admin: false });
  }
  const token = auth.slice(7);
  res.json({ admin: validTokens.has(token) });
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const id = uuidv4();
    cb(null, `${id}.pdf`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Metadata file path
const metaPath = path.join(uploadsDir, 'metadata.json');

function readMeta() {
  if (!fs.existsSync(metaPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  } catch {
    return [];
  }
}

function writeMeta(data) {
  fs.writeFileSync(metaPath, JSON.stringify(data, null, 2));
}

// Upload endpoint (admin only)
app.post('/api/upload', requireAdmin, upload.single('pdf'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const meta = readMeta();
  const entry = {
    id: path.basename(req.file.filename, '.pdf'),
    originalName: req.file.originalname,
    filename: req.file.filename,
    size: req.file.size,
    language: req.body.language || '',
    uploadedAt: new Date().toISOString()
  };
  meta.push(entry);
  writeMeta(meta);

  res.json(entry);
});

// List all PDFs
app.get('/api/pdfs', (req, res) => {
  const meta = readMeta();
  res.json(meta);
});

// Update PDF metadata (admin only)
app.patch('/api/pdfs/:id', requireAdmin, (req, res) => {
  const meta = readMeta();
  const entry = meta.find(m => m.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });

  if (req.body.language !== undefined) entry.language = req.body.language;

  writeMeta(meta);
  res.json(entry);
});

// Delete a PDF (admin only)
app.delete('/api/pdfs/:id', requireAdmin, (req, res) => {
  const meta = readMeta();
  const idx = meta.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const entry = meta[idx];
  const filePath = path.join(uploadsDir, entry.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  meta.splice(idx, 1);
  writeMeta(meta);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Flipbook server running at http://localhost:${PORT}`);
});
