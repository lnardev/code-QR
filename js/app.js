const DEBOUNCE_MS = 150;
const REVOKE_DELAY_MS = 1000;

const input = document.getElementById('inputText');
const levelSelect = document.getElementById('levelSelect');
const sizeSelect = document.getElementById('sizeSelect');
const clearBtn = document.getElementById('clearBtn');
const downloadPngBtn = document.getElementById('downloadPngBtn');
const downloadSvgBtn = document.getElementById('downloadSvgBtn');
const copyBtn = document.getElementById('copyBtn');
const canvas = document.getElementById('qrCanvas');
const placeholder = document.getElementById('placeholder');
const errorEl = document.getElementById('error');
const themeToggle = document.getElementById('themeToggle');

const canCopyImage = Boolean(navigator.clipboard && window.ClipboardItem);
const actionButtons = [downloadPngBtn, downloadSvgBtn, copyBtn];

let matrix = null;
let renderTimer = 0;

if (!canCopyImage) {
  copyBtn.title = 'Tu navegador no permite copiar imágenes. Usa la descarga.';
}

function setError(message) {
  errorEl.textContent = message;
  errorEl.hidden = message === '';
}

function config() {
  return QrCore.options({ size: Number(sizeSelect.value), level: levelSelect.value });
}

function drawCanvas(size) {
  const opts = config();
  const { pixels, edges } = QrCore.layout(matrix.count, size, opts.margin);
  canvas.width = pixels;
  canvas.height = pixels;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = opts.color.light;
  ctx.fillRect(0, 0, pixels, pixels);
  ctx.fillStyle = opts.color.dark;
  for (let row = 0; row < matrix.count; row++) {
    for (let col = 0; col < matrix.count; col++) {
      if (matrix.isDark(row, col)) {
        const x = edges[col + opts.margin];
        const y = edges[row + opts.margin];
        ctx.fillRect(x, y, edges[col + opts.margin + 1] - x, edges[row + opts.margin + 1] - y);
      }
    }
  }
}

/** Single owner of QR state: canvas, placeholder, error and button availability. */
function render() {
  clearTimeout(renderTimer);
  const text = input.value;
  const check = QrCore.validate(text, levelSelect.value);
  matrix = check.ok ? QrCore.encode(qrcode, text, levelSelect.value) : null;

  setError(check.ok || text.trim() === '' ? '' : check.error);
  canvas.hidden = matrix === null;
  placeholder.hidden = matrix !== null;
  for (const btn of actionButtons) btn.disabled = matrix === null;
  copyBtn.disabled = matrix === null || !canCopyImage;
  if (matrix) drawCanvas(Number(sizeSelect.value));
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, DEBOUNCE_MS);
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

function downloadPng() {
  if (!matrix) return;
  canvas.toBlob((blob) => saveBlob(blob, QrCore.fileName('png')), 'image/png');
}

function downloadSvg() {
  if (!matrix) return;
  const svg = QrCore.toSvg(matrix, config());
  saveBlob(new Blob([svg], { type: 'image/svg+xml' }), QrCore.fileName('svg'));
}

async function copyImage() {
  if (!matrix) return;
  try {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    copyBtn.textContent = 'Copiado ✓';
    setTimeout(() => (copyBtn.textContent = 'Copiar imagen'), 1500);
  } catch {
    setError('No se pudo copiar. Descarga la imagen.');
  }
}

function clearAll() {
  input.value = '';
  render();
  input.focus();
}

/* Theme */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
}

function initTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) {
    applyTheme(stored);
    return;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('theme', next);
}

input.addEventListener('input', scheduleRender);
levelSelect.addEventListener('change', render);
sizeSelect.addEventListener('change', render);
clearBtn.addEventListener('click', clearAll);
downloadPngBtn.addEventListener('click', downloadPng);
downloadSvgBtn.addEventListener('click', downloadSvg);
copyBtn.addEventListener('click', copyImage);
themeToggle.addEventListener('click', toggleTheme);

initTheme();
render();
