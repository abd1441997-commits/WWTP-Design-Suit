from playwright.sync_api import sync_playwright
import json, time, subprocess
import os
OUT=os.environ.get('OUT','/tmp')
URL=os.environ.get('APP_URL','http://localhost:8099/index.html')
res={}
with sync_playwright() as pw:
    b=pw.chromium.launch()
    ctx=b.new_context(viewport={'width':1300,'height':900}, accept_downloads=True)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('console',lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
    pg.goto(URL); pg.wait_for_function('window.__appReady'); pg.evaluate('window.__appReady'); pg.wait_for_timeout(600)
    res['errors']=errs
    res['fonts']=pg.evaluate("Promise.all([document.fonts.load('600 14px \"IBM Plex Sans\"'),document.fonts.load('600 14px \"JetBrains Mono\"')]).then(()=>[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.weight))")
    res['cardCount']=pg.evaluate("document.querySelectorAll('.unit-card').length")
    # service worker + offline
    pg.wait_for_function("navigator.serviceWorker.controller || true")
    pg.evaluate("navigator.serviceWorker.ready.then(()=>true)")
    pg.reload(); pg.wait_for_timeout(1200)
    res['sw_controlled']=pg.evaluate("!!navigator.serviceWorker.controller")
    ctx.set_offline(True)
    pg.reload(); pg.wait_for_function('window.__appReady'); pg.wait_for_timeout(800)
    res['offline_cards']=pg.evaluate("document.querySelectorAll('.unit-card').length")
    res['offline_fonts_ok']=pg.evaluate("document.fonts.check('600 14px \"IBM Plex Sans\"')")
    # edit while offline + persistence across reload
    pg.fill('#gin-Qavg','640'); pg.dispatch_event('#gin-Qavg','change'); pg.wait_for_timeout(900)
    pg.reload(); pg.wait_for_function('window.__appReady'); pg.wait_for_timeout(600)
    res['persisted_Qavg']=pg.evaluate("I.Qavg")
    res['saveStatus']=pg.inner_text('#saveStatus')
    ctx.set_offline(False)
    # invalid input via UI
    pg.fill('#gin-opHours','30'); pg.dispatch_event('#gin-opHours','change'); pg.wait_for_timeout(200)
    res['invalid_flag']=pg.evaluate("document.getElementById('gin-opHours').classList.contains('invalid')")
    res['opHours_after']=pg.evaluate("I.opHours")
    res['toast']=pg.inner_text('#toast')
    # PDF export (desktop => download)
    pg.click('button[data-tab=report]')
    with pg.expect_download() as dl:
        pg.click('#btnPdf')
    d=dl.value; path=OUT+'/'+d.suggested_filename; d.save_as(path); res['pdf']=path
    pg.screenshot(path=''+OUT+'/desktop.png')
    # manage projects modal
    pg.click('#projBtn'); pg.wait_for_timeout(300); pg.screenshot(path=''+OUT+'/modal.png')
    pg.keyboard.press('Escape')
    # mobile
    m=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,accept_downloads=True)
    mp=m.new_page(); merr=[]; mp.on('pageerror',lambda e:merr.append(str(e)))
    mp.goto(URL); mp.wait_for_function('window.__appReady'); mp.wait_for_timeout(700)
    mp.screenshot(path=''+OUT+'/m_design.png')
    mp.click('#bottomNav button[data-go=inputs]'); mp.wait_for_timeout(300); mp.screenshot(path=''+OUT+'/m_inputs.png')
    mp.click('#bottomNav button[data-go=report]'); mp.wait_for_timeout(300); mp.screenshot(path=''+OUT+'/m_report.png')
    res['mobile_errors']=merr
    res['mobile_scrollW']=mp.evaluate('document.documentElement.scrollWidth')
    b.close()
print(json.dumps(res,indent=1))
