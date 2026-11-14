(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.QrCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Maximum payload in bytes for a version 40 QR in byte mode, per error-correction level. */
  const BYTE_CAPACITY = Object.freeze({ L: 2953, M: 2331, Q: 1663, H: 1273 });
  const DEFAULT_LEVEL = 'M';
  const MIN_SIZE = 128;
  const MAX_SIZE = 2048;
  const DEFAULT_SIZE = 256;
  const QUIET_ZONE = 4;
  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

  /**
   * @param {string} text
   * @returns {number} UTF-8 length in bytes
   */
  function byteLength(text) {
    return new TextEncoder().encode(text).length;
  }

  /**
   * @param {string | undefined} level
   * @returns {'L' | 'M' | 'Q' | 'H'}
   */
  function normalizeLevel(level) {
    return Object.prototype.hasOwnProperty.call(BYTE_CAPACITY, level) ? level : DEFAULT_LEVEL;
  }

  /**
   * @param {string} text
   * @param {string} level
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  function validate(text, level) {
    const trimmed = text.trim();
    if (trimmed === '') {
      return { ok: false, error: 'Ingresa texto o una URL.' };
    }
    if (byteLength(trimmed) > BYTE_CAPACITY[normalizeLevel(level)]) {
      return { ok: false, error: 'El texto es demasiado largo para este nivel de corrección.' };
    }
    return { ok: true };
  }

  /**
   * @param {{ size?: number, level?: string, dark?: string, light?: string }} [config]
   * @returns {{ width: number, margin: number, errorCorrectionLevel: string, color: { dark: string, light: string } }}
   */
  function options(config = {}) {
    const size = Number.isFinite(config.size) ? config.size : DEFAULT_SIZE;
    return {
      width: Math.min(MAX_SIZE, Math.max(MIN_SIZE, size)),
      margin: QUIET_ZONE,
      errorCorrectionLevel: normalizeLevel(config.level),
      color: {
        dark: HEX_COLOR.test(config.dark) ? config.dark : '#000000',
        light: HEX_COLOR.test(config.light) ? config.light : '#ffffff',
      },
    };
  }

  /**
   * @param {'png' | 'svg'} ext
   * @returns {string}
   */
  function fileName(ext) {
    return `qr-code.${ext}`;
  }

  /**
   * @typedef {{ count: number, isDark: (row: number, col: number) => boolean }} Matrix
   */

  /**
   * Encodes text as UTF-8 bytes into a QR matrix (qrcode-generator defaults to ISO-8859-1).
   * @param {{ (type: number, level: string): { addData(text: string): void, make(): void, getModuleCount(): number, isDark(row: number, col: number): boolean }, stringToBytes: (s: string) => number[], stringToBytesFuncs: Record<string, (s: string) => number[]> }} factory
   * @param {string} text
   * @param {string} level
   * @returns {Matrix}
   */
  function encode(factory, text, level) {
    factory.stringToBytes = factory.stringToBytesFuncs['UTF-8'];
    const qr = factory(0, normalizeLevel(level));
    qr.addData(text.trim());
    qr.make();
    return { count: qr.getModuleCount(), isDark: (row, col) => qr.isDark(row, col) };
  }

  /**
   * Pixel grid for a QR of `count` modules plus a quiet zone. The canvas is exactly `size`
   * pixels (or one pixel per module when `size` is smaller than the grid); module widths
   * differ by at most one pixel, so there is no interpolation blur.
   * @param {number} count modules per side
   * @param {number} size requested pixels per side
   * @param {number} margin quiet zone in modules
   * @returns {{ total: number, pixels: number, edges: number[] }} `edges[i]..edges[i + 1]` spans module `i`
   */
  function layout(count, size, margin) {
    const total = count + margin * 2;
    const pixels = Math.max(size, total);
    const edges = Array.from({ length: total + 1 }, (_, i) => Math.round((i * pixels) / total));
    return { total, pixels, edges };
  }

  /**
   * @param {Matrix} matrix
   * @param {ReturnType<typeof options>} opts
   * @returns {string} standalone SVG; contains only numbers and validated colors, never the user text
   */
  function toSvg(matrix, opts) {
    const total = matrix.count + opts.margin * 2;
    let path = '';
    for (let row = 0; row < matrix.count; row++) {
      for (let col = 0; col < matrix.count; col++) {
        if (matrix.isDark(row, col)) {
          path += `M${col + opts.margin} ${row + opts.margin}h1v1h-1z`;
        }
      }
    }
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
      `width="${opts.width}" height="${opts.width}" shape-rendering="crispEdges">` +
      `<rect width="${total}" height="${total}" fill="${opts.color.light}"/>` +
      `<path d="${path}" fill="${opts.color.dark}"/></svg>`
    );
  }

  return { byteLength, validate, options, fileName, encode, layout, toSvg };
});
