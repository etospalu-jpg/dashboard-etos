(function(){
'use strict';
if(window.ETOS_INTERACTION_FIX)return;
window.ETOS_INTERACTION_FIX='v3-sidebar-stability';

const VIEW_ROLES={
 dashboard:['public','viewer','operator','facilitator','admin','superadmin'],
 directory:['public','viewer','operator','facilitator','admin','superadmin'],
 alumni:['public','viewer','operator','facilitator','admin','superadmin'],
 academic:['public','viewer','operator','facilitator','admin','superadmin'],
 achievements:['public','viewer','operator','facilitator','admin','superadmin'],
 attendance:['public','operator','facilitator','admin','superadmin'],
 assessment:['facilitator','admin','superadmin'],
 coaching:['facilitator','admin','superadmin'],
 mentoring:['facilitator','admin','superadmin'],
 profile:['facilitator','admin','superadmin'],
 settings:['operator','facilitator','admin','superadmin'],
 system:['admin','superadmin']
};
const TITLES={dashboard:'Dashboard',directory:'Direktori Awardee',alumni:'Tracking Alumni',academic:'Akademik',attendance:'Absensi Pembinaan',coaching:'Coaching & IDP',achievements:'Prestasi',assessment:'Asesmen & Development',mentoring:'Mentoring Command',profile:'Profil Fasilitator',settings:'Pengaturan',system:'System Center'};
const DATA_TABLE={awardee:'awardees',academic:'academic_records',achievement:'achievements',organization:'organization_records',portfolio:'portfolios',period:'development_periods',competency:'competencies',networking:'networking_records',spiritual:'spiritual_records',facilitator:'facilitators'};

function appState(){try{return state}catch(_){return window.state||null}}
function roleOf(){
 try{
  const st=appState();if(!st?.auth)return'public';
  const s=st?.session;
  if(s?.kind==='pin')return'superadmin';
  return String(s?.role||s?.profile?.role||st?.role||'viewer').toLowerCase();
 }catch(_){return'public'}
}
function canView(view,role=roleOf()){
 const allowed=VIEW_ROLES[view];
 return !allowed||allowed.includes(role);
}
function notify(message,type='warn'){
 if(typeof window.toast==='function')window.toast(message,type);else console.warn('[ETOS interaction]',message);
}
function enforceNav(){
 const role=roleOf();
 document.querySelectorAll('.nav-btn[data-view]').forEach(btn=>{
  const view=btn.dataset.view||'';
  const allowed=canView(view,role);
  const display=allowed?'':'none';
  if(btn.style.display!==display)btn.style.display=display;
  btn.removeAttribute('aria-disabled');
  btn.title=allowed?'':`Role ${role} tidak memiliki akses ke modul ini`;
  if(view==='assessment')btn.querySelectorAll('.secure-lock').forEach(x=>x.remove());
 });
 const legacy=document.getElementById('data-center-nav');
 if(legacy&&typeof window.openDataCenterHub==='function')legacy.onclick=()=>window.openDataCenterHub();
}
async function openView(view,force=false){
 const st=appState();if(!st)return;
 st.view=view;
 document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
 document.getElementById('view-'+view)?.classList.add('active');
 document.querySelectorAll('.nav-btn[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 const title=document.getElementById('page-title');if(title)title.textContent=TITLES[view]||view;
 try{window.toggleSidebar?.(false)}catch(_){}
 if(typeof window.loadView==='function')await window.loadView(view,force);
}
window.goView=async function(view,force=false){
 view=String(view||'').trim();if(!view)return;
 const role=roleOf();
 if(!canView(view,role)){
  if(role==='public'){
   const st=appState();if(st)st.afterAuth=()=>window.goView(view,force);
   window.openLogin?.();
   return;
  }
  notify(`Role ${role} tidak memiliki akses ke modul ini.`,'warn');
  return;
 }
 return openView(view,force);
};

const previousUpdate=window.updateAuthUI;
window.updateAuthUI=function(){
 const out=typeof previousUpdate==='function'?previousUpdate.apply(this,arguments):undefined;
 queueMicrotask(enforceNav);
 return out;
};

window.submitPin=async function(e){
 e?.preventDefault?.();
 const input=document.getElementById('pin-input'),btn=document.getElementById('pin-submit'),msg=document.getElementById('pin-message');
 const pin=String(input?.value||'').trim();
 if(btn){btn.disabled=true;btn.textContent='Memverifikasi...'}
 msg?.classList.add('hidden');
 try{
  const r=await window.etosAuth.signInPin(pin);
  let session=r?.session||null;
  if(!session){const s=await window.etosAuth.getSession();session=s?.data?.session||null}
  if(!session)throw new Error('Session operasional gagal dibuat.');
  const st=appState();if(!st)throw new Error('State aplikasi tidak tersedia.');
  st.auth=true;st.session=session;st.role=String(session.kind==='pin'?'superadmin':session.role||session.profile?.role||'superadmin').toLowerCase();
  window.updateAuthUI?.();
  window.closeLogin?.();
  enforceNav();
  notify('Akses operasional berhasil dibuka.','success');
  const next=st.afterAuth;st.afterAuth=null;
  if(typeof next==='function')setTimeout(()=>{try{next()}catch(err){notify(err.message||String(err),'error')}},60);
  else await window.loadView?.(st.view,true);
 }catch(err){
  if(msg){msg.textContent=err?.message||'PIN tidak sesuai.';msg.classList.remove('hidden')}
 }finally{
  if(btn){btn.disabled=false;btn.innerHTML='<i data-lucide="shield-check" class="w-4 h-4"></i>Buka Dashboard Operasional'}
  window.lucide?.createIcons?.();
 }
};

async function rehydrate(){
 try{
  const s=await window.etosAuth?.getSession?.(),session=s?.data?.session||null;
  if(session){
   const st=appState();if(st){st.auth=true;st.session=session;st.role=String(session.kind==='pin'?'superadmin':session.role||session.profile?.role||'viewer').toLowerCase()}
  }else{const st=appState();if(st&&!st.auth){st.session=null;st.role=null}}
  window.updateAuthUI?.();enforceNav();
 }catch(e){console.warn('[ETOS session rehydrate]',e?.message||e);enforceNav()}
}

async function dcRequest(action,payload={}){
 const s=await window.etosAuth?.getSession?.();if(!s?.data?.session)throw new Error('Akses operasional diperlukan.');
 const r=await fetch('/api/data-center',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
 const b=await r.json().catch(()=>({}));if(!r.ok||b.success===false)throw new Error(b.error||'Data Center gagal memproses permintaan.');return b.data;
}
window.openDataModal=async function(type){
 const table=DATA_TABLE[type];if(!table)return notify('Jenis data tidak dikenali.','error');
 const role=roleOf();
 if(role==='public'){const st=appState();if(st)st.afterAuth=()=>window.openDataModal(type);window.openLogin?.();return}
 if(!canView('settings',role))return notify(`Role ${role} tidak memiliki izin mengelola Data Center.`,'warn');
 try{
  await window.goView('settings');
  await window.loadDataCenterTable?.(table);
  await window.openNewDataCenterRecord?.();
 }catch(e){notify(e.message||String(e),'error')}
};

window.archiveAwardee=async function(id,name){
 const role=roleOf();
 if(role==='public'){const st=appState();if(st)st.afterAuth=()=>window.archiveAwardee(id,name);window.openLogin?.();return}
 if(!['admin','superadmin'].includes(role))return notify('Pengarsipan Awardee hanya untuk Admin/Superadmin.','warn');
 if(!confirm(`Arsipkan ${name||id}? Data historis tetap disimpan.`))return;
 try{
  window.showLoader?.(true);
  const data=await dcRequest('list',{table:'awardees',search:String(id),limit:500});
  const row=(data?.rows||[]).find(x=>String(x.legacy_id||'').toUpperCase()===String(id||'').toUpperCase()||String(x.id||'')===String(id||''));
  if(!row?.id)throw new Error('Awardee tidak ditemukan di Data Center.');
  await dcRequest('update',{table:'awardees',id:row.id,data:{status:'Arsip'}});
  try{const st=appState();if(st)st.cache={}}catch(_){}
  window.closeDrawer?.();notify('Awardee berhasil diarsipkan.','success');await window.loadDirectory?.(true);
 }catch(e){notify(e.message||String(e),'error')}finally{window.showLoader?.(false)}
};

window.runRuleAnalysis=async function(id){
 const role=roleOf();
 if(role==='public'){const st=appState();if(st)st.afterAuth=()=>window.runRuleAnalysis(id);window.openLogin?.();return}
 if(!['facilitator','admin','superadmin'].includes(role))return notify('Analisis perkembangan hanya untuk Fasilitator/Admin.','warn');
 try{
  window.showLoader?.(true);
  const r=await window.etosAPI?.call?.('getLatestAwardeeRuleAnalysis',{id_awardee:id});
  if(r?.success===false)throw new Error(r.error||'Analisis tidak tersedia.');
  notify(r?.data?'Analisis perkembangan terbaru berhasil dimuat.':'Belum ada analisis perkembangan tersimpan untuk Awardee ini.',r?.data?'success':'warn');
  await window.openAwardee?.(id);
 }catch(e){notify(e.message||String(e),'error')}finally{window.showLoader?.(false)}
};

let lastRealtimeSignalAt=0;
window.addEventListener('etos:realtime-change',()=>{lastRealtimeSignalAt=Date.now()},{passive:true});
function installRefreshGuard(){
 const base=window.refreshCurrent;
 if(typeof base!=='function'||base.__etosRealtimeGuard)return false;
 function guardedRefreshCurrent(){
  if(Date.now()-lastRealtimeSignalAt<1400){
   try{window.dispatchEvent(new CustomEvent('etos:realtime-refresh-suppressed',{detail:{at:Date.now()}}))}catch(_){}
   return;
  }
  return base.apply(this,arguments);
 }
 guardedRefreshCurrent.__etosRealtimeGuard=true;
 guardedRefreshCurrent.__etosOriginal=base;
 window.refreshCurrent=guardedRefreshCurrent;
 return true;
}
installRefreshGuard();
setTimeout(installRefreshGuard,50);
setTimeout(installRefreshGuard,300);

function repairLegacyActions(){
 document.querySelectorAll('.analysis-action').forEach(b=>{if(/Analisis Terbaru/i.test(b.textContent||''))b.title='Muat analisis perkembangan terbaru yang tersimpan'});
 enforceNav();
}
let repairQueued=false;
function queueRepair(){
 if(repairQueued)return;
 repairQueued=true;
 requestAnimationFrame(()=>{repairQueued=false;repairLegacyActions()});
}
function mutationTouchesNavigation(mutations){
 for(const m of mutations){
  for(const n of m.addedNodes||[]){
   if(n?.nodeType!==1)continue;
   if(n.matches?.('.nav-btn[data-view],.analysis-action,#data-center-nav'))return true;
   if(n.querySelector?.('.nav-btn[data-view],.analysis-action,#data-center-nav'))return true;
  }
 }
 return false;
}
const observer=new MutationObserver(mutations=>{
 if(mutationTouchesNavigation(mutations))queueRepair();
});
const navRoot=document.getElementById('sidebar')||document.body;
observer.observe(navRoot,{childList:true,subtree:true});
repairLegacyActions();
setTimeout(rehydrate,80);
window.addEventListener('etos:enhancements-ready',queueRepair,{once:true});
})();
