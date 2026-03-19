// ============ STATE ============
let currentPdf = null;
let pdfDoc = null;
let currentSpread = 0; // 0-indexed spread number
let totalPages = 0;
let pageCanvasCache = {};
let isLoading = false;

// ============ DOM ============
const libraryView = document.getElementById('library-view');
const readerView = document.getElementById('reader-view');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadProgress = document.getElementById('upload-progress');
const progressFill = document.querySelector('.progress-fill');
const progressText = document.querySelector('.progress-text');
const pdfGrid = document.getElementById('pdf-grid');
const emptyState = document.getElementById('empty-state');
const pdfCount = document.getElementById('pdf-count');
const flipbook = document.getElementById('flipbook');
const pageInfo = document.getElementById('page-info');
const pageSlider = document.getElementById('page-slider');
const readerTitle = document.getElementById('reader-title');
const btnBack = document.getElementById('btn-back');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnDownload = document.getElementById('btn-download');
const btnFullscreen = document.getElementById('btn-fullscreen');

// ============ LIBRARY ============
async function loadLibrary() {
  const res = await fetch('/api/pdfs');
  const pdfs = await res.json();
  renderGrid(pdfs);
}

function renderGrid(pdfs) {
  // Clear existing cards (keep empty state)
  pdfGrid.querySelectorAll('.pdf-card').forEach(c => c.remove());

  if (pdfs.length === 0) {
    emptyState.classList.remove('hidden');
    pdfCount.textContent = '0 filer';
    return;
  }

  emptyState.classList.add('hidden');
  pdfCount.textContent = `${pdfs.length} fil${pdfs.length !== 1 ? 'er' : ''}`;

  pdfs.forEach(pdf => {
    const card = document.createElement('div');
    card.className = 'pdf-card';
    card.innerHTML = `
      <div class="pdf-card-thumbnail" data-id="${pdf.id}"></div>
      <div class="pdf-card-info">
        <div class="pdf-card-name" title="${escapeHtml(pdf.originalName)}">${escapeHtml(pdf.originalName)}</div>
        <div class="pdf-card-meta">
          <span>${formatSize(pdf.size)}</span>
          <span>${formatDate(pdf.uploadedAt)}</span>
        </div>
      </div>
      <button class="pdf-card-delete" data-id="${pdf.id}" title="Slet">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.pdf-card-delete')) return;
      openReader(pdf);
    });

    card.querySelector('.pdf-card-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Slet "${pdf.originalName}"?`)) return;
      await fetch(`/api/pdfs/${pdf.id}`, { method: 'DELETE' });
      loadLibrary();
    });

    pdfGrid.appendChild(card);
    generateThumbnail(pdf, card.querySelector('.pdf-card-thumbnail'));
  });
}

async function generateThumbnail(pdf, container) {
  try {
    const doc = await pdfjsLib.getDocument(`/uploads/${pdf.filename}`).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    container.appendChild(canvas);
    doc.destroy();
  } catch (err) {
    container.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" width="48" height="48"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  }
}

// ============ UPLOAD ============
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') uploadFile(file);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) uploadFile(fileInput.files[0]);
  fileInput.value = '';
});

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('pdf', file);

  uploadProgress.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = 'Uploader...';

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = `${pct}%`;
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        progressText.textContent = 'Færdig!';
        setTimeout(() => uploadProgress.classList.add('hidden'), 1500);
        loadLibrary();
      } else {
        progressText.textContent = 'Fejl ved upload';
      }
    };

    xhr.onerror = () => {
      progressText.textContent = 'Fejl ved upload';
    };

    xhr.send(formData);
  } catch (err) {
    progressText.textContent = 'Fejl ved upload';
  }
}

// ============ READER ============
async function openReader(pdf) {
  currentPdf = pdf;
  pageCanvasCache = {};
  currentSpread = 0;

  libraryView.classList.add('hidden');
  readerView.classList.remove('hidden');
  readerTitle.textContent = pdf.originalName;

  flipbook.innerHTML = '<div class="loading-spinner"></div>';

  try {
    pdfDoc = await pdfjsLib.getDocument(`/uploads/${pdf.filename}`).promise;
    totalPages = pdfDoc.numPages;
    pageSlider.max = totalPages;
    pageSlider.value = 1;

    renderSpread();
  } catch (err) {
    flipbook.innerHTML = '<p style="color:#ef4444">Kunne ikke indlæse PDF</p>';
  }
}

function closeReader() {
  readerView.classList.add('hidden');
  libraryView.classList.remove('hidden');
  if (pdfDoc) {
    pdfDoc.destroy();
    pdfDoc = null;
  }
  pageCanvasCache = {};
}

