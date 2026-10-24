'use strict';
// Loads an HTML app in jsdom and exposes helpers to drive it and snapshot the engineering results.
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');
const path = require('path');

async function load(file, opts = {}) {
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', e => errors.push(String(e && e.message || e)));
  vc.on('error', e => errors.push(String(e)));
  const dom = await JSDOM.fromFile(path.resolve(file), {
    runScripts: 'dangerously', resources: { interceptors: [requestInterceptor((req) => { const u = req.url; if (u.startsWith('file:') && /\.js(\?|$)/.test(u)) return undefined; return new Response('', { status: 200, headers: { 'content-type': 'text/plain' } }); })] }, pretendToBeVisual: true,
    virtualConsole: vc, url: opts.url || ('file://' + path.resolve(file)),
    beforeParse(win) {
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      win.scrollTo = () => {};
      const mem = opts.storage || (opts.storage = new Map());
      Object.defineProperty(win, 'localStorage', { configurable: true, value: {
        getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); },
        removeItem: k => { mem.delete(k); }, clear: () => mem.clear(), key: i => [...mem.keys()][i] || null, get length() { return mem.size; } } });
      win.HTMLElement.prototype.scrollIntoView = function () {};
      if (opts.beforeParse) opts.beforeParse(win);
    }
  });
  // wait for all external scripts to execute
  await new Promise(res => {
    if (dom.window.document.readyState === 'complete') return res();
    dom.window.addEventListener('load', () => res());
  });
  if (dom.window.__appReady) await dom.window.__appReady;
  await new Promise(r => setTimeout(r, 50));
  return { dom, win: dom.window, errors };
}

function apply(win, ops) {
  for (const op of ops) {
    const [kind, ...a] = op;
    if (kind === 'g') win.updateGlobal(a[0], a[1]);
    else if (kind === 'p') win.updateParam(a[0], a[1], a[2], typeof a[2] === 'number');
    else if (kind === 't') win.toggleUnit(a[0], a[1]);
    else throw new Error('bad op ' + kind);
  }
}

// Snapshot of everything the engineering engine produced (no DOM / input markup).
function snapshot(win) {
  return JSON.parse(win.eval(`JSON.stringify((function(){
    const res = {};
    LAST.order.forEach(id => {
      const r = LAST.results[id];
      const o = {};
      Object.keys(r).forEach(k => { o[k] = r[k]; });
      res[id] = o;
    });
    return { order: LAST.order, stream: LAST.stream, mbTrace: LAST.mbTrace, results: res };
  })())`));
}

const SCENARIOS = {
  default: [],
  flow_up: [['g','Qavg',1500],['g','opHours',20],['g','peakFactor',2.5]],
  strong_waste: [['g','BOD',5000],['g','COD',9000],['g','TSS',3000],['g','FOG',500],['g','pH',6.2]],
  basket_screen: [['p','screen','screen_type','basket'],['p','screen','screen_n',2]],
  rect_tanks: [['p','eq','eq_shape','rectangular'],['p','eq','eq_n',2],['p','eq','eq_RT',6],['p','aeration','aer_shape','rectangular'],['p','aeration','aer_n',2]],
  bio_params: [['p','aeration','aer_type','MBBR'],['p','aeration','aer_FM',0.3],['p','aeration','aer_MLSS',4000],['p','aeration','aer_SVI',120],['p','aeration','aer_Y',0.5],['p','aeration','aer_BODout',100],['p','aeration','aer_TSSout',150]],
  filter_press: [['p','dewater','dw_alt','press'],['p','dewater','dw_batches',6],['p','dewater','dw_nPresses',2]],
  belt_press: [['p','dewater','dw_outletConc',4],['p','dewater','dw_cakeConc',30],['p','dewater','dw_polyDose',5]],
  with_ro: [['t','cf',true],['t','rochem',true],['t','ro',true],['p','ro','ro_recovery',75],['p','ro','ro_flux',18]],
  minimal_train: [['t','gos',false],['t','rfs',false],['t','dafchem',false],['t','daf',false]],
  only_lift: [['t','screen',false],['t','grit',false],['t','gos',false],['t','eq',false],['t','rfs',false],['t','dafchem',false],['t','daf',false],['t','aeration',false],['t','settling',false],['t','sht',false],['t','blowers',false],['t','chlorine_tank',false],['t','chlorine_dose',false],['t','mmf',false],['t','sludgeqty',false],['t','dewater',false],['t','supernatant',false]],
  physchem: [['p','daf','DAF_BOD',60],['p','daf','DAF_TSS',90],['p','dafchem','chem_targetPH',8.5],['p','dafchem','chem_coagDose',150],['p','gos','gos_n',2],['p','rfs','rfs_n',2]],
  settling_blowers: [['p','settling','set_OR',20],['p','settling','set_n',3],['p','settling','set_W',4],['p','sht','sht_HRT',3],['p','blowers','blow_duty',3],['p','blowers','blow_safety',1.3]],
  tertiary: [['p','mmf','mmf_n',3],['p','mmf','mmf_rate',8],['p','chlorine_tank','cct_RT',1.5],['p','chlorine_dose','cld_dose',12],['p','lift','lift_staticHead',12],['p','lift','lift_duty',2]],
};

module.exports = { load, apply, snapshot, SCENARIOS };
