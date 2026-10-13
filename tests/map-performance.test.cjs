const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}, expose = '') {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { outputText } = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  vm.runInNewContext(outputText + (expose ? `\nexports.exposed = ${expose};` : ''), { exports, require(name) {
    if (!(name in mocks)) throw Error('Unexpected dependency: ' + name);
    return mocks[name];
  }, console });
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));

function mapHarness() {
  const instances = [], messages = [];
  class Marker {
    constructor(options) { this.options = options; this.contentChanges = 0; this.moves = 0; instances.push(this); }
    on(name, handler) { this[name] = handler; }
    getExtData() { return this.options.extData; }
    setMap(map) { this.map = map; }
    setPosition(position) { this.position = position; this.moves++; }
    setContent(content) { this.content = content; this.contentChanges++; }
    setOffset(offset) { this.offset = offset; }
    setzIndex(zIndex) { this.zIndex = zIndex; }
  }
  const context = vm.createContext({ map: {}, AMap: { Marker, Pixel: class { constructor(x, y) { this.x = x; this.y = y; } } }, window: { ReactNativeWebView: { postMessage: message => messages.push(JSON.parse(message)) } } });
  vm.runInContext(load('lib/map-markers.ts').markerScript, context);
  return { context, instances, messages };
}
const point = (id, imageKey = 'media/a.jpg') => ({ id, imageKey, lat: 30, lng: 120 });

test('1000 unchanged records reuse all markers and loaded photos on refresh', () => {
  const { context: c, instances, messages } = mapHarness();
  const points = Array.from({ length: 1000 }, (_, i) => point(String(i)));
  c.syncMarkers(points, 1);
  points.forEach(p => c.addThumbnail(p.id, p.imageKey, 1, 'data:image/png;base64,AAAA'));
  c.syncMarkers(points.map(p => ({ ...p })), 2);
  assert.equal(instances.length, 1000);
  assert.equal(instances.reduce((n, m) => n + m.contentChanges, 0), 1000);
  assert.deepEqual(messages.at(-1).missing, []);
  instances[20].click();
  assert.deepEqual(messages.at(-1), { type: 'point_click', id: '20' });
});

test('add, move, replace photo, delete and empty list retain the correct identities', () => {
  const { context: c, instances, messages } = mapHarness();
  c.syncMarkers([point('a'), point('b')], 1);
  c.addThumbnail('a', 'media/a.jpg', 1, 'old');
  c.syncMarkers([{ ...point('a', 'media/new.png'), lat: 31 }, point('c', '')], 2);
  assert.equal(instances.length, 3);
  assert.equal(instances[0].moves, 1);
  assert.equal(instances[1].map, null);
  assert.deepEqual(messages.at(-1).missing, [{ id: 'a', imageKey: 'media/new.png' }]);
  const changes = instances[0].contentChanges;
  c.addThumbnail('a', 'media/a.jpg', 1, 'stale');
  c.addThumbnail('a', 'media/a.jpg', 2, 'wrong image');
  assert.equal(instances[0].contentChanges, changes);
  c.addThumbnail('a', 'media/new.png', 2, 'new');
  assert.match(instances[0].content, /src="new"/);
  assert.equal(instances[0].offset.y, -54);
  c.syncMarkers([point('a', '')], 3);
  assert.match(instances[0].content, /marker-dot/);
  assert.equal(instances[0].offset.y, -10);
  c.syncMarkers([], 4);
  assert.equal(Object.keys(c.markerEntries).length, 0);
  assert.equal(instances[0].map, null);
});

test('a new WebView asks for its photos again', () => {
  const first = mapHarness();
  first.context.syncMarkers([point('a')], 1);
  first.context.addThumbnail('a', 'media/a.jpg', 1, 'photo');
  const reloaded = mapHarness();
  reloaded.context.syncMarkers([point('a')], 3);
  assert.equal(reloaded.messages.at(-1).missing.length, 1);
});

test('generated map HTML dispatches marker sync and thumbnail messages correctly', () => {
  const { markerScript } = load('lib/map-markers.ts');
  const earth = load('components/Earth.tsx', {
    'react': {}, 'react/jsx-runtime': {},
    'react-native': { StyleSheet: { create: styles => styles } },
    'react-native-webview': {}, 'expo-file-system/legacy': {},
    '../lib/storage': {}, '../lib/map-thumbnail': {}, '../lib/map-markers': { markerScript },
  }, 'generateHtml');
  const html = earth.exposed(3);
  const { context: c, instances, messages } = mapHarness();
  c.setTimeout = () => {};
  c.window.addEventListener = (name, handler) => { c.receive = handler; };
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script, c);
  c.map = { id: 'map' };
  c.receive({ data: JSON.stringify({ type: 'add_markers', points: [point('photo')], revision: 9 }) });
  assert.equal(messages.at(-1).type, 'markers_synced');
  c.receive({ data: JSON.stringify({ type: 'add_thumb', id: 'photo', imageKey: 'media/a.jpg', revision: 9, base64: 'data:image/png;base64,AAAA' }) });
  assert.match(instances[0].content, /data:image\/png;base64,AAAA/);
});

function thumbnailHarness() {
  let generated = 0, modified = 1, fail = false;
  const files = new Map(), actions = [];
  const fileSystem = {
    cacheDirectory: 'file:///cache/', EncodingType: { Base64: 'base64' },
    async getInfoAsync(uri) { return uri.startsWith('file:///original/') ? { exists: true, size: 1000000, modificationTime: modified, isDirectory: false } : { exists: files.has(uri), size: 20, isDirectory: false }; },
    async makeDirectoryAsync() {},
    async copyAsync({ from, to }) { assert.ok(files.has(from)); files.set(to, files.get(from)); },
    async readAsStringAsync(uri) { assert.ok(files.has(uri)); return files.get(uri); },
    async deleteAsync(uri) { assert.ok(!uri.startsWith('file:///original/')); files.delete(uri); },
  };
  const mocks = {
    'react-native': { Image: { getSize: async () => ({ width: 4000, height: 3000 }) } },
    'expo-file-system/legacy': fileSystem,
    'expo-image-manipulator': { SaveFormat: { PNG: 'png' }, async manipulateAsync(uri, edits, options) {
      generated++; if (fail) throw Error('decode failed');
      assert.ok(uri.startsWith('file:///original/')); assert.equal(options.format, 'png'); actions.push(plain(edits));
      const output = 'file:///cache/generated-' + generated; files.set(output, 'small-image'); return { uri: output };
    } },
    './storage': { getFullPath: p => 'file:///original/' + p },
  };
  return { api: load('lib/map-thumbnail.ts', mocks), mocks, files, actions, count: () => generated, changeSource: () => modified++, fail: value => { fail = value; } };
}

test('thumbnail cache deduplicates concurrent work and survives module reload', async () => {
  const h = thumbnailHarness();
  const result = await Promise.all([h.api.getMapThumbnail('media/a.jpg', 3), h.api.getMapThumbnail('media/a.jpg', 3)]);
  assert.equal(h.count(), 1);
  assert.deepEqual(result, ['data:image/png;base64,small-image', 'data:image/png;base64,small-image']);
  await load('lib/map-thumbnail.ts', h.mocks).getMapThumbnail('media/a.jpg', 3);
  assert.equal(h.count(), 1);
  assert.equal(h.files.size, 1); // intermediate image removed; persistent thumbnail retained
  assert.deepEqual(h.actions[0], [{ crop: { originX: 500, originY: 0, width: 3000, height: 3000 } }, { resize: { width: 144, height: 144 } }]);
  h.changeSource();
  await h.api.getMapThumbnail('media/a.jpg', 3);
  assert.equal(h.count(), 2);
});

test('thumbnail failure can retry, portrait cropping is centered and small images are not enlarged', async () => {
  const h = thumbnailHarness();
  h.fail(true);
  await assert.rejects(h.api.getMapThumbnail('media/a.jpg', 3), /decode failed/);
  h.fail(false);
  await h.api.getMapThumbnail('media/a.jpg', 3);
  assert.equal(h.count(), 2);
  assert.deepEqual(plain(h.api.thumbnailActions(40, 80, 144)), [{ crop: { originX: 0, originY: 20, width: 40, height: 40 } }, { resize: { width: 40, height: 40 } }]);
});

test('memory loading uses two queries, preserves order and handles records without photos', async () => {
  const memories = [{ id: 'b', content: 'second' }, { id: 'a' }, { id: 'empty' }];
  const images = [{ id: 'b0', memory_id: 'b', sort_order: 0 }, { id: 'a0', memory_id: 'a', sort_order: 0 }, { id: 'a2', memory_id: 'a', sort_order: 2 }];
  let queries = 0;
  const db = load('lib/database.ts', { 'expo-sqlite': { openDatabaseAsync: async () => ({ execAsync: async () => {}, getAllAsync: async sql => { queries++; return sql.includes('FROM memories') ? memories : images; } }) } });
  const result = plain(await db.getMemories());
  assert.equal(queries, 2);
  assert.deepEqual(result.map(m => m.id), ['b', 'a', 'empty']);
  assert.deepEqual(result[1].images.map(i => i.id), ['a0', 'a2']);
  assert.deepEqual(result[2].images, []);
  memories.length = 0;
  queries = 0;
  assert.deepEqual(plain(await db.getMemories()), []);
  assert.equal(queries, 1);
});
