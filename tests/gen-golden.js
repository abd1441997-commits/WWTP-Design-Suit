'use strict';
// Generates tests/golden.json from the ORIGINAL (pre-conversion) single-file app.
const fs = require('fs'); const { load, apply, snapshot, SCENARIOS } = require('./harness');
(async () => {
  const src = process.argv[2];
  if (!src) throw new Error('usage: node tests/gen-golden.js <original.html>');
  const golden = {};
  for (const [name, ops] of Object.entries(SCENARIOS)) {
    const { win, errors } = await load(src);
    if (errors.length) throw new Error(name + ': ' + errors.join('; '));
    apply(win, ops);
    golden[name] = snapshot(win);
    win.close();
  }
  fs.writeFileSync(__dirname + '/golden.json', JSON.stringify(golden));
  console.log('golden written:', Object.keys(golden).length, 'scenarios,', fs.statSync(__dirname + '/golden.json').size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });
