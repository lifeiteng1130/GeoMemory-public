const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadModule(name, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, `../lib/${name}.ts`), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const result = {};
  vm.runInNewContext(outputText, { exports: result, Date, Math, require: key => dependencies[key] });
  return result;
}

test('anniversary uses local October 11–13 and day headings every year', () => {
  const { getAnniversaryLetter } = loadModule('anniversary');
  for (const year of [2026, 2027]) {
    assert.equal(getAnniversaryLetter(new Date(year, 9, 10), 0), null);
    assert.equal(getAnniversaryLetter(new Date(year, 9, 11), 0).heading, '回望');
    assert.equal(getAnniversaryLetter(new Date(year, 9, 12), 0).heading, '此刻');
    assert.equal(getAnniversaryLetter(new Date(year, 9, 13), 0).heading, '以后');
    assert.equal(getAnniversaryLetter(new Date(year, 9, 14), 0), null);
  }
});

test('eligible launch advances persisted message once; another launch shows the next', async () => {
  let saved = '0';
  const fakeFile = { exists: true, text: async () => saved, write: value => { saved = value; }, create() {} };
  const dependencies = {
    'expo-file-system/next': { File: class { constructor() { return fakeFile; } }, Paths: { document: {} } },
    './anniversary': loadModule('anniversary'),
  };
  const firstSession = loadModule('anniversary-session', dependencies);
  const date = new Date(2026, 9, 12);
  const first = await firstSession.getLaunchAnniversaryLetter(date);
  assert.equal(await firstSession.getLaunchAnniversaryLetter(date), null);
  assert.equal(saved, '1');
  const secondSession = loadModule('anniversary-session', dependencies);
  const second = await secondSession.getLaunchAnniversaryLetter(date);
  assert.notEqual(second.message, first.message);
  assert.equal(saved, '2');
});

test('other dates do not consume the launch or advance the rotation', async () => {
  let saved = '3';
  const fakeFile = { exists: true, text: async () => saved, write: value => { saved = value; }, create() {} };
  const session = loadModule('anniversary-session', {
    'expo-file-system/next': { File: class { constructor() { return fakeFile; } }, Paths: { document: {} } },
    './anniversary': loadModule('anniversary'),
  });
  assert.equal(await session.getLaunchAnniversaryLetter(new Date(2026, 9, 14)), null);
  assert.equal(saved, '3');
  assert.ok(await session.getLaunchAnniversaryLetter(new Date(2026, 9, 12)));
  assert.equal(saved, '4');
});

test('six messages rotate by opening count and wrap without adjacent repeats', () => {
  const { getAnniversaryLetter } = loadModule('anniversary');
  const letters = Array.from({ length: 7 }, (_, index) => getAnniversaryLetter(new Date(2026, 9, 12), index));
  assert.equal(new Set(letters.slice(0, 6).map(letter => letter.message)).size, 6);
  assert.equal(letters[6].message, letters[0].message);
  assert.equal(letters[5].nextIndex, 0);
  assert.ok(letters.every(letter => letter.message.startsWith('宝宝')));
});
