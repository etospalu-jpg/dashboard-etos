'use strict';
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json'};
const base=path.resolve(__dirname,'..','public');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost:8765');
 if(url.pathname.startsWith('/api/')){
  const status=url.pathname==='/api/pin-login'&&req.method==='GET'?
   {success:true,data:{session:{kind:'pin',role:'superadmin',scope:'etos-operational',expires_at:Math.floor(Date.now()/1000)+3600}}}:
   {success:false,error:'Tes browser: backend fixture tidak dihubungkan'};
  const buf=Buffer.from(JSON.stringify(status));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(buf);return;
 }
 const fname=path.resolve(base,'.'+url.pathname);
 if(fname!==base&&!fname.startsWith(base+path.sep)){res.writeHead(403);res.end();return}
 const target=fs.existsSync(fname)&&fs.statSync(fname).isFile()?fname:path.join(base,'index.html');
 res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});
 fs.createReadStream(target).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,180))});
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>typeof window.goView==='function'&&typeof window.loadView==='function'&&typeof window.loadKeislaman==='function'&&typeof window.loadSki==='function',{timeout:45000});
  const initial=await page.evaluate(()=>({kiRoot:!!document.getElementById('etos-keislaman-root'),skiView:!!document.getElementById('view-ski'),loader:typeof window.loadView,route:typeof window.goView,coreReady:typeof window.boot}));
  console.log('INITIAL',JSON.stringify(initial));
  await page.evaluate(()=>{state.auth=true;state.session={kind:'pin',role:'superadmin',scope:'etos-operational'};state.role='superadmin';window.updateAuthUI?.()});
  for(const view of ['keislaman','ski','dashboard','keislaman']){
   if(view==='ski') await page.locator('#ski-nav').click({timeout:15000});
   else await page.locator('.nav-btn[data-view="'+view+'"]').click({timeout:15000});
   await page.waitForTimeout(900);
   const snap=await page.evaluate(v=>({
    view:v,
    current:state.view,
    section:document.getElementById('view-'+v)?.className,
    kiContent:document.getElementById('etos-keislaman-root')?.innerText?.slice(0,220),
    skiContent:document.getElementById('view-ski')?.innerText?.slice(0,220),
    innerLength:document.getElementById('view-'+v)?.innerHTML?.length||0,
    toast:document.getElementById('toast-host')?.innerText?.slice(-220)
   }),view);
   console.log('NAV',JSON.stringify(snap));
   if(view==='keislaman')assert.ok((snap.kiContent||'').trim().length>40,'Pembinaan Keislaman blank despite PIN');
   if(view==='ski')assert.ok((snap.skiContent||'').trim().length>30,'SKI Saya blank despite PIN');
  }
  const end=await page.evaluate(()=>({tabs:[...document.querySelectorAll('[data-ki-tab]')].map(x=>x.innerText),module:typeof window.ETOSTahfidz2026?.load,root:!!document.querySelector('#ki-content')}));
  // Reproduce screenshots: active panels have empty markup after a stale route.
  await page.evaluate(()=>document.getElementById('etos-keislaman-root')?.replaceChildren());
  await page.waitForTimeout(1300);
  const restoredKi=await page.evaluate(()=>document.getElementById('etos-keislaman-root')?.innerText?.length||0);
  console.log('RECOVERY_KEISLAMAN',restoredKi);
  assert.ok(restoredKi>40,'Keislaman remained blank after recovery watchdog');
  await page.locator('#ski-nav').click();
  await page.evaluate(()=>document.getElementById('view-ski')?.replaceChildren());
  await page.waitForTimeout(1300);
  const restoredSki=await page.evaluate(()=>document.getElementById('view-ski')?.innerText?.length||0);
  console.log('RECOVERY_SKI',restoredSki);
  assert.ok(restoredSki>25,'SKI remained blank after recovery watchdog');
  await page.locator('.nav-btn[data-view="keislaman"]').click();
  await page.locator('[data-ki-tab="hafalan"]').click();
  await page.waitForTimeout(300);
  const cohort=await page.evaluate(()=>({
   root:!!document.getElementById('ki-tahfidz-root'),
   tabs:[...document.querySelectorAll('[data-hafalan-cohort]')].map(x=>x.textContent),
   message:document.getElementById('ki-content')?.innerText?.slice(0,160)
  }));
  console.log('TAHFIDZ_TAB',JSON.stringify(cohort));
  assert.ok(cohort.root&&cohort.tabs.length===2,'Tahfidz 2026 cohort panel missing');
  await page.route('**/api/public-attendance',async route=>{
    let body={};try{body=route.request().postDataJSON()||{}}catch{}
    if(body.action!=='etos23_report')return route.continue();
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{room:'ETOS23',fetched_at:new Date().toISOString(),peserta:[{id:'sample-1',nama:'Peserta Uji',total_ayat_lulus:42,target_surah:'An-Naba',target_ayat_awal:1,target_ayat_akhir:40}],setoran:[],feedback:[],kehadiran:[]}})});
  });
  await page.locator('[data-hafalan-cohort="2023"]').click();
  await page.getByText('Peserta Uji').waitFor({timeout:6500});
  const etos23=await page.locator('#ki-etos23-root').innerText();
  assert.match(etos23,/42/);
  assert.match(etos23,/MurojaAku/);
  console.log('ETOS23_LIVE_MOCK','PASS');
  await page.evaluate(()=>{
    const base=window.etosAPI.call.bind(window.etosAPI);
    window.etosAPI.call=async(name,params)=>name==='getReflectionHub'?
      {success:true,data:{forms:[{agenda:'Kajian Keislaman',tanggal:'2026-10-11',eligibleCount:7,responseCount:0,pendingCount:7,responses:[]}],periods:[],period:null}}:
      base(name,params);
  });
  await page.locator('[data-ki-tab="kajian"]').click();
  await page.locator('a[href="/r/7DD1FACC"]').waitFor({timeout:6500});
  console.log('KAJIAN_LINK_RENDER','PASS');
  console.log('END',JSON.stringify(end),'PAGE_ERRORS',JSON.stringify(errors.slice(0,15)));
  assert.ok(end.tabs.includes('Monitoring Hafalan'),'Tahfidz not reachable');
 }finally{await browser.close()}
})().catch(e=>{console.error('BROWSER SMOKE FAILED:',e.stack||e);process.exitCode=1}).finally(()=>server.close());
