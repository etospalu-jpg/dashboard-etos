(function(){
'use strict';
if(window.ETOS_PIN_POLICY_V362)return;window.ETOS_PIN_POLICY_V362=true;
const PIN_VIEWS=new Set(['coaching','mentoring','profile','system','datacenter','settings']);
const VIEW_TITLES={dashboard:'Dashboard',directory:'Direktori Awardee',alumni:'Tracking Alumni',academic:'Monitoring Akademik',attendance:'Absensi Pembinaan',coaching:'Coaching & IDP',achievements:'Prestasi Awardee',mentoring:'Jurnal Pendampingan',profile:'Profil Fasilitator',system:'System Center',datacenter:'Data Center',settings:'Pengaturan'};
function appState(){try{return typeof state!=='undefined'?state:null}catch(_){return null}}
function pinReady(){return appState()?.session?.kind==='pin'}
function requestPin(next){
  if(pinReady())return true;
  const st=appState();
  if(st)st.afterAuth=typeof next==='function'?next:null;
  if(typeof window.openPinAccess==='function')window.openPinAccess();
  else window.openLogin?.();
  return false;
}
function ensureNavStyle(){
  if(document.getElementById('etos-pin-visible-nav'))return;
  const s=document.createElement('style');
  s.id='etos-pin-visible-nav';
  s.textContent='#sidebar .nav-btn[data-view]{display:flex!important;visibility:visible!important;opacity:1!important}';
  document.head.appendChild(s);
}
function showAllNav(){
  ensureNavStyle();
  document.querySelectorAll('#sidebar .nav-btn[data-view]').forEach(b=>{
    if(b.getAttribute('aria-hidden')==='true')b.setAttribute('aria-hidden','false');
    if(b.hasAttribute('hidden'))b.removeAttribute('hidden');
    if(b.disabled)b.disabled=false;
  });
}
async function openViewDirect(view,force=false){
  const st=appState();if(!st)return;
  const target=document.getElementById('view-'+view);
  if(!target){window.toast?.('Modul belum tersedia.','warn');return}
  st.view=view;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  target.classList.add('active');
  document.querySelectorAll('.nav-btn[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const title=document.getElementById('page-title');if(title)title.textContent=VIEW_TITLES[view]||view;
  window.toggleSidebar?.(false);
  if(typeof window.loadView==='function')await window.loadView(view,force);
}
window.goView=async function(view,force=false){
  view=String(view||'').trim();if(!view)return;
  showAllNav();
  if(PIN_VIEWS.has(view)&&!pinReady()){
    requestPin(()=>window.goView(view,force));
    return;
  }
  return openViewDirect(view,force);
};
try{secureViews.delete('attendance')}catch(_){}
function wrapPinAction(name){
  const base=window[name];
  if(typeof base!=='function'||base.__etosPinPolicyV362)return;
  const guarded=function(){const self=this,args=arguments;if(!requestPin(()=>guarded.apply(self,args)))return;return base.apply(self,args)};
  guarded.__etosPinPolicyV362=true;window[name]=guarded;
}
function installActionGates(){
  ['openAttendanceEntry','openAttendancePeriodSettings','deleteAttendancePeriodSetting','openAttendanceAgendaSettings','deleteAttendanceAgendaSetting'].forEach(wrapPinAction);
}
function reinforce(){showAllNav();installActionGates()}
reinforce();
window.addEventListener('etos:enhancements-ready',()=>setTimeout(reinforce,0));
const side=document.getElementById('sidebar');
if(side&&window.MutationObserver){
  const ob=new MutationObserver(()=>reinforce());
  ob.observe(side,{subtree:true,childList:true,attributes:true,attributeFilter:['style','hidden','aria-hidden','disabled']});
}
setTimeout(reinforce,250);setTimeout(reinforce,1200);
})();
