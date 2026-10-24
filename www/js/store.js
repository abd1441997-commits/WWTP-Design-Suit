/* Project persistence.
   Native app: Capacitor Preferences (with localStorage mirror).  Browser/PWA: localStorage.
   Everything is validated again on load, so a damaged or hand-edited file can never feed
   invalid numbers into the calculation engine. */
const Store = (function () {
  const PFX = 'wwtp.v1.';
  const SCHEMA = 1;
  let DEF = null, cur = null, profile = null, index = [], timer = null, ready = false, startupNote = null;
  const DEFAULT_PROFILE = { name: 'Abdelrahman Elwishy', department: 'Proposal & Designing Department' };

  /* ---------- key/value layer ---------- */
  function isNative() { return !!(window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()); }
  function pref() { return window.Native ? Native.plugin('Preferences') : null; }
  async function kvGet(k) {
    if (isNative() && pref()) { try { const r = await pref().get({ key: PFX + k }); if (r && r.value != null) return r.value; } catch (e) {} }
    try { return window.localStorage.getItem(PFX + k); } catch (e) { return null; }
  }
  async function kvSet(k, v) {
    let ok = false;
    if (isNative() && pref()) { try { await pref().set({ key: PFX + k, value: v }); ok = true; } catch (e) {} }
    try { window.localStorage.setItem(PFX + k, v); ok = true; } catch (e) {}
    return ok;
  }
  async function kvDel(k) {
    if (isNative() && pref()) { try { await pref().remove({ key: PFX + k }); } catch (e) {} }
    try { window.localStorage.removeItem(PFX + k); } catch (e) {}
  }
  const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };

  /* ---------- helpers ---------- */
  const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const defaultMeta = () => ({ name: 'Untitled Project', client: '', site: '', number: '', revision: 'A', notes: '' });
  const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
  const SELECTS = () => {
    const m = { aer_shape: ['circular', 'rectangular'] };
    for (const id in FIELDS) for (const f of FIELDS[id]) if (f.opts) m[f.k] = f.opts.map(o => o[0]);
    return m;
  };

  /* ---------- sanitising ---------- */
  function sanitize(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Not a project file.');
    if (obj.schema > SCHEMA) throw new Error('This project was saved by a newer version of the app.');
    if (!obj.inputs || typeof obj.inputs !== 'object') throw new Error('Project has no design inputs.');
    let repairs = 0;
    const meta = Object.assign(defaultMeta(), {});
    const m = obj.meta || {};
    meta.name = clip(m.name, 120).trim() || 'Untitled Project';
    meta.client = clip(m.client, 160); meta.site = clip(m.site, 160);
    meta.number = clip(m.number, 40); meta.revision = clip(m.revision, 12) || 'A';
    meta.notes = clip(m.notes, 2000);
    const inputs = {};
    for (const k of Object.keys(DEF.I)) {
      const c = k in obj.inputs ? Validate.check(k, obj.inputs[k]) : { ok: false };
      if (c.ok) inputs[k] = c.value; else { inputs[k] = DEF.I[k]; if (k in obj.inputs) repairs++; }
    }
    const params = {}, sel = SELECTS();
    for (const u of UNIT_DEFS) {
      const src = obj.params && obj.params[u.id];
      if (!src || typeof src !== 'object') continue;
      const out = {};
      for (const key of Object.keys(src)) {
        if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key)) { repairs++; continue; }
        const v = src[key];
        if (typeof v === 'number') {
          const c = Validate.check(key, v);
          if (c.ok) out[key] = c.value; else repairs++;
        } else if (typeof v === 'string' && sel[key] && sel[key].includes(v)) out[key] = v;
        else repairs++;
      }
      params[u.id] = out;
    }
    const units = {};
    for (const u of UNIT_DEFS) units[u.id] = typeof (obj.units || {})[u.id] === 'boolean' ? obj.units[u.id] : DEF.units[u.id];
    const id = typeof obj.id === 'string' && /^[A-Za-z0-9_-]{3,40}$/.test(obj.id) ? obj.id : uid();
    return { schema: SCHEMA, id, created: typeof obj.created === 'string' ? obj.created : new Date().toISOString(), meta, inputs, params, units, repairs };
  }
  function snapshot() {
    return { schema: SCHEMA, app: 'industrial-wwtp-design-suite', id: cur.id, created: cur.created, savedAt: new Date().toISOString(),
      meta: Object.assign({}, cur.meta), inputs: Object.assign({}, I), params: JSON.parse(JSON.stringify(state.params)), units: Object.assign({}, state.units) };
  }
  function apply(p) {
    Object.assign(I, p.inputs);
    state.params = p.params;
    for (const u of UNIT_DEFS) state.units[u.id] = p.units[u.id];
    cur = { id: p.id, created: p.created, meta: p.meta };
  }
  function blank(name) {
    Object.assign(I, DEF.I); state.params = {};
    for (const u of UNIT_DEFS) state.units[u.id] = DEF.units[u.id];
    cur = { id: uid(), created: new Date().toISOString(), meta: Object.assign(defaultMeta(), name ? { name } : {}) };
  }

  /* ---------- status ---------- */
  function status(kind) {
    const el = document.getElementById('saveStatus'); if (!el) return;
    const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    el.className = 'save-status ' + kind;
    el.textContent = kind === 'saving' ? 'Saving…' : kind === 'saved' ? 'Saved ' + t : 'Not saved';
    el.title = kind === 'err' ? 'Storage is unavailable or full. Use Export to keep a copy of this project.' : '';
  }

  /* ---------- persistence ---------- */
  async function save() {
    if (!ready || !cur) return false;
    const snap = snapshot();
    const ok = await kvSet('project.' + snap.id, JSON.stringify(snap));
    const row = { id: snap.id, name: snap.meta.name, client: snap.meta.client, updated: snap.savedAt, Qavg: snap.inputs.Qavg,
      stages: Object.values(snap.units).filter(Boolean).length };
    const i = index.findIndex(x => x.id === snap.id);
    if (i >= 0) index[i] = row; else index.push(row);
    await kvSet('index', JSON.stringify(index));
    await kvSet('current', snap.id);
    status(ok ? 'saved' : 'err');
    return ok;
  }
  function scheduleSave() {
    if (!ready) return;
    status('saving'); clearTimeout(timer); timer = setTimeout(save, 450);
  }
  async function flush() { if (!ready) return; if (timer) { clearTimeout(timer); timer = null; } await save(); }

  async function init() {
    DEF = { I: Object.assign({}, I), units: Object.assign({}, state.units) };
    profile = Object.assign({}, DEFAULT_PROFILE, J(await kvGet('profile')) || {});
    index = J(await kvGet('index')) || [];
    if (!Array.isArray(index)) index = [];
    const curId = await kvGet('current');
    let loaded = false;
    if (curId) {
      const raw = await kvGet('project.' + curId);
      if (raw) {
        try { const p = sanitize(JSON.parse(raw)); apply(p); loaded = true; if (p.repairs) startupNote = 'Project reopened. ' + p.repairs + ' stored value(s) were out of range and were reset to defaults.'; }
        catch (e) { await kvSet('corrupt.' + curId, raw); startupNote = 'The last project could not be restored (' + e.message + '). A new project was started; the damaged data was kept.'; }
      }
    }
    if (!loaded) blank();
    ready = true;
  }

  async function open(id) {
    await flush();
    const raw = await kvGet('project.' + id);
    if (!raw) throw new Error('Project not found.');
    const p = sanitize(JSON.parse(raw)); apply(p);
    await kvSet('current', p.id);
    return p.repairs;
  }
  async function create() { await flush(); blank(); await save(); }
  async function saveCopy(name) {
    await flush();
    cur = { id: uid(), created: new Date().toISOString(), meta: Object.assign({}, cur.meta, { name: clip(name, 120) || cur.meta.name + ' (copy)' }) };
    await save();
  }
  async function duplicate(id) {
    const raw = await kvGet('project.' + id); if (!raw) throw new Error('Project not found.');
    const p = sanitize(JSON.parse(raw)); const nid = uid();
    const snap = Object.assign(p, { id: nid, created: new Date().toISOString(), savedAt: new Date().toISOString() });
    snap.meta.name = clip(snap.meta.name + ' (copy)', 120);
    await kvSet('project.' + nid, JSON.stringify(snap));
    index.push({ id: nid, name: snap.meta.name, client: snap.meta.client, updated: snap.savedAt, Qavg: snap.inputs.Qavg, stages: Object.values(snap.units).filter(Boolean).length });
    await kvSet('index', JSON.stringify(index));
  }
  async function remove(id) {
    await kvDel('project.' + id);
    index = index.filter(x => x.id !== id);
    await kvSet('index', JSON.stringify(index));
    if (cur && cur.id === id) { blank(); await save(); return true; }
    return false;
  }
  async function exportJSON(id) {
    let snap;
    if (!id || (cur && id === cur.id)) { await flush(); snap = snapshot(); }
    else { const raw = await kvGet('project.' + id); if (!raw) throw new Error('Project not found.'); snap = JSON.parse(raw); }
    return { text: JSON.stringify(snap, null, 2), name: snap.meta.name };
  }
  async function importText(text) {
    const p = sanitize(JSON.parse(text));
    if (index.some(x => x.id === p.id) || (cur && cur.id === p.id)) p.id = uid();
    await flush();
    apply(p); await save();
    return p.repairs;
  }

  /* ---------- profile / meta ---------- */
  async function setProfile(k, v) { profile[k] = clip(v, 120); await kvSet('profile', JSON.stringify(profile)); }
  function setMeta(k, v) { const lim = { name: 120, client: 160, site: 160, number: 40, revision: 12, notes: 2000 }; cur.meta[k] = clip(v, lim[k] || 120); if (k === 'name' && !cur.meta.name.trim()) cur.meta.name = 'Untitled Project'; }

  return {
    init, save, scheduleSave, flush, open, create, saveCopy, duplicate, remove, exportJSON, importText, sanitize,
    setProfile, setMeta,
    get profile() { return profile; }, get meta() { return cur.meta; }, get id() { return cur.id; },
    list() { return index.slice().sort((a, b) => (b.updated || '').localeCompare(a.updated || '')); },
    get startupNote() { return startupNote; }, get ready() { return ready; }, isNative
  };
})();
window.Store = Store;
