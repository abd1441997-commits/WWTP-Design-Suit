"""Simulates the Capacitor native bridge (mock Preferences / Filesystem / Share / App plugins) in Chromium
to exercise the app's NATIVE code paths: persistence via Preferences, PDF -> Filesystem -> Share, back button.
This does NOT replace testing on a real device (see docs/TESTING.md)."""
import base64, json, subprocess, sys, tempfile, os
from playwright.sync_api import sync_playwright
URL = os.environ.get('APP_URL', 'http://localhost:8099/index.html')
MOCK = """
(() => {
  const ns = k => 'mock.' + k;
  window.__listeners = {}; window.__calls = [];
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {
    Preferences: { get: async ({key}) => ({ value: sessionStorage.getItem(ns(key)) }), set: async ({key, value}) => { sessionStorage.setItem(ns(key), value); window.__calls.push('pref.set'); }, remove: async ({key}) => sessionStorage.removeItem(ns(key)) },
    Filesystem: { writeFile: async o => { window.__file = o; return { uri: 'file:///cache/' + o.path }; } },
    Share: { share: async o => { window.__share = o; return {}; } },
    App: { addListener: (n, cb) => { window.__listeners[n] = cb; return { remove() {} }; }, exitApp: () => { window.__exited = true; } },
    StatusBar: { setStyle: async () => {} } } };
})();
"""
res = {}
with sync_playwright() as pw:
    b = pw.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    ctx.add_init_script(MOCK); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.evaluate('window.__appReady'); pg.wait_for_timeout(500)
    res['native_class'] = pg.evaluate("document.body.classList.contains('native')")
    res['sw_registered'] = pg.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.length)")
    # persistence through the Preferences plugin only
    pg.fill('#gin-Qavg', '555') if pg.is_visible('#gin-Qavg') else pg.evaluate("updateGlobal('Qavg',555,null)")
    pg.evaluate("updateGlobal('Qavg',555,null); ProjectsUI.setMeta('name','Native Test')"); pg.evaluate("Store.flush()"); pg.wait_for_timeout(300)
    res['pref_writes'] = pg.evaluate("window.__calls.length")
    pg.evaluate("localStorage.clear()")          # prove restore comes from Preferences, not localStorage
    pg.reload(); pg.evaluate('window.__appReady'); pg.wait_for_timeout(500)
    res['restored_Qavg'] = pg.evaluate("I.Qavg"); res['restored_name'] = pg.evaluate("Store.meta.name")
    # PDF export -> Filesystem.writeFile (base64) -> Share.share(url)
    pg.click('#bottomNav button[data-go=report]')
    pg.evaluate("ReportPDF.exportPDF()"); pg.wait_for_function("window.__share", timeout=30000)
    f = pg.evaluate("window.__file"); sh = pg.evaluate("window.__share")
    raw = base64.b64decode(f['data']); path = os.path.join(tempfile.gettempdir(), 'native_sim.pdf'); open(path, 'wb').write(raw)
    res['pdf_header'] = raw[:5].decode(); res['pdf_bytes'] = len(raw); res['fs_dir'] = f['directory']; res['file_name'] = f['path']
    res['share_url'] = sh['url']
    res['pdf_pages'] = [l for l in subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout.splitlines() if l.startswith('Pages')]
    # back button: report -> design; design -> exit
    pg.evaluate("window.__listeners.backButton()"); res['tab_after_back'] = pg.evaluate("document.querySelector('.tab-btn.active').dataset.tab")
    pg.evaluate("window.__listeners.backButton()"); res['exited_on_second_back'] = pg.evaluate("!!window.__exited")
    res['errors'] = errs
    b.close()
print(json.dumps(res, indent=1))
ok = res['restored_Qavg'] == 555 and res['restored_name'] == 'Native Test' and res['pdf_header'] == '%PDF-' and not res['errors'] and res['sw_registered'] == 0 and res['exited_on_second_back']
print('NATIVE-SIM', 'PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
