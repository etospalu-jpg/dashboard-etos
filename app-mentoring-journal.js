(function(){
'use strict';
if(window.ETOS_MENTORING_JOURNAL_READY)return;
window.ETOS_MENTORING_JOURNAL_READY=true;

const escJ=v=>typeof window.esc==='function'?window.esc(v):String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let currentCase=null;
let currentCaseName='';

function ensureModal(){
 if(document.getElementById('mentoring-journal-modal'))return;
 const host=document.createElement('div');
 host.id='mentoring-journal-modal';
 host.className='modal';
 host.innerHTML=`<div class="modal-card p-0 max-w-[760px] overflow-hidden">
   <div class="px-6 py-5 border-b border-[#e8eeea] flex items-start justify-between gap-4 bg-white">
     <div><div class="eyebrow">Jurnal Pendampingan</div><h2 id="journal-case-title" class="section-title text-[22px] mt-2">Riwayat Case</h2><p class="text-[10px] text-[#7f8c85] mt-2">Catatan kronologis pendampingan untuk satu case Awardee.</p></div>
     <button class="btn btn-ghost !p-2" type="button" onclick="closeMentoringJournal()"><i data-lucide="x" class="w-4 h-4"></i></button>
   </div>
   <div class="max-h-[82vh] overflow-y-auto p-6">
     <div id="mentoring-journal-list" class="space-y-3"><div class="empty">Memuat jurnal…</div></div>
     <div class="mt-6 pt-6 border-t border-[#e8eeea]">
       <div class="flex items-center justify-between gap-3"><div><div class="eyebrow">Tambah Catatan</div><h3 class="section-title text-[17px] mt-1">Update pendampingan</h3></div><span class="pill pill-green">Operational</span></div>
       <form id="mentoring-journal-form" class="mt-4 space-y-3" onsubmit="saveMentoringJournal(event)">
         <div class="grid sm:grid-cols-2 gap-3"><div><label class="text-[10px] font-bold text-[#718078]">Tanggal sesi</label><input id="journal-date" type="date" class="input mt-1" required></div><div><label class="text-[10px] font-bold text-[#718078]">Status setelah sesi</label><select id="journal-status" class="input select mt-1"><option value="">Tidak berubah</option><option>Open</option><option>Berjalan</option><option>Menunggu Awardee</option><option>Menunggu Fasilitator</option><option>Selesai</option><option>Ditutup</option></select></div></div>
         <div><label class="text-[10px] font-bold text-[#718078]">Catatan perkembangan</label><textarea id="journal-progress" class="input min-h-[100px] mt-1" placeholder="Apa perkembangan utama sejak pendampingan sebelumnya?" required></textarea></div>
         <div class="grid md:grid-cols-2 gap-3"><div><label class="text-[10px] font-bold text-[#718078]">Intervensi / tindakan fasilitator</label><textarea id="journal-intervention" class="input min-h-[90px] mt-1" placeholder="Arahan, intervensi, atau bantuan yang diberikan"></textarea></div><div><label class="text-[10px] font-bold text-[#718078]">Respons Awardee</label><textarea id="journal-response" class="input min-h-[90px] mt-1" placeholder="Respons, komitmen, hambatan, atau insight Awardee"></textarea></div></div>
         <div><label class="text-[10px] font-bold text-[#718078]">Rencana tindak lanjut (RTL)</label><textarea id="journal-followup" class="input min-h-[90px] mt-1" placeholder="Tindak lanjut spesifik setelah sesi"></textarea></div>
         <div><label class="text-[10px] font-bold text-[#718078]">Follow-up berikutnya</label><input id="journal-next" type="date" class="input mt-1"></div>
         <button id="journal-save-btn" class="btn btn-green w-full" type="submit"><i data-lucide="save" class="w-4 h-4"></i>Simpan Jurnal Pendampingan</button>
       </form>
     </div>
   </div>
 </div>`;
 document.body.appendChild(host);
 if(window.lucide)lucide.createIcons();
}

function fmtDate(v){if(!v)return'—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v+'T00:00:00'))}catch(_){return v}}
function statusPill(v){const s=String(v||'').toLowerCase();const cls=/selesai|ditutup|closed|done/.test(s)?'pill-green':/tinggi|overdue/.test(s)?'pill-gold':'pill-gray';return `<span class="pill ${cls}">${escJ(v||'Status tidak berubah')}</span>`}

async function journalRequest(url,options){
 const r=await fetch(url,Object.assign({credentials:'include',headers:{'Content-Type':'application/json'}},options||{}));
 let body={};try{body=await r.json()}catch(_){}
 if(!r.ok||body.success===false)throw new Error(body.error||('HTTP '+r.status));
 return body.data;
}

async function openMentoringJournal(caseId,caseTitle){
 if(!window.state?.auth){if(typeof window.openLogin==='function')openLogin();return}
 ensureModal();currentCase=caseId;currentCaseName=caseTitle||'Case Pendampingan';
 document.getElementById('journal-case-title').textContent=currentCaseName;
 document.getElementById('journal-date').value=new Date().toISOString().slice(0,10);
 document.getElementById('mentoring-journal-list').innerHTML='<div class="empty">Memuat jurnal…</div>';
 openModal('mentoring-journal-modal');
 try{await loadMentoringJournal()}catch(e){document.getElementById('mentoring-journal-list').innerHTML='<div class="empty">'+escJ(e.message)+'</div>'}
}
window.openMentoringJournal=openMentoringJournal;
window.closeMentoringJournal=function(){closeModal('mentoring-journal-modal');currentCase=null};

async function loadMentoringJournal(){
 if(!currentCase)return;
 const rows=await journalRequest('/api/mentoring-journal?case_id='+encodeURIComponent(currentCase));
 const box=document.getElementById('mentoring-journal-list');
 if(!rows?.length){box.innerHTML='<div class="rounded-2xl border border-dashed border-[#dce5e0] bg-[#f8faf9] p-7 text-center"><div class="text-[11px] font-extrabold text-[#56655d]">Belum ada jurnal untuk case ini.</div><div class="text-[10px] text-[#8a968f] mt-2">Tambahkan update pendampingan pertama di bawah.</div></div>';return}
 box.innerHTML=rows.map((x,i)=>`<article class="card-flat p-4">
   <div class="flex flex-wrap items-start justify-between gap-3"><div><div class="text-[9px] uppercase tracking-[.12em] font-extrabold text-[#8b978f]">Sesi ${rows.length-i}</div><div class="text-[12px] font-extrabold mt-1">${escJ(fmtDate(x.session_date))}</div></div>${statusPill(x.status_after)}</div>
   <div class="mt-4"><div class="text-[9px] uppercase tracking-[.11em] font-bold text-[#8b978f]">Perkembangan</div><div class="text-[11px] leading-5 text-[#536159] mt-1 whitespace-pre-wrap">${escJ(x.progress_note||'—')}</div></div>
   ${x.intervention?`<div class="mt-3"><div class="text-[9px] uppercase tracking-[.11em] font-bold text-[#8b978f]">Intervensi</div><div class="text-[11px] leading-5 text-[#536159] mt-1 whitespace-pre-wrap">${escJ(x.intervention)}</div></div>`:''}
   ${x.awardee_response?`<div class="mt-3"><div class="text-[9px] uppercase tracking-[.11em] font-bold text-[#8b978f]">Respons Awardee</div><div class="text-[11px] leading-5 text-[#536159] mt-1 whitespace-pre-wrap">${escJ(x.awardee_response)}</div></div>`:''}
   ${x.follow_up_plan?`<div class="mt-3 rounded-xl bg-white border border-[#e6ece8] p-3"><div class="text-[9px] uppercase tracking-[.11em] font-bold text-[#0f6248]">RTL</div><div class="text-[11px] leading-5 text-[#536159] mt-1 whitespace-pre-wrap">${escJ(x.follow_up_plan)}</div>${x.next_follow_up?`<div class="text-[9px] font-bold text-[#8a968f] mt-2">Follow-up: ${escJ(fmtDate(x.next_follow_up))}</div>`:''}</div>`:''}
 </article>`).join('');
}

window.saveMentoringJournal=async function(e){
 e.preventDefault();if(!currentCase)return;
 const btn=document.getElementById('journal-save-btn');btn.disabled=true;btn.textContent='Menyimpan…';
 const payload={case_id:currentCase,session_date:document.getElementById('journal-date').value,progress_note:document.getElementById('journal-progress').value,intervention:document.getElementById('journal-intervention').value,awardee_response:document.getElementById('journal-response').value,follow_up_plan:document.getElementById('journal-followup').value,next_follow_up:document.getElementById('journal-next').value,status_after:document.getElementById('journal-status').value};
 try{
   await journalRequest('/api/mentoring-journal',{method:'POST',body:JSON.stringify(payload)});
   ['journal-progress','journal-intervention','journal-response','journal-followup','journal-next'].forEach(id=>document.getElementById(id).value='');document.getElementById('journal-status').value='';
   if(window.state)state.cache={};await loadMentoringJournal();if(typeof window.loadMentoring==='function')await window.loadMentoring(true);if(typeof window.toast==='function')toast('Jurnal pendampingan berhasil disimpan.');
 }catch(err){if(typeof window.toast==='function')toast(err.message,'error');else alert(err.message)}finally{btn.disabled=false;btn.innerHTML='<i data-lucide="save" class="w-4 h-4"></i>Simpan Jurnal Pendampingan';if(window.lucide)lucide.createIcons()}
};

const original=window.loadMentoring;
if(typeof original==='function'){
 window.loadMentoring=async function(force=false){
  const rows=await api('getMentoringCases',{},force);const arr=Array.isArray(rows)?rows:(rows?.items||[]);const open=arr.filter(x=>!['selesai','closed','done','ditutup'].includes(String(x.status||'').toLowerCase())),high=open.filter(x=>String(x.prioritas||x.priority||'').toLowerCase()==='tinggi'),over=open.filter(x=>x.deadline&&new Date(x.deadline+'T23:59:59')<new Date());
  const kpi=document.getElementById('mentoring-kpis');if(kpi)kpi.innerHTML=[['Total Case',arr.length],['Case Terbuka',open.length],['Prioritas Tinggi',high.length],['Lewat Deadline',over.length]].map(([l,v])=>`<div class="card-flat p-4"><div class="text-[9px] uppercase tracking-[.12em] font-bold text-[#88958e]">${l}</div><div class="metric-number text-[25px] font-extrabold mt-2">${v}</div></div>`).join('');
  const body=document.getElementById('mentoring-body');if(body)body.innerHTML=arr.length?arr.map(x=>`<tr><td class="font-semibold">${escJ(x.nama||'—')}</td><td><div class="font-semibold">${escJ(x.judul||x.title||'—')}</div>${x.aksi?`<div class="text-[9px] text-[#8a968f] mt-1 max-w-[260px] truncate">${escJ(x.aksi)}</div>`:''}</td><td>${escJ(x.kategori||x.category||'—')}</td><td><span class="pill ${String(x.prioritas||x.priority).toLowerCase()==='tinggi'?'pill-gold':'pill-gray'}">${escJ(x.prioritas||x.priority||'—')}</span></td><td>${escJ(x.deadline||'—')}</td><td><div class="flex flex-col items-start gap-2"><span>${escJ(x.status||'—')}</span><button type="button" class="btn btn-ghost !px-2.5 !py-1.5 text-[9px]" onclick='openMentoringJournal(${JSON.stringify(String(x.id||''))},${JSON.stringify(String(x.judul||x.title||'Case Pendampingan'))})'><i data-lucide="notebook-pen" class="w-3.5 h-3.5"></i>Jurnal</button></div></td></tr>`).join(''):'<tr><td colspan="6" class="empty">Belum ada case pendampingan.</td></tr>';
  if(window.lucide)lucide.createIcons();return arr;
 };
}

function relabel(){
 const view=document.getElementById('view-mentoring');if(!view)return;
 const h=view.querySelector('h2');if(h&&h.textContent.trim()==='Mentoring Command')h.textContent='Pendampingan & Jurnal';
 const eye=view.querySelector('.eyebrow');if(eye)eye.textContent='Pendampingan Command Center';
 const nav=document.querySelector('.nav-btn[data-view="mentoring"]');if(nav){const icon=nav.querySelector('i');nav.childNodes.forEach(n=>{if(n.nodeType===Node.TEXT_NODE&&n.textContent.includes('Mentoring Command'))n.textContent='Pendampingan & Jurnal'});if(icon)icon.setAttribute('data-lucide','notebook-pen')}
}
ensureModal();relabel();if(window.lucide)lucide.createIcons();
})();
