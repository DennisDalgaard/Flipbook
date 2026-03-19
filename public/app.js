// ============ STATE ============
let currentPdf = null;
let pdfDoc = null;
let pageFlip = null;
let totalPages = 0;
let pageImages = []; // data URLs for each page
let adminToken = localStorage.getItem('adminToken') || null;
let isAdmin = false;

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
const adminBtn = document.getElementById('admin-btn');
const adminBtnText = document.getElementById('admin-btn-text');
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const loginCancel = document.getElementById('login-cancel');
const uploadSection = document.querySelector('.upload-section');
const flipbook = document.getElementById('flipbook');
const pageInfo = document.getElementById('page-info');
const pageSlider = document.getElementById('page-slider');
const readerTitle = document.getElementById('reader-title');
const btnBack = document.getElementById('btn-back');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnDownload = document.getElementById('btn-download');
const btnFullscreen = document.getElementById('btn-fullscreen');

// ============ ADMIN ============
async function checkAdmin() {
  if (!adminToken) {
    setAdminUI(false);
    return;
  }
  try {
    const res = await fetch('/api/auth-check', {
      headers: { 'Authorization': 'Bearer ' + adminToken }
    });
    const data = await res.json();
    setAdminUI(data.admin);
    if (!data.admin) {
      adminToken = null;
      localStorage.removeItem('adminToken');
    }
  } catch {
    setAdminUI(false);
  }
}

function setAdminUI(admin) {
  isAdmin = admin;
  if (admin) {
    uploadSection.classList.remove('hidden');
    adminBtn.classList.add('logged-in');
    adminBtnText.textContent = 'Log out';
  } else {
    uploadSection.classList.add('hidden');
    adminBtn.classList.remove('logged-in');
    adminBtnText.textContent = 'Admin';
  }
  // Re-render grid to show/hide delete buttons
  loadLibrary();
}

adminBtn.addEventListener('click', () => {
  if (isAdmin) {
    // Log out
    adminToken = null;
    localStorage.removeItem('adminToken');
    setAdminUI(false);
  } else {
    loginModal.classList.remove('hidden');
    loginPassword.value = '';
    loginError.classList.add('hidden');
    loginPassword.focus();
  }
});

loginCancel.addEventListener('click', () => {
  loginModal.classList.add('hidden');
});

loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal) loginModal.classList.add('hidden');
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: loginPassword.value })
    });
    if (!res.ok) {
      loginError.classList.remove('hidden');
      return;
    }
    const data = await res.json();
    adminToken = data.token;
    localStorage.setItem('adminToken', adminToken);
    loginModal.classList.add('hidden');
    setAdminUI(true);
  } catch {
    loginError.classList.remove('hidden');
  }
});

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
    pdfCount.textContent = '0 catalogs';
    return;
  }

  emptyState.classList.add('hidden');
  pdfCount.textContent = `${pdfs.length} catalog${pdfs.length !== 1 ? 's' : ''}`;

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
      ${isAdmin ? `<button class="pdf-card-delete" data-id="${pdf.id}" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>` : ''}
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.pdf-card-delete')) return;
      openReader(pdf);
    });

    const deleteBtn = card.querySelector('.pdf-card-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${pdf.originalName}"?`)) return;
        await fetch(`/api/pdfs/${pdf.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + adminToken }
        });
        loadLibrary();
      });
    }

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
  progressText.textContent = 'Uploading...';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload');
  xhr.setRequestHeader('Authorization', 'Bearer ' + adminToken);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = pct + '%';
      progressText.textContent = `${pct}%`;
    }
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      progressText.textContent = 'Done!';
      setTimeout(() => uploadProgress.classList.add('hidden'), 1500);
      loadLibrary();
    } else {
      progressText.textContent = 'Upload failed';
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
  return canvas.toDataURL('image/png');
}

async function openReader(pdf) {
  currentPdf = pdf;
  pageImages = [];

  libraryView.classList.add('hidden');
  readerView.classList.remove('hidden');
  readerTitle.textContent = pdf.originalName;

  flipbook.innerHTML = '<div class="loading-spinner"></div>';

  // Wait for browser to layout the reader view before measuring dimensions
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    pdfDoc = await pdfjsLib.getDocument(`/uploads/${pdf.filename}`).promise;
    totalPages = pdfDoc.numPages;
    pageSlider.max = totalPages;
    pageSlider.value = 1;

    const container = document.querySelector('.reader-container');
    const containerH = Math.max(container.clientHeight - 40, 400);
    const containerW = Math.max(container.clientWidth - 120, 600);

    const firstPage = await pdfDoc.getPage(1);
    const origViewport = firstPage.getViewport({ scale: 1 });
    const pageAspect = origViewport.width / origViewport.height;

    // In book mode (2 pages side by side), each page gets half the width
    const isMobile = window.innerWidth < 900;
    const availW = isMobile ? containerW : containerW / 2;

    // Fit to height first, then check if width fits
    const scaleByH = containerH / origViewport.height;
    const scaleByW = availW / origViewport.width;
    const displayScale = Math.min(scaleByH, scaleByW);

    const displayW = Math.round(origViewport.width * displayScale);
    const displayH = Math.round(origViewport.height * displayScale);

    // Render at higher resolution for crisp text (2x the display size, min 3)
    const renderScale = Math.max(displayScale * 2, 3);

    // Render all pages before initializing flipbook
    for (let i = 1; i <= totalPages; i++) {
      if (!pdfDoc) return;
      const img = await renderPageToImage(pdfDoc, i, renderScale);
      pageImages.push(img);
    }

    // Initialize flipbook with height-fitted dimensions
    initFlipbook(displayW, displayH);
  } catch (err) {
    flipbook.innerHTML = '<p style="color:#ef4444">Could not load PDF</p>';
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
    img.alt = `Page ${i + 1}`;
    div.appendChild(img);
    flipbook.appendChild(div);
  });

  const isMobile = window.innerWidth < 900;

  pageFlip = new St.PageFlip(flipbook, {
    width: pageWidth,
    height: pageHeight,
    size: 'fixed',
    minWidth: 200,
    maxWidth: pageWidth,
    minHeight: 280,
    maxHeight: pageHeight,
    showCover: true,
    maxShadowOpacity: 0.5,
    mobileScrollSupport: true,
    autoSize: false,
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
  if (pageImages.length === 0) return;

  flipbook.innerHTML = '';
  pageImages.forEach((src, i) => {
    const div = document.createElement('div');
    div.className = 'page-content';
    div.setAttribute('data-density', (i === 0 || i === pageImages.length - 1) ? 'hard' : 'soft');
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Page ${i + 1}`;
    div.appendChild(img);
    flipbook.appendChild(div);
  });

  const container = document.querySelector('.reader-container');
  const containerH = Math.max(container.clientHeight - 40, 400);
  const containerW = Math.max(container.clientWidth - 120, 600);
  const isMobile = window.innerWidth < 900;

  // Estimate page aspect from the first image
  const tempImg = new Image();
  tempImg.src = pageImages[0];
  const imgW = tempImg.naturalWidth || 600;
  const imgH = tempImg.naturalHeight || 800;
  const pageAspect = imgW / imgH;

  const availW = isMobile ? containerW : containerW / 2;
  const scaleByH = containerH / imgH;
  const scaleByW = availW / imgW;
  const fitScale = Math.min(scaleByH, scaleByW);

  const displayW = Math.round(imgW * fitScale);
  const displayH = Math.round(imgH * fitScale);

  pageFlip = new St.PageFlip(flipbook, {
    width: displayW,
    height: displayH,
    size: 'fixed',
    minWidth: 200,
    maxWidth: displayW,
    minHeight: 280,
    maxHeight: displayH,
    showCover: true,
    maxShadowOpacity: 0.5,
    mobileScrollSupport: true,
    autoSize: false,
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
  pageInfo.textContent = `Page ${displayPage} of ${totalPages}`;
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
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============ INIT ============
checkAdmin();
