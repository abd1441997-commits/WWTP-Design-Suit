'use strict';
/* Automated checks:
   1. REGRESSION  - engineering results of the converted app are identical to the original app
                    (golden.json was generated from the pre-conversion single-file version).
   2. VALIDATION  - invalid inputs are rejected and never reach the engine.
   3. GUARDS      - impossible designs are flagged instead of producing garbage numbers.
   4. PERSISTENCE - projects survive restart, export/import, damaged data and hostile files. */
const assert = require('assert');
const path = require('path');
const { load, apply, snapshot, SCENARIOS } = require('./harness');
const golden = require('./golden.json');
const APP = path.join(__dirname, '..', 'www', 'index.html');

let pass = 0, fail = 0; const failures = [];
async function t(name, fn) {
  try { await fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; failures.push(name); console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n').slice(0, 6).join('\n       ')); }
}
const close = win => { try { win.close(); } catch (e) {} };
const ev = (win, code) => win.eval(code);

(async () => {
  console.log('\n1. Engineering regression vs original app (' + Object.keys(SCENARIOS).length + ' scenarios)');
  for (const [name, ops] of Object.entries(SCENARIOS)) {
    await t('scenario: ' + name, async () => {
      const { win, errors } = await load(APP);
      assert.deepStrictEqual(errors, [], 'script errors: ' + errors.join('; '));
      apply(win, ops);
      const got = snapshot(win);
      close(win);
      assert.deepStrictEqual(got.order, golden[name].order, 'unit order');
      assert.deepStrictEqual(got.stream, golden[name].stream, 'final stream');
      assert.deepStrictEqual(got.mbTrace, golden[name].mbTrace, 'mass balance');
      for (const id of golden[name].order) assert.deepStrictEqual(got.results[id], golden[name].results[id], 'unit ' + id);
    });
  }

  console.log('\n2. Input validation');
  await t('rejects zero / negative / text / out-of-range global inputs', async () => {
    const { win } = await load(APP);
    const bad = [['Qavg', 0], ['Qavg', -5], ['Qavg', 'abc'], ['Qavg', ''], ['opHours', 25], ['peakFactor', 0.5], ['pH', 15], ['BOD', -1], ['COD', 1e9]];
    for (const [k, v] of bad) {
      const before = ev(win, `I.${k}`);
      const el = win.document.getElementById('gin-' + k);
      win.updateGlobal(k, v, el);
      assert.strictEqual(ev(win, `I.${k}`), before, k + '=' + v + ' must not be applied');
      assert.ok(el.classList.contains('invalid'), k + ' input should be flagged');
    }
    win.updateGlobal('Qavg', 350, win.document.getElementById('gin-Qavg'));
    assert.strictEqual(ev(win, 'I.Qavg'), 350);
    assert.ok(!win.document.getElementById('gin-Qavg').classList.contains('invalid'));
    close(win);
  });
  await t('rejects bad unit parameters (non-integer pump count, removal >100%, zero velocity)', async () => {
    const { win } = await load(APP);
    const cases = [['lift', 'lift_duty', 1.5], ['lift', 'lift_duty', 0], ['gos', 'GOS_BOD', 120], ['screen', 'screen_vel', 0], ['aeration', 'aer_FM', 0], ['mmf', 'mmf_rate', -3], ['aeration', 'aer_MLSS', 'x']];
    for (const [id, k, v] of cases) {
      const before = JSON.stringify(ev(win, `getP('${id}')`));
      win.updateParam(id, k, v, true, null);
      assert.strictEqual(JSON.stringify(ev(win, `getP('${id}')`)), before, id + '.' + k + '=' + v);
    }
    win.updateParam('lift', 'lift_duty', 2, true, null);
    assert.strictEqual(ev(win, "getP('lift').lift_duty"), 2);
    close(win);
  });
  await t('every numeric field has a range rule and min/max attributes', async () => {
    const { win } = await load(APP);
    const keys = JSON.parse(ev(win, `JSON.stringify([].concat(...Object.values(FIELDS).map(a=>a.filter(f=>!f.opts).map(f=>f.k))).concat(GLOBAL_FIELDS.flatMap(s=>s.fields.map(f=>f.k))))`));
    const missing = keys.filter(k => !win.Validate.rules[k]);
    assert.deepStrictEqual(missing, [], 'fields without explicit range: ' + missing.join(','));
    const html = win.document.getElementById('unitCards').innerHTML;
    assert.ok(/min="[^"]+" max="[^"]+"/.test(html), 'unit inputs carry min/max');
    close(win);
  });

  console.log('\n3. Engineering guards');
  await t('aeration target above incoming BOD is flagged, dependents blocked, no NaN/Infinity shown', async () => {
    const { win } = await load(APP);
    win.updateGlobal('BOD', 150, null); // below the 200 mg/l secondary target
    const html = win.document.getElementById('unitCards').innerHTML;
    assert.ok(ev(win, 'LAST.results.aeration.invalid === true'));
    assert.ok(ev(win, "LAST.issues.some(i=>i.level==='error')"));
    assert.ok(/Aeration Tank cannot be sized/.test(html));
    assert.ok(!/NaN|Infinity|∞/.test(html), 'no garbage numbers in the cards');
    close(win);
  });
  await t('disabling aeration/settling combination is reported', async () => {
    const { win } = await load(APP);
    win.toggleUnit('settling', false);
    assert.ok(ev(win, "LAST.issues.some(i=>/Final Settling Tank is disabled/.test(i.msg))"));
    close(win);
  });
  await t('COD < BOD and unusual pH warnings', async () => {
    const { win } = await load(APP);
    win.updateGlobal('COD', 1000, null); win.updateGlobal('pH', 11.5, null);
    const msgs = ev(win, 'LAST.issues.map(i=>i.msg).join(" | ")');
    assert.ok(/COD/.test(msgs) && /pH/.test(msgs), msgs);
    close(win);
  });
  await t('all units off does not crash and the report still renders', async () => {
    const { win, errors } = await load(APP);
    for (const id of ev(win, 'UNIT_DEFS.map(u=>u.id)')) win.toggleUnit(id, false);
    assert.deepStrictEqual(errors, []);
    assert.ok(win.document.getElementById('reportDoc').innerHTML.length > 500);
    close(win);
  });

  console.log('\n4. Persistence');
  await t('autosave survives an app restart (inputs, parameters, train, project info, profile)', async () => {
    const storage = new Map();
    let a = await load(APP, { storage });
    a.win.updateGlobal('Qavg', 777, null); a.win.updateGlobal('BOD', 2500, null);
    a.win.updateParam('aeration', 'aer_MLSS', 3500, true, null);
    a.win.updateParam('dewater', 'dw_alt', 'press', false, null);
    a.win.toggleUnit('daf', false);
    a.win.ProjectsUI.setMeta('name', 'Test Plant A'); a.win.ProjectsUI.setMeta('client', 'ACME');
    await a.win.ProjectsUI.setProfile('name', 'Jane Engineer');
    await a.win.Store.flush();
    const before = snapshot(a.win); close(a.win);
    const b = await load(APP, { storage });
    assert.strictEqual(ev(b.win, 'I.Qavg'), 777);
    assert.strictEqual(ev(b.win, 'I.BOD'), 2500);
    assert.strictEqual(ev(b.win, "getP('aeration').aer_MLSS"), 3500);
    assert.strictEqual(ev(b.win, "getP('dewater').dw_alt"), 'press');
    assert.strictEqual(ev(b.win, 'state.units.daf'), false);
    assert.strictEqual(b.win.Store.meta.name, 'Test Plant A');
    assert.strictEqual(b.win.Store.profile.name, 'Jane Engineer');
    assert.deepStrictEqual(snapshot(b.win), before, 'engineering results identical after reopening');
    close(b.win);
  });
  await t('export -> import round trip reproduces identical results on a clean install', async () => {
    const a = await load(APP);
    a.win.updateGlobal('Qavg', 420, null); a.win.updateParam('settling', 'set_n', 3, true, null); a.win.toggleUnit('ro', true);
    const before = snapshot(a.win);
    const { text } = await a.win.Store.exportJSON();
    close(a.win);
    const b = await load(APP);
    const rep = await b.win.Store.importText(text); b.win.ProjectsUI.afterLoad();
    assert.strictEqual(rep, 0);
    assert.deepStrictEqual(snapshot(b.win), before);
    close(b.win);
  });
  await t('hostile / damaged project files are sanitised (no prototype pollution, ranges enforced)', async () => {
    const { win } = await load(APP);
    const evil = JSON.stringify({ schema: 1, id: 'x', inputs: { Qavg: -5, BOD: 'DROP', pH: 99, COD: 4000, extra: 1 },
      params: { aeration: { aer_FM: 0, aer_MLSS: 3000, '__proto__': { polluted: true }, 'bad key!': 1, aer_type: 'MBBR' }, bogus: { a: 1 } },
      units: { daf: false, nope: true, lift: 'yes' }, meta: { name: '<img src=x onerror=alert(1)>' } });
    const rep = await win.Store.importText(evil); win.ProjectsUI.afterLoad();
    assert.ok(rep >= 3, 'repairs counted: ' + rep);
    assert.strictEqual(ev(win, 'I.Qavg'), 200); assert.strictEqual(ev(win, 'I.pH'), 7.37); assert.strictEqual(ev(win, 'I.COD'), 4000);
    assert.strictEqual(ev(win, "getP('aeration').aer_FM"), undefined); assert.strictEqual(ev(win, "getP('aeration').aer_MLSS"), 3000);
    assert.strictEqual(win.eval('({}).polluted'), undefined);
    assert.strictEqual(ev(win, 'state.units.daf'), false); assert.strictEqual(ev(win, 'state.units.lift'), true);
    assert.strictEqual(win.document.querySelectorAll('#sidebar img, #reportDoc img, #projTitle img').length, 0, 'meta is escaped in the UI');
    assert.strictEqual(win.document.getElementById('projTitle').textContent, '<img src=x onerror=alert(1)>');
    await assert.rejects(() => win.Store.importText('{"schema":1}'));
    await assert.rejects(() => win.Store.importText('not json'));
    await assert.rejects(() => win.Store.importText('{"schema":99,"inputs":{}}'));
    close(win);
  });
  await t('corrupt stored project does not block start-up and is preserved', async () => {
    const storage = new Map([['wwtp.v1.current', 'pBAD'], ['wwtp.v1.project.pBAD', '{broken json']]);
    const { win, errors } = await load(APP, { storage });
    assert.deepStrictEqual(errors, []);
    assert.ok(win.Store.startupNote && /could not be restored/.test(win.Store.startupNote));
    assert.strictEqual(storage.get('wwtp.v1.corrupt.pBAD'), '{broken json');
    close(win);
  });
  await t('project manager: create, list, open, duplicate, delete', async () => {
    const { win } = await load(APP);
    const first = win.Store.id; win.updateGlobal('Qavg', 123, null); win.ProjectsUI.setMeta('name', 'First'); await win.Store.flush();
    await win.Store.create(); win.ProjectsUI.afterLoad();
    assert.notStrictEqual(win.Store.id, first); assert.strictEqual(ev(win, 'I.Qavg'), 200);
    win.updateGlobal('Qavg', 999, null); win.ProjectsUI.setMeta('name', 'Second'); await win.Store.flush();
    assert.strictEqual(win.Store.list().length, 2);
    await win.Store.open(first); win.ProjectsUI.afterLoad();
    assert.strictEqual(ev(win, 'I.Qavg'), 123); assert.strictEqual(win.Store.meta.name, 'First');
    await win.Store.duplicate(first); assert.strictEqual(win.Store.list().length, 3);
    await win.Store.remove(win.Store.list().find(x => x.name === 'Second').id); assert.strictEqual(win.Store.list().length, 2);
    close(win);
  });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('Failed: ' + failures.join(', ')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
