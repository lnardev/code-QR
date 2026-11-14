'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('index.html references no external resources', () => {
  assert.deepEqual(html.match(/(?:src|href)="https?:\/\/[^"]*"/g) || [], []);
});

test('every local script referenced by index.html exists', () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(scripts.length >= 3, true);
  for (const src of scripts) {
    assert.equal(fs.existsSync(path.join(root, src)), true, `${src} is missing`);
  }
});
