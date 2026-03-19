// ============ STATE ============
let currentPdf = null;
let pdfDoc = null;
let pageFlip = null;
let totalPages = 0;
let pageImages = []; // data URLs for each page
let origPageWidth = 0; // original PDF page width (scale 1)
let origPageHeight = 0; // original PDF page height (scale 1)
let adminToken = localStorage.getItem('adminToken') || null;
let isAdmin = false;

// ============ LANGUAGE ============
const LANGUAGES = {
  '': 'Unknown',
  'da': 'Dansk',
  'en': 'English',
  'de': 'Deutsch',
  'sv': 'Svenska',
  'no': 'Norsk',
  'nl': 'Nederlands',
  'fr': 'Français',
  'es': 'Español',
  'it': 'Italiano',
  'pt': 'Português',
  'pl': 'Polski',
  'fi': 'Suomi',
  'cs': 'Čeština',
  'ro': 'Română',
  'hu': 'Magyar',
  'bg': 'Български',
  'el': 'Ελληνικά',
};

// Simple language detection from text using common words
function detectLanguage(text) {
  const lower = text.toLowerCase();
  const patterns = [
    { lang: 'da', words: ['og', 'den', 'det', 'er', 'til', 'med', 'som', 'kan', 'på', 'af', 'ikke', 'har', 'fra', 'eller', 'også', 'være', 'blev', 'efter', 'inden', 'alle'] },
    { lang: 'en', words: ['the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'are', 'not', 'but', 'been', 'they', 'which', 'will', 'their', 'would', 'about', 'could', 'into'] },
    { lang: 'de', words: ['und', 'die', 'der', 'das', 'ist', 'ein', 'eine', 'für', 'mit', 'auf', 'nicht', 'sich', 'auch', 'werden', 'nach', 'noch', 'wird', 'über', 'kann', 'haben'] },
    { lang: 'sv', words: ['och', 'att', 'det', 'som', 'för', 'med', 'den', 'inte', 'har', 'till', 'från', 'kan', 'vara', 'också', 'efter', 'eller', 'alla', 'denna', 'blev', 'ska'] },
    { lang: 'no', words: ['og', 'det', 'som', 'for', 'med', 'den', 'ikke', 'har', 'til', 'fra', 'kan', 'være', 'også', 'etter', 'eller', 'alle', 'denne', 'ble', 'skal', 'vil'] },
    { lang: 'nl', words: ['het', 'een', 'van', 'dat', 'met', 'zijn', 'niet', 'voor', 'ook', 'maar', 'worden', 'heeft', 'naar', 'deze', 'nog', 'door', 'wel', 'werd', 'toen', 'alle'] },
    { lang: 'fr', words: ['les', 'des', 'est', 'une', 'que', 'dans', 'pour', 'pas', 'qui', 'sur', 'avec', 'sont', 'mais', 'par', 'plus', 'tout', 'cette', 'nous', 'elle', 'comme'] },
    { lang: 'es', words: ['que', 'los', 'del', 'las', 'una', 'por', 'con', 'para', 'como', 'pero', 'más', 'todo', 'esta', 'son', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'puede'] },
    { lang: 'it', words: ['che', 'del', 'per', 'una', 'con', 'non', 'sono', 'anche', 'come', 'più', 'questo', 'stato', 'dalla', 'essere', 'suo', 'questa', 'fatto', 'tutto', 'hanno', 'nel'] },
    { lang: 'pt', words: ['que', 'uma', 'para', 'com', 'não', 'por', 'mais', 'como', 'dos', 'das', 'tem', 'mas', 'foi', 'isso', 'ser', 'são', 'está', 'bem', 'sua', 'pelo'] },
    { lang: 'pl', words: ['nie', 'jest', 'się', 'jak', 'ale', 'tak', 'już', 'czy', 'tylko', 'jego', 'ten', 'tego', 'był', 'przez', 'tym', 'dla', 'tej', 'aby', 'jeszcze', 'może'] },
    { lang: 'fi', words: ['oli', 'hän', 'kun', 'olla', 'sen', 'mutta', 'niin', 'kuin', 'vain', 'ovat', 'tämä', 'sitten', 'myös', 'nyt', 'minä', 'ole', 'kanssa', 'mitä', 'kaikki', 'itse'] },
  ];

  // Count word boundary matches
  const scores = patterns.map(({ lang, words }) => {
    let score = 0;
    for (const w of words) {
      const regex = new RegExp('\\b' + w + '\\b', 'gi');
      const matches = lower.match(regex);
      if (matches) score += matches.length;
    }
    return { lang, score };
  });

  scores.sort((a, b) => b.score - a.score);
  // Require a minimum threshold and some margin over 2nd place
  if (scores[0].score > 5 && scores[0].score > scores[1].score * 1.3) {
    return scores[0].lang;
  }
  return '';
}

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

  // Auto-detect language for PDFs that don't have one (admin only, runs in background)
  if (isAdmin) {
    for (const pdf of pdfs) {
      if (!pdf.language) {
        autoDetectAndSave(pdf);
      }
    }
  }
}

async function autoDetectAndSave(pdf) {
  try {
    const doc = await pdfjsLib.getDocument(`/uploads/${pdf.filename}`).promise;
    let text = '';
    const pagesToCheck = Math.min(doc.numPages, 3);
    for (let i = 1; i <= pagesToCheck; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + ' ';
    }
    doc.destroy();
    const detected = detectLanguage(text);
    if (detected) {
      await fetch(`/api/pdfs/${pdf.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + adminToken
        },
        body: JSON.stringify({ language: detected })
      });
      // Refresh grid to show the badge
      const res = await fetch('/api/pdfs');
      const updatedPdfs = await res.json();
      renderGrid(updatedPdfs);
    }
  } catch {
    // Silently fail for auto-detect
  }
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
    const langLabel = pdf.language && LANGUAGES[pdf.language] ? LANGUAGES[pdf.language] : '';
    const langCode = pdf.language || '';
    card.innerHTML = `
      <div class="pdf-card-thumbnail" data-id="${pdf.id}">
        ${langLabel ? `<span class="lang-badge">${escapeHtml(langLabel)}</span>` : ''}
      </div>
      <div class="pdf-card-info">
        <div class="pdf-card-name" title="${escapeHtml(pdf.originalName)}">${escapeHtml(pdf.originalName)}</div>
        <div class="pdf-card-meta">
          <span>${formatSize(pdf.size)}</span>
          <span>${formatDate(pdf.uploadedAt)}</span>
        </div>
      </div>
      ${isAdmin ? `<div class="pdf-card-actions">
        <button class="pdf-card-lang-edit" data-id="${pdf.id}" data-lang="${langCode}" title="Edit language">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span>${langLabel || 'Set language'}</span>
        </button>
        <button class="pdf-card-delete" data-id="${pdf.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>` : ''}
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.pdf-card-actions')) return;
      openReader(pdf);
    });

    const langEditBtn = card.querySelector('.pdf-card-lang-edit');
    if (langEditBtn) {
      langEditBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openLanguageModal(pdf);
      });
    }

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

async function detectLanguageFromPdf(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    // Extract text from first 3 pages
    const pagesToCheck = Math.min(doc.numPages, 3);
    for (let i = 1; i <= pagesToCheck; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + ' ';
    }
    doc.destroy();
    return detectLanguage(text);
  } catch {
    return '';
  }
}

