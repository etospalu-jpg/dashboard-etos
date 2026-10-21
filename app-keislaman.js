/* Pembinaan Keislaman • Tahsin, Kajian, Hafalan | privileged monitoring only. */
(function(){
'use strict';
if(window.ETOS_KEISLAMAN_READY)return;window.ETOS_KEISLAMAN_READY=true;
const $=id=>document.getElementById(id);
const escK=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tab='tahsin',hafalanCohort='2026',initialized=false,cache={};
const pin=()=>{try{return !!(state.auth&&state.session?.kind==='pin')}catch{return false}};
function needPin(){try{state.afterAuth=()=>window.goView('keislaman')}catch(_){}if(typeof window.openPinAccess==='function')window.openPinAccess();else window.openLogin?.()}
const date=v=>v?String(v).slice(0,10):'—';
function paged(rows,render,empty='Belum ada data.'){
 if(!rows?.length)return '<div class="empty">'+escK(empty)+'</div>';
 return '<div class="ki-page">'+rows.map((x,i)=>'<div class="ki-page-row" '+(i>=5?'hidden':'')+'>'+render(x)+'</div>').join('')+(rows.length>5?'<button type="button" class="btn btn-soft ki-show-more" data-ki-more> Lihat Selengkapnya · '+(rows.length-5)+' tersisa</button>':'')+'</div>';
}
function card(title,metric){return '<div class="card-flat p-4"><div class="text-[10px] text-[#70849b]">'+escK(title)+'</div><div class="text-[24px] font-extrabold mt-2">'+escK(metric)+'</div></div>'}
function emptyState(msg){return '<div class="card p-6 text-[#71849b] text-[12px]">'+escK(msg)+'</div>'}
function mount(){
 const root=$('etos-keislaman-root');if(!root||initialized)return;initialized=true;
 root.innerHTML='<div class="mb-5"><div class="eyebrow">PEMBINAAN · ETOS ID PALU</div><h2 class="section-title text-[27px] mt-2">Pembinaan Keislaman</h2><p class="text-[11px] text-[#71849b] mt-2">Satu pusat monitoring. Data Tahsin, Kajian, dan hafalan tetap terpisah dan memiliki sumber masing-masing.</p></div><div class="ki-tabs" role="tablist" aria-label="Jenis pembinaan"><button type="button" class="ki-tab" data-ki-tab="tahsin">Refleksi Tahsin</button><button type="button" class="ki-tab" data-ki-tab="kajian">Refleksi Kajian</button><button type="button" class="ki-tab" data-ki-tab="hafalan">Monitoring Hafalan</button></div><div id="ki-content" aria-live="polite"></div>';
 root.addEventListener('click',event=>{
  const t=event.target.closest('[data-ki-tab]');if(t){tab=t.dataset.kiTab;render();return}
  const cohort=event.target.closest('[data-hafalan-cohort]');if(cohort){hafalanCohort=cohort.dataset.hafalanCohort;render();return}
  const cp=event.target.closest('[data-ki-tahsin-copy]');
  if(cp){const ref=cp.dataset.kiTahsinCopy;if(/^\/t\/[A-F0-9]{12}$/i.test(ref||'')){
   const link=new URL(ref,location.origin).href;if(navigator.clipboard?.writeText){navigator.clipboard.writeText(link).then(()=>{cp.textContent='Link tersalin ✓'}).catch(()=>{window.prompt('Salin link refleksi Tahsin:',link)})}else window.prompt('Salin link refleksi Tahsin:',link);
  }return}
  const b=event.target.closest('[data-ki-more]');if(!b)return;
  const group=b.closest('.ki-page');const elements=[...group.querySelectorAll(':scope > .ki-page-row')],pending=elements.filter(x=>x.hidden);
  if(pending.length)pending.slice(0,5).forEach(x=>x.hidden=false);else elements.forEach((x,i)=>x.hidden=i>=5);
  const remaining=elements.filter(x=>x.hidden).length;b.textContent=remaining?'Lihat Selengkapnya · '+remaining+' tersisa':'Ringkas menjadi 5';b.setAttribute('aria-expanded',String(!remaining));
 });
 root.addEventListener('change',event=>{if(event.target.matches('#ki-kajian-period'))load(true)});
 root.addEventListener('click',event=>{if(event.target.matches('[data-ki-refresh]'))load(true)});
}
async function apiTahsin(){
 const r=await fetch('/api/secure',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({function:'readmapAdmin',params:{action:'tahsinOverview'}})});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Refleksi Tahsin gagal dimuat.');return j;
}
async function apiKajian(){
 const params={};const id=$('ki-kajian-period')?.value;if(id)params.periodeId=id;
 const r=await window.etosAPI.call('getReflectionHub',params);
 if(!r||r.success===false)throw Error(r?.error||'Refleksi Kajian gagal dimuat.');return r.data;
}
const answered=r=>'<details class="ki-answer card-flat p-4"><summary class="font-extrabold text-[11px] cursor-pointer">'+escK(r.nama||r.awardee_name||'Awardee')+' <span class="text-[#71849b] font-normal">· Lihat Jawaban</span></summary><div class="grid md:grid-cols-2 gap-3 mt-4">'+[
 ['Fakta kegiatan',r.faktaKejadian],['Yang membekas',r.membekas],['Perasaan',r.perasaan],['Temuan',r.temuan],['Rencana tindakan',r.rencana],['Dukungan',r.dukungan],['Catatan dukungan',r.catatanDukungan]
 ].map(([k,v])=>'<div><b class="text-[10px]">'+escK(k)+'</b><p class="text-[11px] text-[#617994] mt-1 leading-5">'+escK(v||'—')+'</p></div>').join('')+'</div></details>';
function tahsin(data){
 const sessions=data?.sessions||[],archived=data?.archived||[],responses=data?.responses||[],filled=sessions.reduce((n,x)=>n+Number(x.submitted||0),0);
 const head='<div class="grid sm:grid-cols-3 gap-3 mb-4">'+card('Pertemuan Tahsin',sessions.length)+card('Jawaban Refleksi',responses.length)+card('Pengisian per pertemuan',filled)+'</div>';
 const history=paged(sessions,x=>'<details class="card p-4"><summary class="cursor-pointer"><b class="text-[12px]">'+escK(x.name||'Tahsin')+'</b><div class="text-[10px] text-[#71849b] mt-1">'+escK(date(x.date))+' · '+Number(x.submitted||0)+' dari '+Number(x.attendees||0)+' peserta hadir mengisi</div></summary><div class="mt-4 text-[11px]"><b>Belum mengisi:</b> '+escK((x.missing||[]).join(', ')||'Tidak ada yang tercatat')+'</div>'+( /^\/t\/[A-F0-9]{12}$/i.test(x.link||'')?'<div class="mt-3 pt-3 border-t border-[#dce6f1]"><button type="button" class="btn btn-soft" data-ki-tahsin-copy="'+escK(x.link)+'">Salin Link Refleksi</button><p class="text-[10px] text-[#71849b] mt-2">Link ini berasal dari sesi Absensi yang sama.</p></div>':'')+'</details>','Belum ada pertemuan Tahsin.');
 const answers=paged(responses,x=>'<details class="card-flat p-4"><summary class="cursor-pointer"><b class="text-[12px]">'+escK(x.awardee_name||'Awardee')+'</b><small class="block mt-1 text-[#71849b]">'+escK(date(x.submitted_at))+' · Kepercayaan diri '+escK(x.confidence??'—')+'/5</small></summary><div class="mt-3 text-[11px] space-y-2"><p><b>Pelajaran:</b> '+escK(x.lesson||'—')+'</p><p><b>Tantangan:</b> '+escK((x.challenges||[]).join(', ')||'—')+'</p><p><b>Latihan:</b> '+escK(x.practice_frequency||'—')+'</p><p><b>Target:</b> '+escK(x.improvement_goal||'—')+'</p><p><b>Review target:</b> '+escK(x.previous_goal_review||'—')+'</p></div></details>','Belum ada refleksi Tahsin.');
 return head+'<div class="grid xl:grid-cols-2 gap-4"><section><h3 class="section-title text-[17px] mb-3">Pertemuan & Keterisian</h3>'+history+'</section><section><h3 class="section-title text-[17px] mb-3">Jawaban Lengkap Awardee</h3>'+answers+'</section></div>'+(archived.length?'<details class="card p-5 mt-4"><summary class="cursor-pointer font-extrabold text-[12px]">Arsip Tahsin · '+archived.length+' pertemuan</summary><p class="text-[10px] text-[#71849b] mt-3 mb-3">Tidak dihitung dalam kehadiran dan kewajiban refleksi aktif. Data asli tetap disimpan.</p>'+paged(archived,x=>'<div class="card-flat p-3"><b class="text-[11px]">'+escK(x.name)+'</b><div class="text-[10px] text-[#71849b] mt-1">'+escK(date(x.date))+' · Arsip · '+escK(x.source||'')+'</div></div>')+'</details>':'');
}
function kajian(data){
 const forms=data?.forms||[];const count=forms.reduce((n,x)=>n+(x.responses?.length||0),0);
 const periodOptions=(data?.periods||[]).map(x=>'<option value="'+escK(x.id)+'" '+(String(x.id)===String(data?.period?.id)?'selected':'')+'>'+escK(x.nama||'Periode')+'</option>').join('');
 const head='<div class="flex flex-wrap items-center justify-between gap-3 mb-4"><label class="text-[11px]">Periode <select id="ki-kajian-period" class="input select ml-2">'+periodOptions+'</select></label><button type="button" class="btn btn-soft" data-ki-refresh>Perbarui Data</button></div><div class="grid sm:grid-cols-3 gap-3 mb-4">'+card('Form Kajian',forms.length)+card('Jawaban Refleksi',count)+card('Menunggu Pengisian',forms.reduce((n,x)=>n+Number(x.pendingCount||0),0))+'</div>';
 const content=paged(forms,x=>'<details class="card p-4"><summary class="cursor-pointer"><b class="text-[12px]">'+escK(x.agenda||'Kajian')+'</b><div class="text-[10px] mt-1 text-[#70849b]">'+escK(date(x.tanggal))+' · Hadir '+Number(x.eligibleCount||0)+' · Mengisi '+Number(x.responseCount||0)+' · Belum '+Number(x.pendingCount||0)+'</div></summary><div class="mt-4"><h4 class="text-[11px] font-extrabold mb-2">Jawaban Refleksi</h4>'+paged(x.responses||[],answered,'Belum ada jawaban.')+'</div></details>','Belum ada form Kajian pada periode ini.');
 return head+'<h3 class="section-title text-[17px] mb-3">Refleksi per Kajian</h3>'+content;
}
function hafalan(){
 const switcher='<div class="mb-4 flex gap-2 flex-wrap" role="group" aria-label="Pilih angkatan hafalan"><button type="button" class="btn '+(hafalanCohort==='2026'?'btn-primary':'btn-soft')+'" data-hafalan-cohort="2026">Angkatan 2026 · Kartu Digital</button><button type="button" class="btn '+(hafalanCohort==='2023'?'btn-primary':'btn-soft')+'" data-hafalan-cohort="2023">Angkatan 2023 · Monitoring</button></div>';
 if(hafalanCohort==='2026'){
  setTimeout(()=>{if(tab==='hafalan'&&hafalanCohort==='2026')window.ETOSTahfidz2026?.load()},0);
  return switcher+'<div id="ki-tahfidz-root" aria-live="polite"><div class="card p-6">Memuat kartu kontrol Tahfidz 2026…</div></div>';
 }
 return switcher+'<div class="card p-6 md:p-8"><div class="eyebrow">TAHFIZ · AWARDEE ANGKATAN 2023</div><h3 class="section-title text-[23px] mt-2">Monitoring Hafalan Juz 30</h3><p class="text-[11px] text-[#617994] mt-3">Target penyelesaian 2027 · 9 Awardee angkatan 2023 terdaftar di Dashboard ETOS.</p><div class="grid sm:grid-cols-3 gap-3 mt-5">'+card('Peserta 2023',9)+card('Target',2027)+card('Data terverifikasi','—')+'</div><div class="card-flat p-5 mt-5"><div class="flex gap-3 items-start"><i data-lucide="clock" class="w-5 h-5 text-[#315f96]"></i><div><b class="text-[13px]">Menunggu integrasi Murojaahku</b><p class="text-[11px] text-[#617994] mt-2 leading-6">Pengambilan data Murojaahku (ruang ETOS23) akan dilanjutkan kemudian setelah tersedia akses API baca-saja yang sah. Tidak ada angka hafalan yang diimpor atau dibuat-buat.</p><a class="text-[11px] font-bold text-[#0e43ab] underline mt-3 inline-block" rel="noopener noreferrer" target="_blank" href="https://www.murojaahku.web.id">Buka Murojaahku ↗</a></div></div></div></div>';
}
function render(){
 const root=$('ki-content');if(!root)return;
 document.querySelectorAll('[data-ki-tab]').forEach(el=>{const on=el.dataset.kiTab===tab;el.classList.toggle('active',on);el.setAttribute('aria-selected',String(on))});
 if(!pin()){root.innerHTML=emptyState('Akses PIN Superadmin diperlukan untuk membaca data pembinaan.');return}
 if(tab==='hafalan'){root.innerHTML=hafalan();window.lucide?.createIcons?.();return}
 const kind=tab;
 if(cache[kind]){root.innerHTML=kind==='tahsin'?tahsin(cache[kind]):kajian(cache[kind]);window.lucide?.createIcons?.();return}
 root.innerHTML=emptyState('Memuat data pembinaan…');load(false);
}
async function load(force){
 mount();if(!pin())return needPin();
 const kind=tab;if(kind==='hafalan'){render();return}
 const root=$('ki-content');root.innerHTML=emptyState('Mengambil data pembinaan…');
 try{cache[kind]=kind==='tahsin'?await apiTahsin():await apiKajian();if(tab===kind){root.innerHTML=kind==='tahsin'?tahsin(cache[kind]):kajian(cache[kind]);window.lucide?.createIcons?.()}}
 catch(e){if(tab===kind)root.innerHTML=emptyState('Tidak dapat memuat '+(kind==='tahsin'?'Tahsin':'Kajian')+': '+e.message)}
}
window.loadKeislaman=async function(force=false){mount();if(!pin())return needPin();if(force)cache[tab]=null;render()};
})();