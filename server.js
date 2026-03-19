const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Upload endpoint
app.post('/api/upload', upload.single('pdf'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const meta = readMeta();
  const entry = {
    id: path.basename(req.file.filename, '.pdf'),
    originalName: req.file.originalname,
    filename: req.file.filename,
    size: req.file.size,
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

// Delete a PDF
app.delete('/api/pdfs/:id', (req, res) => {
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
