(function(){
'use strict';
if(window.ETOS_FACILITATOR_INTELLIGENCE)return;window.ETOS_FACILITATOR_INTELLIGENCE='v1';
const e=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let insightData=null,reflectionData=null,insightLoading=false,reflectionLoading=false;
function pin(){try{return state?.session?.kind==='pin'}catch{return false}}
function gate(next){try{state.afterAuth=next}catch(_){}if(typeof window.openPinAccess==='function')window.openPinAccess();else window.openLogin?.()}
function fmt(v){if(!v)return'—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(String(v).slice(0,10)+'T00:00:00+08:00'))}catch{return v}}
async function call(fn,params={}){const r=await window.etosAPI.call(fn,params);if(!r||r.success===false)throw new Error(r?.error||'Data fasilitator gagal dimuat.');return r.data}
function bars(items){
 const arr=items||[],max=Math.max(1,...arr.map(x=>Number(x.count)||0));
 if(!arr.length)return'<div class="empty">Belum ada data yang cukup.</div>';
 return'<div class="space-y-3">'+arr.map(x=>'<div><div class="flex items-center justify-between gap-3 text-[10px]"><span class="font-bold">'+e(x.name)+'</span><b>'+Number(x.count||0)+'</b></div><div class="h-2 rounded-full bg-[#edf1ef] mt-2 overflow-hidden"><div class="h-full rounded-full bg-[#0f6248]" style="width:'+Math.max(7,Math.round((Number(x.count)||0)/max*100))+'%"></div></div></div>').join('')+'</div>';
}
function ensureDashboard(){
 const view=document.getElementById('view-dashboard');if(!view||document.getElementById('facilitator-insight-card'))return;
 const box=document.createElement('section');box.id='facilitator-insight-card';box.className='card p-5 md:p-6 mb-5';
 const last=view.lastElementChild;view.insertBefore(box,last||null);renderDashboardGate();
}
function renderDashboardGate(){
 const box=document.getElementById('facilitator-insight-card');if(!box)return;
 if(!pin()){
  box.innerHTML='<div class="flex flex-col md:flex-row md:items-center justify-between gap-4"><div class="flex items-start gap-3"><div class="w-11 h-11 rounded-xl bg-[#e8f1ed] text-[#0f6248] flex items-center justify-center shrink-0"><i data-lucide="lock-keyhole" class="w-5 h-5"></i></div><div><div class="eyebrow">Insight Pembinaan</div><h3 class="section-title text-[19px] mt-2">Coaching & Refleksi Fasilitator</h3><p class="text-[10px] text-[#7d8a83] mt-2 max-w-xl">Topik coaching, pola temuan refleksi, dan detail sumber hanya dapat dibuka dengan PIN fasilitator.</p></div></div><button class="btn btn-primary" onclick="openFacilitatorInsights()"><i data-lucide="key-round" class="w-4 h-4"></i>Buka Insight</button></div>';window.lucide?.createIcons?.();return;
 }
 if(!insightData){
  box.innerHTML='<div class="flex items-center justify-between gap-3"><div><div class="eyebrow">Insight Pembinaan</div><h3 class="section-title text-[19px] mt-2">Memuat insight fasilitator…</h3></div><span class="pill pill-green">PIN aktif</span></div><div class="empty mt-4">Mengolah topik coaching dan tema refleksi dari data tersimpan.</div>';
  window.loadFacilitatorInsights(false).catch(()=>{});return;
 }
 renderInsights(insightData);
}
function renderInsights(data){
 const box=document.getElementById('facilitator-insight-card');if(!box)return;
 const c=data?.coaching||{},r=data?.reflections||{};
 box.innerHTML=`<div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5"><div><div class="eyebrow">Insight Pembinaan · PIN</div><h3 class="section-title text-[20px] mt-2">Pola Coaching & Refleksi</h3><p class="text-[10px] text-[#7d8a83] mt-2">Ringkasan otomatis berbasis kata/tema pada data tersimpan; bukan diagnosis atau penilaian Awardee.</p></div><button class="btn btn-soft" onclick="openFacilitatorInsightDetail()"><i data-lucide="list-tree" class="w-4 h-4"></i>Lihat Detail Sumber</button></div>
 <div class="grid xl:grid-cols-2 gap-4">
  <div class="card-flat p-5"><div class="flex items-center justify-between gap-3"><div><div class="eyebrow">Coaching</div><div class="text-[13px] font-extrabold mt-2">Topik Coaching Terbanyak</div></div><span class="pill pill-gray">${Number(c.total||0)} catatan</span></div><div class="mt-5">${bars(c.themes)}</div></div>
  <div class="card-flat p-5"><div class="flex items-center justify-between gap-3"><div><div class="eyebrow">Refleksi</div><div class="text-[13px] font-extrabold mt-2">Tema Temuan Terbanyak</div></div><span class="pill pill-gray">${Number(r.total||0)} jawaban</span></div><div class="mt-5">${bars(r.themes)}</div></div>
 </div>`;
 window.lucide?.createIcons?.();
}
window.loadFacilitatorInsights=async function(force=false){
 ensureDashboard();if(!pin())return gate(()=>window.loadFacilitatorInsights(true));if(insightLoading&&!force)return insightData;insightLoading=true;
 try{insightData=await call('getFacilitatorInsights',{});renderInsights(insightData);return insightData}
 catch(err){const box=document.getElementById('facilitator-insight-card');if(box)box.innerHTML='<div class="empty">'+e(err.message||String(err))+'</div>';throw err}
 finally{insightLoading=false}
};
window.openFacilitatorInsights=function(){if(!pin())return gate(()=>window.openFacilitatorInsights());ensureDashboard();return window.loadFacilitatorInsights(false)};
function ensureInsightModal(){
 if(document.getElementById('facilitator-insight-modal'))return;
 const d=document.createElement('div');d.id='facilitator-insight-modal';d.className='modal';d.innerHTML='<div class="modal-card p-0 max-w-[980px] overflow-hidden"><div class="p-5 md:p-6 border-b border-[#e8eeea] flex items-start justify-between gap-4"><div><div class="eyebrow">Fasilitator · PIN</div><h3 class="section-title text-[21px] mt-2">Sumber Insight Pembinaan</h3></div><button class="btn btn-ghost !p-2" onclick="closeModal(\'facilitator-insight-modal\')"><i data-lucide="x" class="w-4 h-4"></i></button></div><div id="facilitator-insight-detail" class="p-5 md:p-6 max-h-[72vh] overflow-auto"></div></div>';document.body.appendChild(d)
}
window.openFacilitatorInsightDetail=async function(){
 if(!pin())return gate(()=>window.openFacilitatorInsightDetail());ensureInsightModal();if(!insightData)await window.loadFacilitatorInsights(true);
 const root=document.getElementById('facilitator-insight-detail'),c=insightData?.coaching?.items||[],r=insightData?.reflections?.items||[];
 root.innerHTML=`<div class="grid xl:grid-cols-2 gap-4"><section><div class="eyebrow">Coaching</div><div class="space-y-2 mt-3">${c.length?c.map(x=>'<div class="card-flat p-3"><div class="flex justify-between gap-2"><b class="text-[10px]">'+e(x.nama||'—')+'</b><span class="text-[9px] text-[#849189]">'+e(fmt(x.tanggal))+'</span></div><div class="text-[9px] mt-2"><span class="pill pill-gray">'+e(x.theme||'Lainnya')+'</span></div><div class="text-[10px] leading-5 mt-2">'+e(x.topik||'—')+'</div></div>').join(''):'<div class="empty">Belum ada catatan coaching.</div>'}</div></section><section><div class="eyebrow">Refleksi</div><div class="space-y-2 mt-3">${r.length?r.map(x=>'<div class="card-flat p-3"><div class="flex justify-between gap-2"><b class="text-[10px]">'+e(x.nama||'—')+'</b><span class="text-[9px] text-[#849189]">'+e(fmt(x.tanggal))+'</span></div><div class="text-[9px] mt-2"><span class="pill pill-gray">'+e(x.theme||'Lainnya')+'</span></div><div class="text-[10px] leading-5 mt-2">'+e(x.temuan||'—')+'</div></div>').join(''):'<div class="empty">Belum ada refleksi.</div>'}</div></section></div>`;
 openModal('facilitator-insight-modal');window.lucide?.createIcons?.();
};

function ensureReflectionPanel(){
 const view=document.getElementById('view-attendance');if(!view||document.getElementById('reflection-hub-panel'))return;
 const panel=document.createElement('section');panel.id='reflection-hub-panel';panel.className='mt-4 hidden';
 panel.innerHTML=`<div class="card overflow-hidden"><div class="p-5 md:p-6 border-b border-[#e8eeea]"><div class="flex flex-col xl:flex-row xl:items-end justify-between gap-4"><div><div class="eyebrow">Fasilitator · PIN</div><h3 class="section-title text-[20px] mt-2">Refleksi Kajian</h3><p class="text-[10px] text-[#7b8981] mt-2">Lihat keterisian dan jawaban refleksi berdasarkan agenda kajian.</p></div><button class="btn btn-soft" onclick="closeReflectionHub()"><i data-lucide="x" class="w-4 h-4"></i>Tutup</button></div><div class="grid sm:grid-cols-3 gap-3 mt-5"><label><span class="text-[9px] uppercase tracking-[.1em] font-bold text-[#7f8c84]">Periode</span><select id="reflection-hub-period" class="input select mt-2"></select></label><label><span class="text-[9px] uppercase tracking-[.1em] font-bold text-[#7f8c84]">Dari Tanggal</span><input id="reflection-hub-from" type="date" class="input mt-2"></label><label><span class="text-[9px] uppercase tracking-[.1em] font-bold text-[#7f8c84]">Sampai Tanggal</span><input id="reflection-hub-to" type="date" class="input mt-2"></label></div><div class="flex flex-wrap justify-end gap-2 mt-3"><button class="btn btn-soft" onclick="reflectionHubThisMonth()">Bulan Ini</button><button class="btn btn-soft" onclick="reflectionHubAll()">Seluruh Periode</button><button class="btn btn-primary" onclick="loadReflectionHub(true)">Tampilkan</button></div></div><div id="reflection-hub-content" class="p-4 md:p-5"><div class="empty">Pilih cakupan untuk melihat refleksi.</div></div></div>`;
 view.appendChild(panel);window.lucide?.createIcons?.();
}
function reflectionParams(){return{periodeId:document.getElementById('reflection-hub-period')?.value||null,from:document.getElementById('reflection-hub-from')?.value||null,to:document.getElementById('reflection-hub-to')?.value||null}}
function fillReflectionPeriods(data){
 const el=document.getElementById('reflection-hub-period');if(!el)return;const cur=el.value||data?.period?.id||'';
 el.innerHTML=(data?.periods||[]).map(x=>'<option value="'+e(x.id)+'">'+e(x.nama||x.id)+(String(x.status||'').toLowerCase()==='aktif'?' • Aktif':'')+'</option>').join('');
 if([...el.options].some(o=>o.value===cur))el.value=cur;
}
function renderReflectionHub(data){
 reflectionData=data;fillReflectionPeriods(data);const root=document.getElementById('reflection-hub-content'),forms=data?.forms||[];if(!root)return;
 if(!forms.length){root.innerHTML='<div class="empty">Belum ada form refleksi pada cakupan ini.</div>';return}
 root.innerHTML='<div class="space-y-3">'+forms.map(f=>`<details class="card-flat overflow-hidden"><summary class="p-4 md:p-5 cursor-pointer list-none"><div class="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><div class="text-[12px] font-extrabold">${e(f.agenda||'Kajian')}</div><div class="text-[9px] text-[#849189] mt-1">${e(fmt(f.tanggal))} · Target ${e(f.target||'Umum')}</div></div><div class="flex flex-wrap gap-2"><span class="pill pill-green">Hadir ${Number(f.eligibleCount||0)}</span><span class="pill pill-gray">Mengisi ${Number(f.responseCount||0)}</span><span class="pill ${Number(f.pendingCount||0)?'pill-gold':'pill-green'}">Belum ${Number(f.pendingCount||0)}</span><span class="pill pill-gray">Klik detail</span></div></div></summary><div class="p-4 md:p-5 border-t border-[#e8eeea] space-y-3">${(f.responses||[]).length?(f.responses||[]).map(r=>`<details class="card p-4"><summary class="cursor-pointer list-none flex items-center justify-between gap-3"><div><b class="text-[11px]">${e(r.nama)}</b><div class="text-[9px] text-[#87948d] mt-1">Angkatan ${e(r.angkatan||'—')}</div></div><span class="pill pill-gray">Lihat jawaban</span></summary><div class="grid md:grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#edf1ef] text-[10px] leading-5"><div><b>Fakta kejadian</b><p class="text-[#65736b] mt-1">${e(r.faktaKejadian||'—')}</p></div><div><b>Bagian membekas</b><p class="text-[#65736b] mt-1">${e(r.membekas||'—')}</p></div><div><b>Perasaan</b><p class="text-[#65736b] mt-1">${e(r.perasaan||'—')}</p></div><div><b>Temuan/kesadaran</b><p class="text-[#65736b] mt-1">${e(r.temuan||'—')}</p></div><div><b>Rencana tindakan</b><p class="text-[#65736b] mt-1">${e(r.rencana||'—')}</p></div><div><b>Dukungan</b><p class="text-[#65736b] mt-1">${e(r.dukungan||'—')}</p></div></div></details>`).join(''):'<div class="empty">Belum ada jawaban masuk.</div>'}</div></details>`).join('')+'</div>';
}
window.loadReflectionHub=async function(force=false){
 ensureReflectionPanel();if(!pin())return gate(()=>window.loadReflectionHub(true));if(reflectionLoading&&!force)return reflectionData;reflectionLoading=true;
 const root=document.getElementById('reflection-hub-content');if(root)root.innerHTML='<div class="empty">Memuat refleksi…</div>';
 try{const data=await call('getReflectionHub',reflectionParams());renderReflectionHub(data);return data}catch(err){if(root)root.innerHTML='<div class="empty">'+e(err.message||String(err))+'</div>';throw err}finally{reflectionLoading=false;window.lucide?.createIcons?.()}
};
window.openReflectionHub=function(){ensureReflectionPanel();if(!pin())return gate(()=>window.openReflectionHub());document.getElementById('reflection-hub-panel')?.classList.remove('hidden');document.getElementById('reflection-hub-panel')?.scrollIntoView({behavior:'smooth',block:'start'});if(!reflectionData)window.loadReflectionHub(true).catch(()=>{})};
window.closeReflectionHub=function(){document.getElementById('reflection-hub-panel')?.classList.add('hidden')};
window.reflectionHubAll=function(){document.getElementById('reflection-hub-from').value='';document.getElementById('reflection-hub-to').value='';window.loadReflectionHub(true)};
window.reflectionHubThisMonth=function(){const d=new Date(),y=d.getFullYear(),m=d.getMonth(),pad=n=>String(n).padStart(2,'0');document.getElementById('reflection-hub-from').value=y+'-'+pad(m+1)+'-01';document.getElementById('reflection-hub-to').value=y+'-'+pad(m+1)+'-'+pad(new Date(y,m+1,0).getDate());window.loadReflectionHub(true)};

function install(){
 ensureDashboard();ensureReflectionPanel();
 const base=window.loadDashboard;
 if(typeof base==='function'&&!base.__facInsight){
  const wrapped=async function(){const x=await base.apply(this,arguments);ensureDashboard();renderDashboardGate();return x};wrapped.__facInsight=true;window.loadDashboard=wrapped;
 }
 setTimeout(()=>{renderDashboardGate()},50);
}
window.addEventListener('etos:enhancements-ready',install);
install();
})();