async function uploadFile(file) {
  uploadProgress.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = 'Detecting language...';

  // Auto-detect language before uploading
  const detectedLang = await detectLanguageFromPdf(file);

  const formData = new FormData();
  formData.append('pdf', file);
  if (detectedLang) formData.append('language', detectedLang);

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
      const langName = detectedLang ? LANGUAGES[detectedLang] || detectedLang : '';
      progressText.textContent = langName ? `Done! (${langName})` : 'Done!';
      setTimeout(() => uploadProgress.classList.add('hidden'), 2000);
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
    origPageWidth = origViewport.width;
    origPageHeight = origViewport.height;

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
  if (pageImages.length === 0 || !origPageWidth) return;

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

  const availW = isMobile ? containerW : containerW / 2;
  const scaleByH = containerH / origPageHeight;
  const scaleByW = availW / origPageWidth;
  const fitScale = Math.min(scaleByH, scaleByW);

  const displayW = Math.round(origPageWidth * fitScale);
  const displayH = Math.round(origPageHeight * fitScale);

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
  detailView.classList.add('hidden');
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

// Rebuild flipbook when entering/exiting fullscreen
document.addEventListener('fullscreenchange', () => {
  if (readerView.classList.contains('hidden')) return;
  if (!pageFlip && !pageImages.length) return;

  // Wait for fullscreen transition to finish, then rebuild
  setTimeout(() => {
    const currentPage = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
    rebuildFlipbook(currentPage);
  }, 500);
});

pageSlider.addEventListener('input', () => {
  const page = parseInt(pageSlider.value);
  if (pageFlip) pageFlip.turnToPage(page - 1);
});

// Keyboard navigation (flipbook mode only)
document.addEventListener('keydown', (e) => {
  if (readerView.classList.contains('hidden')) return;
  if (!detailView.classList.contains('hidden')) return; // detail view handles its own keys
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

// ============ MAGNIFYING GLASS ============
const MAGNIFIER_SIZE = 180;   // diameter in px
const MAGNIFIER_ZOOM = 2.5;   // zoom factor
const LONG_PRESS_MS = 300;    // ms to trigger on mobile

const magnifier = document.createElement('canvas');
magnifier.id = 'magnifier';
magnifier.width = MAGNIFIER_SIZE * 2;  // hi-dpi
magnifier.height = MAGNIFIER_SIZE * 2;
magnifier.style.cssText = `
  position: fixed; width: ${MAGNIFIER_SIZE}px; height: ${MAGNIFIER_SIZE}px;
  border-radius: 50%; border: 3px solid rgba(255,255,255,0.9);
  box-shadow: 0 4px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.15);
  pointer-events: none; z-index: 9999; display: none;
  image-rendering: auto;
`;
document.body.appendChild(magnifier);
const magCtx = magnifier.getContext('2d');

let magActive = false;
let longPressTimer = null;
let magImg = null; // Image element for the current page source

function findPageImgAt(x, y) {
  // Find which page image element is under the pointer
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    // Direct img hit or img inside a page-content parent
    if (el.tagName === 'IMG' && el.closest('.page-content')) {
      return el;
    }
    // page-content div (img may have pointer-events: none)
    if (el.classList && el.classList.contains('page-content')) {
      const img = el.querySelector('img');
      if (img) return img;
    }
    // Canvas rendered by stPageFlip
    if (el.tagName === 'CANVAS' && el.closest('.stf__parent')) {
      return el;
    }
    // stf wrapper divs — look for canvas inside
    if (el.closest && el.closest('.stf__parent')) {
      const canvas = el.closest('.stf__parent').querySelector('canvas');
      if (canvas) return canvas;
    }
  }
  return null;
}

function drawMagnifier(clientX, clientY) {
  if (!magImg) return;

  // Position magnifier above finger on mobile, centered on cursor on desktop
  const isMobile = 'ontouchstart' in window;
  const offsetY = isMobile ? -MAGNIFIER_SIZE - 30 : -MAGNIFIER_SIZE / 2;
  const left = clientX - MAGNIFIER_SIZE / 2;
  const top = clientY + offsetY;
  magnifier.style.left = Math.max(0, Math.min(left, window.innerWidth - MAGNIFIER_SIZE)) + 'px';
  magnifier.style.top = Math.max(0, top) + 'px';

  // Calculate source coordinates relative to the image/canvas
  const rect = magImg.getBoundingClientRect();
  const relX = (clientX - rect.left) / rect.width;
  const relY = (clientY - rect.top) / rect.height;

  // Source dimensions (the actual image/canvas pixel size)
  const srcW = magImg.naturalWidth || magImg.width;
  const srcH = magImg.naturalHeight || magImg.height;

  // Area to sample from the source
  const sampleW = (MAGNIFIER_SIZE / rect.width) * srcW / MAGNIFIER_ZOOM;
  const sampleH = (MAGNIFIER_SIZE / rect.height) * srcH / MAGNIFIER_ZOOM;
  const sx = relX * srcW - sampleW / 2;
  const sy = relY * srcH - sampleH / 2;

  magCtx.clearRect(0, 0, magnifier.width, magnifier.height);
  magCtx.save();
  magCtx.beginPath();
  magCtx.arc(magnifier.width / 2, magnifier.height / 2, magnifier.width / 2, 0, Math.PI * 2);
  magCtx.clip();
  magCtx.imageSmoothingEnabled = true;
  magCtx.imageSmoothingQuality = 'high';
  magCtx.drawImage(magImg, sx, sy, sampleW, sampleH, 0, 0, magnifier.width, magnifier.height);
  magCtx.restore();
}

function startMagnifier(clientX, clientY) {
  const target = findPageImgAt(clientX, clientY);
  if (!target) return;
  magImg = target;
  magActive = true;
  magnifier.style.display = 'block';
  drawMagnifier(clientX, clientY);
}

function moveMagnifier(clientX, clientY) {
  if (!magActive) return;
  // Update target image in case user moves across page boundary
  const target = findPageImgAt(clientX, clientY);
  if (target) magImg = target;
  drawMagnifier(clientX, clientY);
}

function stopMagnifier() {
  magActive = false;
  magImg = null;
  magnifier.style.display = 'none';
  clearTimeout(longPressTimer);
  longPressTimer = null;
}

// Desktop: hold mouse button on flipbook
const readerContainer = document.querySelector('.reader-container');

// Prevent native long-press context menu on mobile
readerContainer.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

readerContainer.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return; // left button only
  if (readerView.classList.contains('hidden')) return;
  longPressTimer = setTimeout(() => {
    startMagnifier(e.clientX, e.clientY);
  }, LONG_PRESS_MS);
});

