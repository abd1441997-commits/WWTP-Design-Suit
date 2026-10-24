/* Application start-up: restore the last project, build the UI, register offline support. */
window.__appReady = (async function () {
  try { await Store.init(); } catch (e) { console.error('Store init failed', e); }
  ProjectsUI.build();
  buildSidebar();
  ProjectsUI.refreshHeader();
  runAll();
  try { await Store.save(); } catch (e) {}
  try { await Native.init(); } catch (e) { console.error(e); }
  if (Store.startupNote) toast(Store.startupNote, 'warn');
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !Native.isNative()) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
