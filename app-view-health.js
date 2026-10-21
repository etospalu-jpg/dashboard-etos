/* ETOS View Health v38.11 — recover emptied protected pages without changing permissions. */
(function(){
'use strict';
if(window.ETOS_VIEW_HEALTH)return;
const views={
 keislaman:{section:'view-keislaman',root:'etos-keislaman-root',loader:'loadKeislaman',module:'app-keislaman',label:'Pembinaan Keislaman'},
 ski:{section:'view-ski',root:'view-ski',loader:'loadSki',module:'app-ski',label:'SKI Saya'}
};
const pending=new Map(),timers=new Map();
function active(view){
 const p=views[view],section=p&&document.getElementById(p.section);
 return !!(section&&section.classList.contains('active'));
}
function empty(view){
 const p=views[view],node=p&&document.getElementById(p.root);
 return !!(node&&!node.innerHTML.trim());
}
function message(view,detail){
 const p=views[view],node=p&&document.getElementById(p.root);
 if(!node)return;
 const box=document.createElement('div');box.className='card p-6';
 box.setAttribute('role','status');box.style.maxWidth='680px';
 const title=document.createElement('h3');title.className='section-title text-[19px]';title.textContent=p.label+' belum dapat ditampilkan';
 const desc=document.createElement('p');desc.className='text-[12px] text-[#617994] mt-2 leading-6';desc.textContent=detail||'Sistem gagal memuat bagian ini. Silakan coba lagi.';
 const button=document.createElement('button');button.className='btn btn-primary mt-4';button.type='button';button.textContent='Coba Muat Ulang';
 button.addEventListener('click',()=>restore(view,true));
 box.append(title,desc,button);node.replaceChildren(box);
}
async function restore(view,forced=false){
 if(!views[view]||!active(view)||(!forced&&!empty(view)))return;
 if(pending.has(view))return pending.get(view);
 const task=(async()=>{
  try{
   const cfg=views[view];
   if(typeof window[cfg.loader]!=='function'&&typeof window.etosLoadModule==='function')
    await window.etosLoadModule(cfg.module);
   if(typeof window[cfg.loader]!=='function')throw Error('Modul belum dimuat oleh aplikasi.');
   // Do not wait indefinitely on slow services; each module provides its own loading/error UI.
   await Promise.race([
    Promise.resolve(window[cfg.loader](true)),
    new Promise(resolve=>setTimeout(resolve,2600))
   ]);
   if(empty(view))message(view,'Konten modul kosong setelah pemuatan. Coba muat ulang.');
  }catch(err){
   if(empty(view))message(view,'Pemuatan terhenti: '+String(err?.message||err).slice(0,180));
  }
 })().finally(()=>pending.delete(view));
 pending.set(view,task);
 return task;
}
function schedule(view){
 if(!views[view])return;
 clearTimeout(timers.get(view));
 const t=setTimeout(()=>restore(view),480);
 timers.set(view,t);
}
document.addEventListener('click',event=>{
 const nav=event.target?.closest?.('.nav-btn[data-view]');
 if(nav&&views[nav.dataset.view])schedule(nav.dataset.view);
},{capture:true,passive:true});
function checkActive(){for(const view of Object.keys(views))if(active(view))schedule(view)}
window.addEventListener('pageshow',()=>setTimeout(checkActive,650));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkActive()});
for(const view of Object.keys(views)){
 const el=document.getElementById(views[view].root);
 if(!el)continue;
 const observer=new MutationObserver(()=>{if(active(view)&&empty(view))schedule(view)});
 observer.observe(el,{childList:true});
}
window.ETOS_VIEW_HEALTH={restore,check:checkActive,isEmpty:empty};
setTimeout(checkActive,800);
})();