document.addEventListener('mousemove', (e) => {
  if (magActive) {
    e.preventDefault();
    moveMagnifier(e.clientX, e.clientY);
  }
});

document.addEventListener('mouseup', () => {
  stopMagnifier();
});

// Mobile: long-press touch on flipbook
// Track touch state to distinguish long-press from swipe
let touchStartX = 0, touchStartY = 0;
let touchIsHolding = false; // true once long-press timer is set, before swipe detected
const SWIPE_THRESHOLD = 15; // px movement to count as swipe

readerContainer.addEventListener('touchstart', (e) => {
  if (readerView.classList.contains('hidden')) return;
  if (e.touches.length !== 1) return;
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchIsHolding = true;
  longPressTimer = setTimeout(() => {
    startMagnifier(touch.clientX, touch.clientY);
  }, LONG_PRESS_MS);
}, { passive: true });

readerContainer.addEventListener('touchend', () => {
  touchIsHolding = false;
  stopMagnifier();
});

readerContainer.addEventListener('touchcancel', () => {
  touchIsHolding = false;
  stopMagnifier();
});

// Capture-phase listeners on flipbook: block StPageFlip AND handle magnifier
// movement in the same listener (since stopPropagation prevents bubble-phase).
flipbook.addEventListener('touchmove', (e) => {
  if (magActive) {
    // Move the magnifier and block StPageFlip
    e.stopPropagation();
    e.preventDefault();
    const touch = e.touches[0];
    moveMagnifier(touch.clientX, touch.clientY);
  } else if (touchIsHolding && longPressTimer) {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);
    if (dx > SWIPE_THRESHOLD || dy > SWIPE_THRESHOLD) {
      // User is swiping — cancel long-press, let StPageFlip handle it
      clearTimeout(longPressTimer);
      longPressTimer = null;
      touchIsHolding = false;
    } else {
      // Still holding still — block StPageFlip while waiting for long-press
      e.stopPropagation();
      e.preventDefault();
    }
  }
}, { capture: true, passive: false });

flipbook.addEventListener('touchend', (e) => {
  if (magActive) {
    e.stopPropagation();
    stopMagnifier();
  }
}, { capture: true });

// Tap magnifier to dismiss it
magnifier.addEventListener('click', () => {
  stopMagnifier();
});

// ============ DETAIL VIEW (zoom + text) ============
const detailView = document.getElementById('detail-view');
const detailCanvas = document.getElementById('detail-canvas');
const detailTextLayer = document.getElementById('detail-text-layer');
const detailContainer = document.getElementById('detail-container');
const detailPageWrapper = document.getElementById('detail-page-wrapper');
const detailTitle = document.getElementById('detail-title');
const detailPageInfo = document.getElementById('detail-page-info');
const detailZoomLevel = document.getElementById('detail-zoom-level');
const btnDetail = document.getElementById('btn-detail');
const detailBtnBack = document.getElementById('detail-btn-back');
const detailPrev = document.getElementById('detail-prev');
const detailNext = document.getElementById('detail-next');
const detailZoomIn = document.getElementById('detail-zoom-in');
const detailZoomOut = document.getElementById('detail-zoom-out');
const detailZoomFit = document.getElementById('detail-zoom-fit');

let detailCurrentPage = 1;
let detailZoom = 1;
let detailBaseScale = 1; // scale that fits page to container height

