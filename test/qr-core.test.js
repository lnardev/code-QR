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

test('validate and encode ignore surrounding whitespace', () => {
  assert.equal(QrCore.validate('a'.repeat(LIMITS.M) + '\n  ', 'M').ok, true);
  assert.equal(QrCore.validate('a'.repeat(LIMITS.M + 1) + '\n', 'M').ok, false);
  const padded = QrCore.encode(qrcode, ' abc\n', 'M');
  const plain = QrCore.encode(qrcode, 'abc', 'M');
  assert.equal(padded.count, plain.count);
  for (let row = 0; row < plain.count; row++) {
    for (let col = 0; col < plain.count; col++) {
      assert.equal(padded.isDark(row, col), plain.isDark(row, col));
    }
  }
});

test('encode keeps interior whitespace', () => {
  const spaced = QrCore.encode(qrcode, 'a  b', 'M');
  const tight = QrCore.encode(qrcode, 'a b', 'M');
  let differs = false;
  for (let row = 0; row < spaced.count && !differs; row++) {
    for (let col = 0; col < spaced.count; col++) {
      if (spaced.isDark(row, col) !== tight.isDark(row, col)) differs = true;
    }
  }
  assert.equal(differs, true);
});

test('layout fills exactly the requested size with edges differing by at most one pixel', () => {
  const { total, pixels, edges } = QrCore.layout(25, 512, 4);
  assert.equal(total, 33);
  assert.equal(pixels, 512);
  assert.equal(edges.length, total + 1);
  assert.equal(edges[0], 0);
  assert.equal(edges[total], 512);
  for (let i = 0; i < total; i++) {
    assert.equal([15, 16].includes(edges[i + 1] - edges[i]), true);
  }
});

test('layout never produces a zero-width module when size is below the grid', () => {
  const { pixels, edges } = QrCore.layout(177, 128, 4);
  assert.equal(pixels, 185);
  for (let i = 0; i < 185; i++) {
    assert.equal(edges[i + 1] - edges[i], 1);
  }
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
