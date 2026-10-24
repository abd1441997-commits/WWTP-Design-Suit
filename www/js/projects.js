/* Project & profile UI: sidebar section, header, project manager sheet. */
const ProjectsUI = (function () {
  let isOpenFlag = false;
  const $ = id => document.getElementById(id);
  const initials = () => { const n = (Store.profile.name || '').trim().split(/\s+/).filter(Boolean); return ((n[0] || 'A')[0] + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase(); };
  const hash3 = id => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return String(h % 1000).padStart(3, '0'); };
  const docNo = () => initials() + '-IWWTP-' + (Store.meta.number || hash3(Store.id));
  const today = () => new Date().toLocaleDateString('en-GB');

  function sidebarHtml() {
    const m = Store.meta, p = Store.profile;
    const f = (label, key, val, max, kind) => `<div class="field"><label>${label}</label><input type="text" maxlength="${max}" value="${esc(val)}" onchange="ProjectsUI.${kind}('${key}',this.value)"></div>`;
    return `<div class="side-section"><div class="side-head" onclick="toggleSide('project')">Project &amp; Profile<span class="tag">PROJECT</span></div>
      <div class="side-body" id="side-project">
        ${f('Project name', 'name', m.name, 120, 'setMeta')}
        ${f('Client', 'client', m.client, 160, 'setMeta')}
        ${f('Site / location', 'site', m.site, 160, 'setMeta')}
        <div class="row2">${f('Project no.', 'number', m.number, 40, 'setMeta')}${f('Revision', 'revision', m.revision, 12, 'setMeta')}</div>
        <div class="field"><label>Notes</label><textarea rows="3" maxlength="2000" onchange="ProjectsUI.setMeta('notes',this.value)">${esc(m.notes)}</textarea></div>
        <div class="subhead">Prepared by (profile — shown on reports)</div>
        ${f('Name', 'name', p.name, 120, 'setProfile')}
        ${f('Department', 'department', p.department, 120, 'setProfile')}
        <button class="btn secondary small" onclick="ProjectsUI.openModal()">Manage projects…</button>
      </div></div>`;
  }
  function refreshHeader() {
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('tbInitials', initials()); set('tbName', Store.profile.name); set('tbDept', Store.profile.department);
    set('docNoText', docNo()); set('docRev', Store.meta.revision); set('docDate', today());
    set('projTitle', Store.meta.name);
    document.title = Store.meta.name + ' | Industrial WWTP Design Suite';
  }
  function setMeta(k, v) { Store.setMeta(k, v); refreshHeader(); renderReport(); Store.scheduleSave(); }
  async function setProfile(k, v) { await Store.setProfile(k, v); refreshHeader(); renderReport(); }
  function afterLoad() { buildSidebar(); refreshHeader(); runAll(); }

  /* ---------- manager sheet ---------- */
  function rowHtml(r) {
    const cur = r.id === Store.id;
    const d = r.updated ? new Date(r.updated).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    return `<div class="proj-row ${cur ? 'current' : ''}" data-id="${esc(r.id)}">
      <div class="proj-main"><div class="proj-name">${esc(r.name)}${cur ? '<span class="pill">OPEN</span>' : ''}</div>
      <div class="proj-sub">${esc(r.client || 'No client')} · ${n(r.Qavg, 0)} m³/day · ${r.stages} stages</div>
      <div class="proj-sub">Updated ${esc(d)}</div></div>
      <div class="proj-btns">${cur ? '' : '<button class="btn small" data-act="open">Open</button>'}
        <button class="btn secondary small" data-act="dup">Duplicate</button>
        <button class="btn secondary small" data-act="export">Export</button>
        <button class="btn secondary small danger" data-act="del">Delete</button></div></div>`;
  }
  function render() {
    const list = Store.list();
    $('projList').innerHTML = list.length ? list.map(rowHtml).join('') : '<div class="note">No saved projects yet.</div>';
  }
  async function openModal() {
    await Store.flush();
    $('projModal').classList.add('show'); isOpenFlag = true; render();
  }
  function close() { $('projModal').classList.remove('show'); isOpenFlag = false; }
  async function act(a, id) {
    try {
      if (a === 'close') return close();
      if (a === 'new') { await Store.create(); afterLoad(); toast('New project created.', 'ok'); return close(); }
      if (a === 'copy') { const nm = window.prompt('Name for the copy:', Store.meta.name + ' (copy)'); if (nm === null) return; await Store.saveCopy(nm); refreshHeader(); render(); return toast('Copy saved.', 'ok'); }
      if (a === 'import') return $('projFile').click();
      if (a === 'open') { const rep = await Store.open(id); afterLoad(); toast(rep ? 'Opened. ' + rep + ' value(s) were out of range and were reset.' : 'Project opened.', rep ? 'warn' : 'ok'); return close(); }
      if (a === 'dup') { await Store.duplicate(id); render(); return toast('Project duplicated.', 'ok'); }
      if (a === 'export') {
        const { text, name } = await Store.exportJSON(id);
        const r = await Native.deliver({ filename: Native.safeName(name) + '.wwtp.json', mime: 'application/json', blob: new Blob([text], { type: 'application/json' }), title: 'WWTP project: ' + name });
        return toast(r.method === 'download' ? 'Project file downloaded.' : r.method === 'cancelled' ? 'Export cancelled.' : 'Project file ready to share.', 'ok');
      }
      if (a === 'del') {
        const r = Store.list().find(x => x.id === id);
        if (!window.confirm('Delete project "' + (r ? r.name : '') + '"? This cannot be undone.')) return;
        const wasCurrent = await Store.remove(id);
        if (wasCurrent) afterLoad(); render(); return toast('Project deleted.', 'ok');
      }
    } catch (e) { toast(e.message || String(e), 'err'); }
  }
  function build() {
    const wrap = document.createElement('div');
    wrap.className = 'modal-back'; wrap.id = 'projModal';
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Projects">
      <div class="modal-h"><h2>Projects</h2><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
      <div class="modal-actions"><button class="btn teal small" data-act="new">+ New project</button>
        <button class="btn secondary small" data-act="copy">Save a copy</button>
        <button class="btn secondary small" data-act="import">Import file</button></div>
      <div class="proj-list" id="projList"></div>
      <div class="note">Projects are saved automatically on this device. Use <b>Export</b> to keep a backup file or move a project to another device.</div>
      <input type="file" id="projFile" accept=".json,application/json" hidden></div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', e => {
      if (e.target === wrap) return close();
      const b = e.target.closest('[data-act]'); if (!b) return;
      const row = b.closest('[data-id]'); act(b.dataset.act, row ? row.dataset.id : null);
    });
    $('projFile').addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0]; e.target.value = '';
      if (!file) return;
      try {
        if (file.size > 2e6) throw new Error('File is too large to be a project file.');
        const rep = await Store.importText(await file.text());
        afterLoad(); close();
        toast(rep ? 'Imported. ' + rep + ' value(s) were out of range and were reset.' : 'Project imported.', rep ? 'warn' : 'ok');
      } catch (err) { toast('Import failed: ' + (err.message || err), 'err'); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpenFlag) close(); });
  }
  return { sidebarHtml, refreshHeader, setMeta, setProfile, afterLoad, openModal, close, build, docNo, today, initials, isOpen: () => isOpenFlag };
})();
window.ProjectsUI = ProjectsUI;
