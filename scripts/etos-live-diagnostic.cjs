'use strict';
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'allow'});
 const errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url().slice(0,160),error:r.failure()?.errorText}));
 try{const res=await page.goto('https://dashboard.etosidpalu.com/',{waitUntil:'domcontentloaded',timeout:22000});console.log('LIVE_STATUS',res?.status());}
 catch(e){console.log('LIVE_UNREACHABLE',String(e.message).slice(0,300));return}
 await page.waitForTimeout(5500);
 const a=await page.evaluate(()=>({goView:typeof window.goView,loadView:typeof window.loadView,ki:typeof window.loadKeislaman,ski:typeof window.loadSki,nav:!!document.querySelector('.nav-btn[data-view="keislaman"]'),auth:typeof state==='undefined'?'absent':state.auth,ready:window.ETOS_VERSION,kiRoot:!!document.getElementById('etos-keislaman-root')}));
 console.log('LIVE_INITIAL',JSON.stringify(a));if(a.goView!=='function')return;
 await page.evaluate(()=>{state.auth=true;state.session={kind:'pin',role:'superadmin'};state.role='superadmin';window.updateAuthUI?.()});
 for(const view of ['keislaman','ski']){
  try{
   await page.locator('.nav-btn[data-view="'+view+'"]').click({timeout:9000});await page.waitForTimeout(1500);
   const c=await page.evaluate(v=>({active:document.getElementById('view-'+v)?.className,kiRootLen:document.getElementById('etos-keislaman-root')?.innerHTML.length,skiLen:document.getElementById('view-ski')?.innerHTML.length,visible:document.getElementById('view-'+v)?.innerText?.slice(0,240),toast:document.getElementById('toast-host')?.innerText?.slice(0,300)}),view);console.log('LIVE_NAV',view,JSON.stringify(c));
  }catch(e){console.log('LIVE_NAV_ERROR',view,String(e.message).slice(0,400))}
 }
 console.log('LIVE_ERRORS',JSON.stringify(errors.slice(0,15)),'LIVE_REQ_FAILED',JSON.stringify(failed.slice(0,12)));
 }finally{await browser.close()}
})().catch(e=>{console.error('LIVE_DIAG_ERROR',String(e.message));process.exitCode=1});
