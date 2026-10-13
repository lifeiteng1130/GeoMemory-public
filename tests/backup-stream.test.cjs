const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const JSZip = require('jszip');

const source = fs.readFileSync(path.join(__dirname, '../lib/backup-zip.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  fileName: 'backup-zip.ts', compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const moduleExports = {};
vm.runInNewContext(outputText, { exports: moduleExports, TextEncoder, setTimeout, console });

class MemoryFile {
  constructor(bytes) { this.bytes = Uint8Array.from(bytes); this.exists = true; this.size = bytes.length; this.name = ''; }
  open() {
    const file = this;
    return { offset: 0, close() {}, readBytes(length) {
      const bytes = file.bytes.slice(this.offset, this.offset + length);
      this.offset += bytes.length;
      return bytes;
    }, writeBytes(chunk) {
      const next = new Uint8Array(Math.max(file.bytes.length, this.offset + chunk.length));
      next.set(file.bytes); next.set(chunk, this.offset); file.bytes = next;
      this.offset += chunk.length;
    } };
  }
}

test('streamed backup preserves the existing JSZip import layout and file contents', async () => {
  const db = new MemoryFile([0, 1, 2, 255]);
  const image = new MemoryFile(Uint8Array.from({ length: 130000 }, (_, i) => i % 251));
  const audio = new MemoryFile([10, 20, 30]);
  const output = new MemoryFile([]);
  const progress = [];
  await moduleExports.writeBackupZip(output, [
    { name: 'db/geomemory.db', file: db },
    { name: 'media/照片.jpg', file: image },
    { name: 'media/voice.m4a', file: audio },
  ], value => progress.push(value));
  const zip = await JSZip.loadAsync(output.bytes, { checkCRC32: true });
  assert.deepEqual(Array.from(await zip.file('db/geomemory.db').async('uint8array')), Array.from(db.bytes));
  assert.deepEqual(Array.from(await zip.file('media/照片.jpg').async('uint8array')), Array.from(image.bytes));
  assert.deepEqual(Array.from(await zip.file('media/voice.m4a').async('uint8array')), Array.from(audio.bytes));
  assert.deepEqual(progress.map(x => x.done), [1, 2, 3]);
});

test('empty input and empty file create readable archives', async () => {
  const output = new MemoryFile([]);
  await moduleExports.writeBackupZip(output, [{ name: 'db/geomemory.db', file: new MemoryFile([]) }]);
  const zip = await JSZip.loadAsync(output.bytes, { checkCRC32: true });
  assert.equal((await zip.file('db/geomemory.db').async('uint8array')).length, 0);
});

test('rejects duplicate or unsafe archive names before writing', async () => {
  const output = new MemoryFile([]);
  const file = new MemoryFile([1]);
  await assert.rejects(moduleExports.writeBackupZip(output, [{ name: '../secret', file }]), /Invalid/);
  await assert.rejects(moduleExports.writeBackupZip(output, [{ name: 'media/a', file }, { name: 'media/a', file }]), /Duplicate/);
  assert.equal(output.bytes.length, 0);
});
