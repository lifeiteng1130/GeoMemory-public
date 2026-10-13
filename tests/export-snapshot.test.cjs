const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('export snapshots the live database before zipping and retains the shared ZIP', async () => {
  const calls = [];
  const files = new Map();
  const document = 'document';
  const cache = 'cache';
  class File {
    constructor(...parts) {
      this.uri = parts.join('/');
      this.name = parts.at(-1);
      if (!files.has(this.uri)) files.set(this.uri, this);
    }
    get exists() { return files.get(this.uri)?.created ?? false; }
    create() { files.get(this.uri).created = true; }
    delete() { files.get(this.uri).created = false; calls.push(['delete', this.uri]); }
  }
  class Directory {
    constructor(...parts) { this.uri = parts.join('/'); }
    get exists() { return false; }
  }
  new File(document, 'SQLite', 'geomemory.db').create();
  const sourceDb = {};
  const destDb = { closeAsync: async () => { calls.push(['close']); } };
  const mocks = {
    'expo-file-system/next': { File, Directory, Paths: { document, cache } },
    'expo-sharing': {
      isAvailableAsync: async () => true,
      shareAsync: async uri => { calls.push(['share', uri, files.get(uri)?.created]); },
    },
    'expo-document-picker': {},
    jszip: {},
    'expo-file-system/legacy': {},
    'expo-sqlite': {
      openDatabaseAsync: async name => { calls.push(['open', name]); new File(document, 'SQLite', name).create(); return destDb; },
      backupDatabaseAsync: async args => { calls.push(['backup', args.sourceDatabase === sourceDb, args.destDatabase === destDb]); },
    },
    './database': { getDatabase: async () => sourceDb },
    './backup-zip': { writeBackupZip: async (output, entries) => {
      calls.push(['zip', output.uri, entries[0].file.uri, entries[0].file.exists]);
    } },
  };
  const source = fs.readFileSync(path.join(__dirname, '../lib/export.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const moduleExports = {};
  vm.runInNewContext(outputText, { exports: moduleExports, require: key => mocks[key], Date, Math });
  await moduleExports.exportBackup();
  assert.deepEqual(calls.find(call => call[0] === 'backup').slice(1), [true, true]);
  const zip = calls.find(call => call[0] === 'zip');
  assert.match(zip[2], /^document\/SQLite\/_backup_snapshot_/);
  assert.equal(zip[3], true);
  assert.ok(calls.findIndex(call => call[0] === 'backup') < calls.findIndex(call => call[0] === 'zip'));
  assert.deepEqual(calls.find(call => call[0] === 'share').slice(1), [zip[1], true]);
  assert.ok(!calls.some(call => call[0] === 'delete' && call[1] === zip[1]));
  assert.ok(calls.some(call => call[0] === 'delete' && call[1] === zip[2]));
});
