const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('letter remains dismissible on short screens or with large text', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/AnniversaryLetter.tsx'), 'utf8');
  assert.match(source, /<ScrollView\b/);
  assert.match(source, /contentContainerStyle=/);
});

test('home does not present the modal over another route', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
  assert.match(source, /anniversaryLetter\s*&&\s*isFocused/);
});
