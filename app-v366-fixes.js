(function(){
'use strict';
if(window.ETOS_V366_FIXES)return;window.ETOS_V366_FIXES=true;
const R=window.ETOSRestore;
function canDev(){try{return !!R?.canDev?.()}catch{return false}}
function dashboardActive(){return document.getElementById('view-dashboard')?.classList.contains('active')}
function installCommandGate(){
  const fn=window.loadRestoredCommandCenter;
  if(typeof fn!=='function'||fn.__etosV366Gate)return;
  const base=fn;
  const wrapped=async function(force=false){
    if(!canDev()){
      document.getElementById('rest-command-center')?.remove();
      return;
    }
    const out=await base.apply(this,arguments);
    const note=document.getElementById('rest-command-note');
    if(note&&/google sheets|idp live/i.test(note.textContent||''))note.textContent=(note.textContent||'').replace(/IDP live Google Sheets/gi,'IDP Palu').replace(/IDP live/gi,'IDP Palu');
    return out;
  };
  wrapped.__etosV366Gate=true;
  window.loadRestoredCommandCenter=wrapped;
}
function installIDPPersistStatus(){
  const fn=window.loadIDPCenter;
  if(typeof fn!=='function'||fn.__etosV366Persist)return;
  const base=fn;
  const wrapped=async function(force=false){
    const out=await base.apply(this,arguments);
    try{
      const r=await fetch('/api/idp-live?source_health=1',{cache:'no-store',credentials:'same-origin'}),b=await r.json();
      const d=b?.data||{};
      if(r.ok&&d.mode==='uploaded-palu-xlsx'){
        const mode=document.getElementById('rest-idp-mode');
        const note=document.getElementById('rest-idp-note');
        if(mode){mode.textContent='IDP Palu Tersimpan';mode.className='pill pill-green'}
        if(note){const when=d.uploadedAt?new Date(d.uploadedAt).toLocaleString('id-ID'):'';note.textContent=`File aktif tersimpan permanen di database: ${d.title||'IDP Palu'}${when?' • '+when:''}. Refresh halaman tetap menggunakan file ini.`}
      }
    }catch(_){ }
    return out;
  };
  wrapped.__etosV366Persist=true;
  window.loadIDPCenter=wrapped;
}
function sync(){
  installCommandGate();installIDPPersistStatus();
  const box=document.getElementById('rest-command-center');
  if(!canDev()){
    if(box)box.remove();
    return;
  }
  if(dashboardActive()&&!box&&typeof window.loadRestoredCommandCenter==='function')window.loadRestoredCommandCenter(false).catch?.(()=>{});
}
sync();
window.addEventListener('etos:enhancements-ready',()=>setTimeout(sync,0));
setInterval(sync,700);
})();