function getSpreadPages() {
  // Single page mode on small screens
  const isMobile = window.innerWidth < 900;

  if (isMobile) {
    const page = currentSpread + 1;
    return page <= totalPages ? [page] : [];
  }

  // Two-page spread: first and last pages are alone
  if (currentSpread === 0) return [1];
  const left = currentSpread * 2;
  const right = left + 1;
  if (left > totalPages) return [];
  if (right > totalPages) return [left];
  return [left, right];
}

function getTotalSpreads() {
  const isMobile = window.innerWidth < 900;
  if (isMobile) return totalPages;
  if (totalPages <= 1) return 1;
  // First page alone, then pairs, possibly last alone
  return 1 + Math.ceil((totalPages - 1) / 2);
}

async function renderPage(pageNum) {
  if (pageCanvasCache[pageNum]) return pageCanvasCache[pageNum].cloneNode(true);

  const page = await pdfDoc.getPage(pageNum);

  // Calculate scale to fit
  const container = document.querySelector('.reader-container');
  const maxH = container.clientHeight - 40;
  const maxW = (container.clientWidth - 120) / (window.innerWidth < 900 ? 1 : 2);

  const origViewport = page.getViewport({ scale: 1 });
  const scaleH = maxH / origViewport.height;
  const scaleW = maxW / origViewport.width;
  const scale = Math.min(scaleH, scaleW, 2); // Cap at 2x

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  pageCanvasCache[pageNum] = canvas;
  return canvas.cloneNode(true);
}

async function renderSpread() {
  if (isLoading) return;
  isLoading = true;

  const pages = getSpreadPages();
  flipbook.innerHTML = '';

  if (pages.length === 0) {
    isLoading = false;
    return;
  }

  // Render pages in parallel
  const canvases = await Promise.all(pages.map(p => renderPage(p)));

  flipbook.innerHTML = '';
  canvases.forEach((canvas, i) => {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'flipbook-page page-flip-enter';
    // Copy canvas content to a new canvas in the DOM
    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = canvas.width;
    displayCanvas.height = canvas.height;
    displayCanvas.getContext('2d').drawImage(canvas, 0, 0);
    pageDiv.appendChild(displayCanvas);
    flipbook.appendChild(pageDiv);
  });

  // Update UI
  const firstPage = pages[0];
  const lastPage = pages[pages.length - 1];
  const label = pages.length === 2
    ? `Side ${firstPage}–${lastPage} af ${totalPages}`
    : `Side ${firstPage} af ${totalPages}`;
  pageInfo.textContent = label;
  pageSlider.value = firstPage;

  btnPrev.disabled = currentSpread === 0;
  btnNext.disabled = currentSpread >= getTotalSpreads() - 1;

  isLoading = false;

  // Preload next spread
  preloadAdjacent();
}

async function preloadAdjacent() {
  // Preload next and previous spread pages
  const nextSpread = currentSpread + 1;
  const prevSpread = currentSpread - 1;

  const toPreload = [];
  [prevSpread, nextSpread].forEach(s => {
    const saved = currentSpread;
    currentSpread = s;
    const pages = getSpreadPages();
    currentSpread = saved;
    pages.forEach(p => {
      if (p >= 1 && p <= totalPages && !pageCanvasCache[p]) {
        toPreload.push(p);
      }
    });
  });

  // Preload without blocking
  toPreload.forEach(p => renderPage(p).catch(() => {}));
}

// Navigation
btnPrev.addEventListener('click', () => {
  if (currentSpread > 0) {
    currentSpread--;
    renderSpread();
  }
});

btnNext.addEventListener('click', () => {
  if (currentSpread < getTotalSpreads() - 1) {
    currentSpread++;
    renderSpread();
  }
});

btnBack.addEventListener('click', closeReader);

btnDownload.addEventListener('click', () => {
  if (!currentPdf) return;
  const a = document.createElement('a');
  a.href = `/uploads/${currentPdf.filename}`;
  a.download = currentPdf.originalName;
  a.click();
});

btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    readerView.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
});

pageSlider.addEventListener('input', () => {
  const page = parseInt(pageSlider.value);
  const isMobile = window.innerWidth < 900;
  if (isMobile) {
    currentSpread = page - 1;
  } else {
    if (page === 1) {
      currentSpread = 0;
    } else {
      currentSpread = Math.ceil(page / 2);
    }
  }
  renderSpread();
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (readerView.classList.contains('hidden')) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    btnPrev.click();
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
    btnNext.click();
  } else if (e.key === 'Escape') {
    closeReader();
  }
});

// Resize handler
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (!readerView.classList.contains('hidden') && pdfDoc) {
      pageCanvasCache = {}; // Clear cache on resize for new dimensions
      renderSpread();
    }
  }, 200);
});

// ============ UTILS ============
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============ INIT ============
loadLibrary();
