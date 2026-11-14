const input = document.getElementById('inputText');
const generateBtn = document.getElementById('generateBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const qrBox = document.getElementById('qr');
const errorEl = document.getElementById('error');
const themeToggle = document.getElementById('themeToggle');

let qrInstance = null;

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.textContent = '';
  errorEl.hidden = true;
}

function generate() {
  const value = input.value.trim();
  clearError();
  qrBox.innerHTML = '';
  downloadBtn.disabled = true;
  copyBtn.disabled = true;

  if (!value) {
    showError('Ingresa texto o una URL.');
    return;
  }

  try {
    qrInstance = new QRCode(qrBox, {
      text: value,
      width: 256,
      height: 256,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
    downloadBtn.disabled = false;
    copyBtn.disabled = false;
  } catch (e) {
    showError('No se pudo generar el QR. Verifica la entrada.');
  }
}

function clearAll() {
  input.value = '';
  qrBox.innerHTML = '';
  clearError();
  downloadBtn.disabled = true;
  copyBtn.disabled = true;
  qrInstance = null;
}

function downloadPng() {
  const canvas = qrBox.querySelector('canvas');
  if (!canvas) return;
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qr-code.png';
  a.click();
}

async function copyImage() {
  const canvas = qrBox.querySelector('canvas');
  if (!canvas) return;
  try {
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    copyBtn.textContent = 'Copiado ✓';
    setTimeout(() => (copyBtn.textContent = 'Copiar imagen'), 1500);
  } catch {
    showError('No se pudo copiar. Descarga la imagen.');
  }
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

generateBtn.addEventListener('click', generate);
clearBtn.addEventListener('click', clearAll);
downloadBtn.addEventListener('click', downloadPng);
copyBtn.addEventListener('click', copyImage);
themeToggle.addEventListener('click', toggleTheme);

initTheme();