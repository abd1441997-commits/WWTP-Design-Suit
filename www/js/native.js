/* Thin layer over Capacitor plugins with browser fallbacks.
   Works as: native Android/iOS app (Capacitor), installed PWA, or plain browser tab. */
const Native = (function () {
  const cache = {};
  function isNative() { return !!(window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()); }
  function platform() { return isNative() && Capacitor.getPlatform ? Capacitor.getPlatform() : 'web'; }
  function plugin(name) {
    if (!isNative()) return null;
    if (cache[name]) return cache[name];
    const C = window.Capacitor; let p = null;
    try { p = (C.Plugins && C.Plugins[name]) || (C.registerPlugin ? C.registerPlugin(name) : null); } catch (e) { p = (C.Plugins && C.Plugins[name]) || null; }
    cache[name] = p; return p;
  }
  const isMobileWeb = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safeName = s => String(s || 'file').replace(/[^\w\-. ]+/g, '_').replace(/\s+/g, '_').slice(0, 80);

  function blobToBase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] || '');
      r.onerror = () => rej(r.error || new Error('read failed'));
      r.readAsDataURL(blob);
    });
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }

  /* Deliver a file to the user: share sheet on native / mobile web, download on desktop. */
  async function deliver({ filename, mime, blob, title }) {
    filename = safeName(filename);
    if (isNative()) {
      const FS = plugin('Filesystem'), Share = plugin('Share');
      if (!FS || !Share) throw new Error('Native file plugins are not available.');
      const data = await blobToBase64(blob);
      const w = await FS.writeFile({ path: filename, data, directory: 'CACHE' });
      try { await Share.share({ title: title || filename, url: w.uri, dialogTitle: title || 'Share' }); }
      catch (e) { if (!/cancel/i.test(String(e && e.message || e))) throw e; return { method: 'cancelled', uri: w.uri }; }
      return { method: 'share', uri: w.uri };
    }
    if (isMobileWeb() && navigator.canShare && navigator.share) {
      try {
        const file = new File([blob], filename, { type: mime });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: title || filename }); return { method: 'share' }; }
      } catch (e) { if (e && e.name === 'AbortError') return { method: 'cancelled' }; }
    }
    download(blob, filename);
    return { method: 'download' };
  }

  /* ---------- lifecycle ---------- */
  async function init() {
    const body = document.body;
    if (isNative()) body.classList.add('native', 'plat-' + platform());
    // keyboard: hide bottom bar while typing, keep the field visible
    document.addEventListener('focusin', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
        body.classList.add('kbd');
        setTimeout(() => { try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} }, 320);
      }
    });
    document.addEventListener('focusout', () => setTimeout(() => {
      const a = document.activeElement; if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) body.classList.remove('kbd');
    }, 120));
    // never lose work: flush the autosave when the page is hidden
    const flush = () => { try { Store.flush(); } catch (e) {} };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);

    if (!isNative()) return;
    const App = plugin('App'), SB = plugin('StatusBar');
    // iOS: light status-bar text on the dark header. Android 15+ is edge-to-edge (handled by the SystemBars config + CSS safe-area insets).
    try { if (SB && platform() === 'ios') await SB.setStyle({ style: 'DARK' }); } catch (e) {}
    try { if (App) {
      App.addListener('pause', flush);
      App.addListener('backButton', () => {
        if (window.ProjectsUI && ProjectsUI.isOpen()) return ProjectsUI.close();
        const inputs = body.classList.contains('mode-inputs');
        const active = document.querySelector('.tab-btn.active');
        if (inputs || (active && active.dataset.tab !== 'calc')) return switchTab('calc');
        flush(); if (App.exitApp) App.exitApp();
      });
    } } catch (e) {}
  }
  return { isNative, platform, plugin, deliver, download, init, isMobileWeb, safeName };
})();
window.Native = Native;