function openDetailView() {
  // Get current page from flipbook
  detailCurrentPage = pageFlip ? pageFlip.getCurrentPageIndex() + 1 : 1;
  readerView.classList.add('hidden');
  detailView.classList.remove('hidden');
  detailTitle.textContent = currentPdf ? currentPdf.originalName : 'Document';

  // Calculate fit-to-height scale
  const containerH = detailContainer.clientHeight - 32;
  const page1 = pdfDoc.getPage(1).then(p => {
    const vp = p.getViewport({ scale: 1 });
    detailBaseScale = containerH / vp.height;
    detailZoom = 1;
    renderDetailPage();
  });
}

async function renderDetailPage() {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(detailCurrentPage);
  const scale = detailBaseScale * detailZoom;
  const viewport = page.getViewport({ scale });

  detailCanvas.width = viewport.width;
  detailCanvas.height = viewport.height;
  detailPageWrapper.style.width = viewport.width + 'px';
  detailPageWrapper.style.height = viewport.height + 'px';

  const ctx = detailCanvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Render text layer using PDF.js built-in renderTextLayer
  detailTextLayer.innerHTML = '';
  detailTextLayer.style.width = viewport.width + 'px';
  detailTextLayer.style.height = viewport.height + 'px';

  const textContent = await page.getTextContent();
  pdfjsLib.renderTextLayer({
    textContentSource: textContent,
    container: detailTextLayer,
    viewport: viewport,
    textDivs: []
  });

  // Update UI
  detailPageInfo.textContent = `Page ${detailCurrentPage} of ${totalPages}`;
  detailZoomLevel.textContent = Math.round(detailZoom * 100) + '%';
  detailPrev.disabled = detailCurrentPage <= 1;
  detailNext.disabled = detailCurrentPage >= totalPages;
}

function closeDetailView() {
  detailView.classList.add('hidden');
  readerView.classList.remove('hidden');
  // Sync page back to flipbook
  if (pageFlip) {
    pageFlip.turnToPage(detailCurrentPage - 1);
  }
}

btnDetail.addEventListener('click', openDetailView);
detailBtnBack.addEventListener('click', closeDetailView);

detailPrev.addEventListener('click', () => {
  if (detailCurrentPage > 1) {
    detailCurrentPage--;
    renderDetailPage();
    detailContainer.scrollTop = 0;
  }
});

detailNext.addEventListener('click', () => {
  if (detailCurrentPage < totalPages) {
    detailCurrentPage++;
    renderDetailPage();
    detailContainer.scrollTop = 0;
  }
});

detailZoomIn.addEventListener('click', () => {
  detailZoom = Math.min(detailZoom + 0.25, 5);
  renderDetailPage();
});

