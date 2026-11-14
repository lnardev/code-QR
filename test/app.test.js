'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const SCRIPTS = ['js/vendor/qrcode.js', 'js/qr-core.js', 'js/app.js'];

/** Loads the real scripts into a vm context with a recording stub DOM. */
function loadApp() {
  const elements = {};
  const rects = [];
  const anchors = [];
  const revoked = [];
  const timers = [];

  const canvasContext = {
    fillRect: (...args) => rects.push(args),
    set fillStyle(_value) {},
  };

  function element(id) {
    if (!elements[id]) {
      elements[id] = {
        id,
        value: { levelSelect: 'M', sizeSelect: '512' }[id] || '',
        hidden: false,
        disabled: false,
        textContent: '',
        title: '',
        width: 0,
        height: 0,
        listeners: {},
        addEventListener(type, listener) {
          this.listeners[type] = listener;
        },
        focus() {},
        getContext: () => canvasContext,
        toBlob: (callback) => callback({ kind: 'png' }),
      };
    }
    return elements[id];
  }

  const context = {
    TextEncoder,
    Blob,
    clearTimeout: (id) => {
      if (timers[id]) timers[id].cancelled = true;
    },
    setTimeout: (callback, delay) => timers.push({ callback, delay, cancelled: false }) - 1,
    document: {
      getElementById: element,
      createElement: () => {
        const anchor = { clicked: false, click() { this.clicked = true; } };
        anchors.push(anchor);
        return anchor;
      },
      documentElement: { setAttribute() {}, getAttribute: () => 'dark' },
    },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: (url) => revoked.push(url) },
    navigator: {},
    localStorage: { getItem: () => null, setItem() {} },
    window: { matchMedia: () => ({ matches: true }) },
  };
  vm.createContext(context);
  for (const file of SCRIPTS) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }

  const run = (code) => vm.runInContext(code, context);
  const pendingTimers = () => timers.filter((timer) => !timer.cancelled);
  return { element, run, rects, anchors, revoked, timers, pendingTimers };
}

function renderText(app, text, { level = 'M', size = '512' } = {}) {
  app.element('inputText').value = text;
  app.element('levelSelect').value = level;
  app.element('sizeSelect').value = size;
  app.run('render()');
}

test('a trailing newline in the textarea does not change the QR', () => {
  const padded = loadApp();
  renderText(padded, 'https://ejemplo.com\n');
  const plain = loadApp();
  renderText(plain, 'https://ejemplo.com');
  assert.equal(padded.rects.length > 0, true);
  assert.deepEqual(padded.rects.slice(-plain.rects.length), plain.rects);
});

test('512 px export produces an exact 512x512 canvas', () => {
  const app = loadApp();
  renderText(app, 'Hola ñandú 😀', { size: '512' });
  assert.equal(app.element('qrCanvas').width, 512);
  assert.equal(app.element('qrCanvas').height, 512);
  const modules = app.rects.slice(1);
  assert.equal(modules.length > 0, true);
  for (const [x, y, width, height] of modules) {
    assert.equal([x, y].every(Number.isInteger), true);
    assert.equal([15, 16].includes(width) && [15, 16].includes(height), true);
    assert.equal(x + width <= 512 && y + height <= 512, true);
  }
});

test('the densest QR (level H, 1273 bytes) still renders at the smallest offered size', () => {
  const app = loadApp();
  renderText(app, 'a'.repeat(1273), { level: 'H', size: '256' });
  assert.equal(app.element('qrCanvas').width, 256);
  assert.equal(app.element('downloadPngBtn').disabled, false);
});

for (const [name, buttonId] of [['PNG', 'downloadPngBtn'], ['SVG', 'downloadSvgBtn']]) {
  test(`${name} download revokes the blob URL only after a delay`, () => {
    const app = loadApp();
    renderText(app, 'https://ejemplo.com');
    app.element(buttonId).listeners.click();
    assert.equal(app.anchors.length, 1);
    assert.equal(app.anchors[0].clicked, true);
    assert.deepEqual(app.revoked, []);
    const revoke = app.pendingTimers().at(-1);
    assert.equal(revoke.delay >= 500, true);
    revoke.callback();
    assert.deepEqual(app.revoked, ['blob:test']);
  });
}

test('downloading without a QR creates no anchor and no timer', () => {
  const app = loadApp();
  const timersBefore = app.timers.length;
  app.element('downloadPngBtn').listeners.click();
  app.element('downloadSvgBtn').listeners.click();
  assert.equal(app.anchors.length, 0);
  assert.equal(app.timers.length, timersBefore);
  assert.deepEqual(app.revoked, []);
});
