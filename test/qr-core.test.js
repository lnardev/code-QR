'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const qrcode = require('qrcode-generator');
const QrCore = require('../js/qr-core.js');

const LIMITS = { L: 2953, M: 2331, Q: 1663, H: 1273 };

test('validate rejects empty and whitespace-only text', () => {
  for (const text of ['', '   ', '\n\t ']) {
    const result = QrCore.validate(text, 'M');
    assert.equal(result.ok, false);
    assert.match(result.error, /Ingresa texto/);
  }
});

test('validate counts UTF-8 bytes, not UTF-16 units', () => {
  assert.equal(QrCore.byteLength('a'), 1);
  assert.equal(QrCore.byteLength('ñ'), 2);
  assert.equal(QrCore.byteLength('😀'), 4);
});

for (const [level, limit] of Object.entries(LIMITS)) {
  test(`validate enforces the byte capacity at level ${level}`, () => {
    assert.equal(QrCore.validate('a'.repeat(limit), level).ok, true);
    const over = QrCore.validate('a'.repeat(limit + 1), level);
    assert.equal(over.ok, false);
    assert.match(over.error, /demasiado largo/);
  });
}

test('validate counts multi-byte characters against capacity', () => {
  const text = 'ñ'.repeat(Math.floor(LIMITS.H / 2) + 1);
  assert.equal(text.length <= LIMITS.H, true);
  assert.equal(QrCore.validate(text, 'H').ok, false);
});

test('options falls back to level M for an invalid level', () => {
  assert.equal(QrCore.options({ level: 'X' }).errorCorrectionLevel, 'M');
  assert.equal(QrCore.options({ level: 'H' }).errorCorrectionLevel, 'H');
});

test('options clamps size to 128..2048', () => {
  assert.equal(QrCore.options({ size: 10 }).width, 128);
  assert.equal(QrCore.options({ size: 99999 }).width, 2048);
  assert.equal(QrCore.options({ size: 512 }).width, 512);
});

test('options maps colors and keeps a quiet zone', () => {
  const opts = QrCore.options({ dark: '#111111', light: '#eeeeee' });
  assert.deepEqual(opts.color, { dark: '#111111', light: '#eeeeee' });
  assert.equal(opts.margin >= 4, true);
});

test('options rejects colors that are not 6-digit hex (SVG injection guard)', () => {
  const opts = QrCore.options({ dark: '"/><script>', light: 'red' });
  assert.deepEqual(opts.color, { dark: '#000000', light: '#ffffff' });
});

test('fileName builds qr-code.<ext>', () => {
  assert.equal(QrCore.fileName('png'), 'qr-code.png');
  assert.equal(QrCore.fileName('svg'), 'qr-code.svg');
});

test('encode forces UTF-8 bytes for non-ASCII text', () => {
  assert.deepEqual(qrcode.stringToBytes('ñ'), [241]);
  QrCore.encode(qrcode, 'ñ', 'M');
  assert.deepEqual(qrcode.stringToBytes('ñ'), [0xc3, 0xb1]);
  assert.equal(qrcode.stringToBytes('😀').length, 4);
});

test('encode returns a square matrix with finder patterns', () => {
  const matrix = QrCore.encode(qrcode, 'https://ejemplo.com', 'M');
  assert.equal(matrix.count >= 21, true);
  assert.equal(matrix.isDark(0, 0), true);
  assert.equal(matrix.isDark(0, matrix.count - 1), true);
  assert.equal(matrix.isDark(matrix.count - 1, 0), true);
});

test('encode handles the maximum payload at level H', () => {
  const matrix = QrCore.encode(qrcode, 'a'.repeat(1273), 'H');
  assert.equal(matrix.count, 177);
});

test('layout picks an integer cell size that fits the requested size', () => {
  assert.deepEqual(QrCore.layout(25, 512, 4), { cell: 15, total: 33, pixels: 495 });
  assert.deepEqual(QrCore.layout(177, 128, 4), { cell: 1, total: 185, pixels: 185 });
});

test('toSvg emits a scalable SVG with colors and no user text', () => {
  const matrix = QrCore.encode(qrcode, '<script>"&', 'M');
  const svg = QrCore.toSvg(matrix, QrCore.options({ size: 256, dark: '#111111', light: '#eeeeee' }));
  const total = matrix.count + 8;
  assert.match(svg, new RegExp(`viewBox="0 0 ${total} ${total}"`));
  assert.match(svg, /width="256" height="256"/);
  assert.match(svg, /fill="#eeeeee"/);
  assert.match(svg, /fill="#111111"/);
  assert.equal(svg.includes('<script>'), false);
});