detailZoomOut.addEventListener('click', () => {
  detailZoom = Math.max(detailZoom - 0.25, 0.25);
  renderDetailPage();
});

detailZoomFit.addEventListener('click', () => {
  detailZoom = 1;
  renderDetailPage();
  detailContainer.scrollTop = 0;
});

// Scroll-wheel zoom in detail view
detailContainer.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    detailZoom = Math.min(Math.max(detailZoom + delta, 0.25), 5);
    renderDetailPage();
  }
});

// Pinch-to-zoom on mobile in detail view
let pinchStartDist = 0;
let pinchStartZoom = 1;

detailContainer.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    pinchStartDist = Math.hypot(dx, dy);
    pinchStartZoom = detailZoom;
  }
}, { passive: false });

detailContainer.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const scale = dist / pinchStartDist;
    detailZoom = Math.min(Math.max(pinchStartZoom * scale, 0.25), 5);
    renderDetailPage();
  }
}, { passive: false });

// Keyboard navigation in detail view
document.addEventListener('keydown', (e) => {
  if (detailView.classList.contains('hidden')) return;
  if (e.key === 'ArrowLeft') {
    if (detailCurrentPage > 1) { detailCurrentPage--; renderDetailPage(); detailContainer.scrollTop = 0; }
  } else if (e.key === 'ArrowRight') {
    if (detailCurrentPage < totalPages) { detailCurrentPage++; renderDetailPage(); detailContainer.scrollTop = 0; }
  } else if (e.key === 'Escape') {
    closeDetailView();
  } else if (e.key === '+' || e.key === '=') {
    detailZoom = Math.min(detailZoom + 0.25, 5);
    renderDetailPage();
  } else if (e.key === '-') {
    detailZoom = Math.max(detailZoom - 0.25, 0.25);
    renderDetailPage();
  }
});

// ============ LANGUAGE MODAL ============
function openLanguageModal(pdf) {
  // Remove existing modal if any
  const existing = document.getElementById('lang-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'lang-modal';
  modal.className = 'modal-overlay';
  const currentLang = pdf.language || '';

  let options = '';
  for (const [code, name] of Object.entries(LANGUAGES)) {
    options += `<option value="${code}" ${code === currentLang ? 'selected' : ''}>${name}</option>`;
  }

  modal.innerHTML = `
    <div class="modal">
      <h3>Set Language</h3>
      <p class="lang-modal-file">${escapeHtml(pdf.originalName)}</p>
      <select id="lang-select" class="lang-select">${options}</select>
      <div class="modal-actions">
        <button type="button" id="lang-cancel" class="btn-secondary">Cancel</button>
        <button type="button" id="lang-detect" class="btn-secondary">Auto-detect</button>
        <button type="button" id="lang-save" class="btn-primary">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const select = document.getElementById('lang-select');

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.getElementById('lang-cancel').addEventListener('click', () => modal.remove());

  document.getElementById('lang-detect').addEventListener('click', async () => {
    const btn = document.getElementById('lang-detect');
    btn.textContent = 'Detecting...';
    btn.disabled = true;
    try {
      const doc = await pdfjsLib.getDocument(`/uploads/${pdf.filename}`).promise;
      let text = '';
      const pagesToCheck = Math.min(doc.numPages, 3);
      for (let i = 1; i <= pagesToCheck; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + ' ';
      }
      doc.destroy();
      const detected = detectLanguage(text);
      if (detected) {
        select.value = detected;
        btn.textContent = `Detected: ${LANGUAGES[detected]}`;
      } else {
        btn.textContent = 'Could not detect';
      }
    } catch {
      btn.textContent = 'Detection failed';
    }
    setTimeout(() => {
      btn.textContent = 'Auto-detect';
      btn.disabled = false;
    }, 2000);
  });

  document.getElementById('lang-save').addEventListener('click', async () => {
    const lang = select.value;
    await fetch(`/api/pdfs/${pdf.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + adminToken
      },
      body: JSON.stringify({ language: lang })
    });
    modal.remove();
    loadLibrary();
  });
}

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
