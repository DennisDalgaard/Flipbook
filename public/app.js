// ============ STATE ============
let currentPdf = null;
let pdfDoc = null;
let pageFlip = null;
let totalPages = 0;
let pageImages = []; // data URLs for each page

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
}

// ============ READER ============
async function renderPageToImage(doc, pageNum, scale) {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.92);
}

async function openReader(pdf) {
  currentPdf = pdf;
  pageImages = [];

  libraryView.classList.add('hidden');
  readerView.classList.remove('hidden');
  readerTitle.textContent = pdf.originalName;

  flipbook.innerHTML = '<div class="loading-spinner"></div>';

  try {
    pdfDoc = await pdfjsLib.getDocument(`/uploads/${pdf.filename}`).promise;
    totalPages = pdfDoc.numPages;
    pageSlider.max = totalPages;
    pageSlider.value = 1;

    // Determine render scale based on container size
    const container = document.querySelector('.reader-container');
    const maxH = container.clientHeight - 40;
    const maxW = (container.clientWidth - 120) / 2;

    const firstPage = await pdfDoc.getPage(1);
    const origViewport = firstPage.getViewport({ scale: 1 });
    const scaleH = maxH / origViewport.height;
    const scaleW = maxW / origViewport.width;
    const scale = Math.min(scaleH, scaleW, 2);

    // Render first few pages immediately, then the rest
    const batchSize = 4;
    const firstBatch = Math.min(batchSize, totalPages);

    for (let i = 1; i <= firstBatch; i++) {
      const img = await renderPageToImage(pdfDoc, i, scale);
      pageImages.push(img);
    }

    // Initialize flipbook with what we have so far
    initFlipbook(origViewport.width * scale, origViewport.height * scale);

    // Render remaining pages in background
    if (totalPages > firstBatch) {
      renderRemainingPages(firstBatch + 1, totalPages, scale);
    }
  } catch (err) {
    flipbook.innerHTML = '<p style="color:#ef4444">Kunne ikke indlæse PDF</p>';
  }
}

async function renderRemainingPages(from, to, scale) {
  for (let i = from; i <= to; i++) {
    if (!pdfDoc) return; // Reader was closed
    const img = await renderPageToImage(pdfDoc, i, scale);
    pageImages.push(img);

    // Rebuild flipbook with new pages
    if (pageFlip) {
      const currentPage = pageFlip.getCurrentPageIndex();
      rebuildFlipbook(currentPage);
    }
  }
}

function initFlipbook(pageWidth, pageHeight) {
  flipbook.innerHTML = '';

  // Create page elements
  pageImages.forEach((src, i) => {
    const div = document.createElement('div');
    div.className = 'page-content';
    div.setAttribute('data-density', (i === 0 || i === pageImages.length - 1) ? 'hard' : 'soft');
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Side ${i + 1}`;
    div.appendChild(img);
    flipbook.appendChild(div);
  });

  const isMobile = window.innerWidth < 900;

  pageFlip = new St.PageFlip(flipbook, {
    width: Math.round(pageWidth),
    height: Math.round(pageHeight),
    size: 'stretch',
    minWidth: 200,
    maxWidth: 800,
    minHeight: 280,
    maxHeight: 1200,
    showCover: true,
    maxShadowOpacity: 0.5,
    mobileScrollSupport: true,
    autoSize: true,
    drawShadow: true,
    flippingTime: 800,
    usePortrait: isMobile,
    startZIndex: 0,
    startPage: 0,
  });

  pageFlip.loadFromHTML(flipbook.querySelectorAll('.page-content'));

  pageFlip.on('flip', (e) => {
    updatePageInfo(e.data);
  });

  updatePageInfo(0);
  updateNavButtons();
}

function rebuildFlipbook(restorePage) {
  if (pageFlip) {
    pageFlip.destroy();
    pageFlip = null;
  }

  flipbook.innerHTML = '';
  pageImages.forEach((src, i) => {
    const div = document.createElement('div');
    div.className = 'page-content';
    div.setAttribute('data-density', (i === 0 || i === pageImages.length - 1) ? 'hard' : 'soft');
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Side ${i + 1}`;
    div.appendChild(img);
    flipbook.appendChild(div);
  });

  const container = document.querySelector('.reader-container');
  const maxH = container.clientHeight - 40;
  const maxW = (container.clientWidth - 120) / 2;
  const isMobile = window.innerWidth < 900;

  pageFlip = new St.PageFlip(flipbook, {
    width: Math.round(maxW),
    height: Math.round(maxH),
    size: 'stretch',
    minWidth: 200,
    maxWidth: 800,
    minHeight: 280,
    maxHeight: 1200,
    showCover: true,
    maxShadowOpacity: 0.5,
    mobileScrollSupport: true,
    autoSize: true,
    drawShadow: true,
    flippingTime: 800,
    usePortrait: isMobile,
    startZIndex: 0,
    startPage: restorePage || 0,
  });

  pageFlip.loadFromHTML(flipbook.querySelectorAll('.page-content'));

  pageFlip.on('flip', (e) => {
    updatePageInfo(e.data);
  });

  updatePageInfo(restorePage || 0);
}

function updatePageInfo(pageIndex) {
  const displayPage = pageIndex + 1;
  pageInfo.textContent = `Side ${displayPage} af ${totalPages}`;
  pageSlider.value = displayPage;
  pageSlider.max = totalPages;
  updateNavButtons();
}

function updateNavButtons() {
  if (!pageFlip) return;
  const current = pageFlip.getCurrentPageIndex();
  const total = pageFlip.getPageCount();
  btnPrev.disabled = current <= 0;
  btnNext.disabled = current >= total - 1;
}

function closeReader() {
  readerView.classList.add('hidden');
  libraryView.classList.remove('hidden');
  if (pageFlip) {
    pageFlip.destroy();
    pageFlip = null;
  }
  if (pdfDoc) {
    pdfDoc.destroy();
    pdfDoc = null;
  }
  pageImages = [];
}

// Navigation
btnPrev.addEventListener('click', () => {
  if (pageFlip) pageFlip.flipPrev();
});

btnNext.addEventListener('click', () => {
  if (pageFlip) pageFlip.flipNext();
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
  if (pageFlip) pageFlip.turnToPage(page - 1);
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (readerView.classList.contains('hidden')) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    if (pageFlip) pageFlip.flipPrev();
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
    e.preventDefault();
    if (pageFlip) pageFlip.flipNext();
  } else if (e.key === 'Escape') {
    closeReader();
  }
});

// Resize handler
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (!readerView.classList.contains('hidden') && pageFlip) {
      const currentPage = pageFlip.getCurrentPageIndex();
      rebuildFlipbook(currentPage);
    }
  }, 300);
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
