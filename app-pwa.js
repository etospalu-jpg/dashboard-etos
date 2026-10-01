(function(){
'use strict';
const VERSION='36.25';
const DISMISSED_KEY='etos:pwa:install-dismissed:v1';
const INSTALLED_KEY='etos:pwa:installed:v1';
const ua=navigator.userAgent||'';
const isMac=/Macintosh|Mac OS X/i.test(ua);
const isSafari=isMac&&/Safari/i.test(ua)&&!/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
const isFirefox=/Firefox|FxiOS/i.test(ua);
const isChromium=/Chrome|Chromium|CriOS|Edg|OPR/i.test(ua);
const installSurface=location.pathname==='/'||location.pathname==='/index.html';
let deferredPrompt=null;
let banner=null;

function standalone(){
  return !!(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true;
}
function read(key){
  try{return localStorage.getItem(key)}catch(_){return null}
}
function installed(){
  return standalone()||read(INSTALLED_KEY)==='1';
}
function dismissed(){
  return read(DISMISSED_KEY)==='1';
}
function setInstalled(){
  try{localStorage.setItem(INSTALLED_KEY,'1');localStorage.removeItem(DISMISSED_KEY)}catch(_){}
  removeBanner();
}
function setDismissed(){
  try{localStorage.setItem(DISMISSED_KEY,'1')}catch(_){}
  removeBanner();
}
function removeBanner(){
  if(!banner)return;
  banner.classList.add('etos-pwa-leave');
  const old=banner;banner=null;
  setTimeout(()=>old.remove(),220);
}
function icon(){
  return '<img src="/pwa-icon.svg?v='+VERSION+'" alt="" width="46" height="46" style="width:46px;height:46px;border-radius:13px;box-shadow:0 8px 22px rgba(4,29,20,.16);flex:0 0 auto">';
}
function injectStyle(){
  if(document.getElementById('etos-pwa-style'))return;
  const s=document.createElement('style');s.id='etos-pwa-style';s.textContent=`
  #etos-pwa-install{position:fixed;right:22px;bottom:22px;z-index:12000;width:min(430px,calc(100vw - 28px));background:rgba(255,255,255,.96);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(11,27,21,.10);border-radius:22px;padding:17px;box-shadow:0 24px 70px rgba(4,29,20,.20);color:#15201c;font-family:Inter,system-ui,sans-serif;animation:etosPwaIn .32s cubic-bezier(.2,.8,.2,1) both}
  #etos-pwa-install.etos-pwa-leave{animation:etosPwaOut .2s ease both}
  #etos-pwa-install .etos-pwa-top{display:flex;align-items:flex-start;gap:12px}
  #etos-pwa-install .etos-pwa-copy{min-width:0;flex:1}
  #etos-pwa-install .etos-pwa-eyebrow{font-size:9px;line-height:1.2;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#0f6248}
  #etos-pwa-install .etos-pwa-title{font:800 15px/1.25 Manrope,Inter,system-ui,sans-serif;letter-spacing:-.02em;margin-top:5px}
  #etos-pwa-install .etos-pwa-desc{font-size:10.5px;line-height:1.55;color:#65736b;margin-top:6px}
  #etos-pwa-install .etos-pwa-close{width:30px;height:30px;border:0;border-radius:10px;background:#f1f5f3;color:#66736c;display:grid;place-items:center;cursor:pointer;font-size:18px;line-height:1}
  #etos-pwa-install .etos-pwa-actions{display:flex;gap:8px;margin-top:14px;justify-content:flex-end;flex-wrap:wrap}
  #etos-pwa-install button.etos-pwa-btn{border:0;border-radius:11px;padding:9px 13px;font:800 10px/1 Inter,system-ui,sans-serif;cursor:pointer;min-height:36px}
  #etos-pwa-install .etos-pwa-later{background:#edf2ef;color:#516159}
  #etos-pwa-install .etos-pwa-install{background:#0b1b15;color:white;box-shadow:0 8px 20px rgba(5,38,26,.16)}
  #etos-pwa-install .etos-pwa-note{margin-top:11px;padding:9px 10px;border-radius:11px;background:#f5f8f6;color:#5f6d65;font-size:9.5px;line-height:1.5}
  @keyframes etosPwaIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
  @keyframes etosPwaOut{to{opacity:0;transform:translateY(8px) scale(.985)}}
  @media(max-width:640px){#etos-pwa-install{left:10px;right:10px;bottom:10px;width:auto;border-radius:19px;padding:15px}}
  @media(prefers-reduced-motion:reduce){#etos-pwa-install,#etos-pwa-install.etos-pwa-leave{animation:none}}
  `;document.head.appendChild(s);
}
function modeCopy(mode){
  if(mode==='native')return{
    eyebrow:'Aplikasi ETOS',
    title:'Install ETOS ID Palu',
    desc:'Pasang dashboard sebagai aplikasi di laptop. Setelah terpasang, ETOS bisa dibuka dari Applications, Dock, Start, atau launcher tanpa tampilan tab browser.',
    action:'Install Aplikasi',
    note:'Instalasi menggunakan fitur resmi browser. Data Awardee tetap tersimpan aman di Supabase.'
  };
  if(mode==='safari')return{
    eyebrow:'Safari · macOS',
    title:'Jadikan ETOS aplikasi di MacBook',
    desc:'Safari menggunakan fitur Add to Dock. Setelah ditambahkan, ETOS akan tampil sebagai aplikasi tersendiri di Applications, Dock, dan Spotlight.',
    action:'Lihat Caranya',
    note:'Di Safari pilih File → Add to Dock (Tambahkan ke Dock), lalu konfirmasi nama aplikasi.'
  };
  if(mode==='firefox')return{
    eyebrow:'Firefox · macOS',
    title:'Install ETOS di MacBook',
    desc:'Firefox di macOS belum menyediakan instalasi web-app native. Untuk memasang ETOS sebagai aplikasi, buka dashboard ini di Safari, Chrome, atau Edge.',
    action:'Mengerti',
    note:'Safari: File → Add to Dock. Chrome/Edge: gunakan tombol Install saat tawaran muncul.'
  };
  return{
    eyebrow:'Progressive Web App',
    title:'Pasang ETOS sebagai aplikasi',
    desc:'Browser ini tidak menyediakan prompt instalasi otomatis di halaman. Gunakan menu browser dan pilih Install app / Install site as app bila tersedia.',
    action:'Mengerti',
    note:'Jika menu instalasi tidak tersedia, gunakan Safari, Chrome, atau Edge pada laptop.'
  };
}
function makeBanner(mode){
  if(!installSurface||installed()||dismissed())return;
  if(banner)banner.remove();
  injectStyle();
  const c=modeCopy(mode);
  banner=document.createElement('aside');
  banner.id='etos-pwa-install';
  banner.setAttribute('role','dialog');
  banner.setAttribute('aria-label','Install aplikasi ETOS ID Palu');
  banner.innerHTML=`
    <div class="etos-pwa-top">
      ${icon()}
      <div class="etos-pwa-copy">
        <div class="etos-pwa-eyebrow">${c.eyebrow}</div>
        <div class="etos-pwa-title">${c.title}</div>
        <div class="etos-pwa-desc">${c.desc}</div>
      </div>
      <button class="etos-pwa-close" type="button" aria-label="Tutup tawaran install">×</button>
    </div>
    <div class="etos-pwa-note">${c.note}</div>
    <div class="etos-pwa-actions">
      <button class="etos-pwa-btn etos-pwa-later" type="button">Nanti saja</button>
      <button class="etos-pwa-btn etos-pwa-install" type="button">${c.action}</button>
    </div>`;
  document.body.appendChild(banner);
  banner.querySelector('.etos-pwa-close').addEventListener('click',setDismissed);
  banner.querySelector('.etos-pwa-later').addEventListener('click',setDismissed);
  banner.querySelector('.etos-pwa-install').addEventListener('click',async()=>{
    if(mode==='native'&&deferredPrompt){
      const prompt=deferredPrompt;deferredPrompt=null;
      try{
        await prompt.prompt();
        const choice=await prompt.userChoice;
        if(choice&&choice.outcome==='accepted')setInstalled();
        else setDismissed();
      }catch(_){setDismissed()}
      return;
    }
    if(mode==='safari'){
      const note=banner&&banner.querySelector('.etos-pwa-note');
      const btn=banner&&banner.querySelector('.etos-pwa-install');
      if(btn&&btn.dataset.etosSafariReady==='1'){setDismissed();return}
      if(note)note.innerHTML='<b>Di Safari:</b> buka menu <b>File</b> → <b>Add to Dock / Tambahkan ke Dock</b> → klik <b>Add</b>.';
      if(btn){btn.dataset.etosSafariReady='1';btn.textContent='Mengerti'}
      return;
    }
    setDismissed();
  });
}
function waitForShell(mode){
  const show=()=>{
    if(installed()||dismissed()||!installSurface)return;
    if(!document.getElementById('instant-shell'))makeBanner(mode);
    else setTimeout(show,350);
  };
  setTimeout(show,500);
}
window.addEventListener('beforeinstallprompt',event=>{
  if(!installSurface||installed())return;
  event.preventDefault();
  deferredPrompt=event;
  waitForShell('native');
});
window.addEventListener('appinstalled',()=>{
  deferredPrompt=null;setInstalled();
});
if(window.matchMedia){
  const mq=window.matchMedia('(display-mode: standalone)');
  const onMode=()=>{if(mq.matches)setInstalled()};
  try{mq.addEventListener('change',onMode)}catch(_){try{mq.addListener(onMode)}catch(__){}}
}
async function registerSW(){
  if(!('serviceWorker'in navigator))return;
  try{
    const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    if(reg&&reg.update)reg.update().catch(()=>{});
  }catch(err){console.warn('[ETOS PWA] service worker registration failed',err)}
}
window.addEventListener('load',registerSW,{once:true});
document.addEventListener('DOMContentLoaded',()=>{
  if(installed()){setInstalled();return}
  if(!installSurface||dismissed())return;
  if(isSafari)waitForShell('safari');
  else if(isMac&&isFirefox)waitForShell('firefox');
  else if(!isChromium)waitForShell('browser');
});
window.ETOSPWA={
  version:VERSION,
  isStandalone:standalone,
  showInstall(){
    try{localStorage.removeItem(DISMISSED_KEY)}catch(_){}
    if(deferredPrompt)waitForShell('native');
    else if(isSafari)waitForShell('safari');
    else if(isMac&&isFirefox)waitForShell('firefox');
    else waitForShell('browser');
  }
};
})();