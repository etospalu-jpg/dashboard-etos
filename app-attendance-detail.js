(function(){
'use strict';
if(window.ETOS_ATTENDANCE_DETAIL_READY)return;window.ETOS_ATTENDANCE_DETAIL_READY='v2';
const e=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let detailData=null,loading=false,xlsxPromise=null;
function fmt(v){if(!v)return'—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(String(v).slice(0,10)+'T00:00:00+08:00'))}catch{return v}}
function pin(){return window.state?.session?.kind==='pin'||state?.session?.kind==='pin'}
function needPin(next){
 try{state.afterAuth=next}catch(_){}
 if(typeof window.openPinAccess==='function')window.openPinAccess();else window.openLogin?.();
}
function ensureActions(){
 const view=document.getElementById('view-attendance');if(!view||document.getElementById('attendance-private-actions'))return;
 const x=document.createElement('div');x.id='attendance-private-actions';x.className='grid md:grid-cols-3 gap-3 mt-4';
 x.innerHTML=`
 <button class="card p-5 text-left hover:border-[#9bb9aa] transition" onclick="openAttendanceDetail()">
  <div class="flex items-start gap-3"><div class="w-10 h-10 rounded-xl bg-[#e8f1ed] text-[#0f6248] flex items-center justify-center"><i data-lucide="table-properties" class="w-4 h-4"></i></div>
  <div><div class="text-[11px] font-extrabold">Lihat Detail Absensi</div><div class="text-[9px] text-[#849189] mt-1 leading-4">Peserta per agenda, filter tanggal/bulan/periode, dan export Excel.</div></div><i data-lucide="lock-keyhole" class="w-4 h-4 ml-auto text-[#849189]"></i></div>
 </button>
 <button class="card p-5 text-left hover:border-[#9bb9aa] transition" onclick="openReflectionHub()">
  <div class="flex items-start gap-3"><div class="w-10 h-10 rounded-xl bg-[#f2eee6] text-[#8b7047] flex items-center justify-center"><i data-lucide="message-square-text" class="w-4 h-4"></i></div>
  <div><div class="text-[11px] font-extrabold">Lihat Refleksi Kajian</div><div class="text-[9px] text-[#849189] mt-1 leading-4">Jawaban refleksi per agenda dan temuan fasilitator.</div></div><i data-lucide="lock-keyhole" class="w-4 h-4 ml-auto text-[#849189]"></i></div>
 </button>
 <button class="card p-5 text-left hover:border-[#9bb9aa] transition" onclick="openEmailCenter()">
  <div class="flex items-start gap-3"><div class="w-10 h-10 rounded-xl bg-[#eaf0f7] text-[#31577d] flex items-center justify-center"><i data-lucide="mail-plus" class="w-4 h-4"></i></div>
  <div><div class="text-[11px] font-extrabold">Kirim Email / Reminder</div><div class="text-[9px] text-[#849189] mt-1 leading-4">Agenda, refleksi, laporan, atau pesan ke Awardee.</div></div><i data-lucide="lock-keyhole" class="w-4 h-4 ml-auto text-[#849189]"></i></div>
 </button>`;
 view.appendChild(x);window.lucide?.createIcons?.();
}
function ensurePanel(){
 const view=document.getElementById('view-attendance');if(!view||document.getElementById('attendance-detail-panel'))return;
 const panel=document.createElement('section');panel.id='attendance-detail-panel';panel.className='mt-4 hidden';
 panel.innerHTML=`
 <div class="card overflow-hidden">
  <div class="p-5 md:p-6 border-b border-[#e8eeea]">
   <div class="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
    <div><div class="eyebrow">Fasilitator · PIN</div><h3 class="section-title text-[20px] mt-2">Detail Absensi</h3><p class="text-[10px] text-[#7b8981] mt-2">Pilih cakupan data. Peserta per agenda baru terbuka ketika agenda diklik.</p></div>
    <div class="flex flex-wrap gap-2"><button class="btn btn-soft" type="button" onclick="closeAttendanceDetail()"><i data-lucide="x" class="w-4 h-4"></i>Tutup</button><button class="btn btn-green" type="button" onclick="downloadAttendanceExcel()"><i data-lucide="download" class="w-4 h-4"></i>Download Excel</button></div>
   </div>
   <div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
    <label><span class="text-[9px] uppercase tracking-[.1em] font-bold text-[#7f8c84]">Periode Pembinaan</span><select id="attendance-detail-period" class="input select mt-2"></select></label>
    <label><span class="text-[9px] uppercase tracking-[.1em] font-bold text-[#7f8c84]">Tampilkan</span><select id="attendance-detail-mode" class="input select mt-2" onchange="attendanceDetailModeChanged()"><option value="period">Satu Periode</option><option value="month">Bulan Tertentu</option><option value="date">Tanggal Tertentu</option><option value="range">Rentang Tanggal</option></select></label>
    <label id="attendance-detail-month-wrap" class="hidden"><span class="text-[9px] uppercase tracking-[.1em] font-bold text-[#7f8c84]">Bulan</span><input id="attendance-detail-month" type="month" class="input mt-2"></label>
    <label id="attendance-detail-date-wrap" class="hidden"><span class="text-[9px] uppercase tracking-[.1em] font-bold text-[#7f8c84]">Tanggal</span><input id="attendance-detail-date" type="date" class="input mt-2"></label>
    <label id="attendance-detail-from-wrap" class="hidden"><span class="text-[9px] uppercase tracking-[.1em] font-bold text-[#7f8c84]">Dari</span><input id="attendance-detail-from" type="date" class="input mt-2"></label>
    <label id="attendance-detail-to-wrap" class="hidden"><span class="text-[9px] uppercase tracking-[.1em] font-bold text-[#7f8c84]">Sampai</span><input id="attendance-detail-to" type="date" class="input mt-2"></label>
   </div>
   <div class="flex justify-end mt-3"><button class="btn btn-primary" type="button" onclick="loadAttendanceDetail(true)"><i data-lucide="search" class="w-4 h-4"></i>Tampilkan</button></div>
  </div>
  <div id="attendance-detail-content" class="p-4 md:p-5"><div class="empty">Pilih cakupan lalu tampilkan detail.</div></div>
 </div>`;
 view.appendChild(panel);window.lucide?.createIcons?.();
}
window.attendanceDetailModeChanged=function(){
 const mode=document.getElementById('attendance-detail-mode')?.value||'period';
 for(const id of ['month','date','from','to'])document.getElementById('attendance-detail-'+id+'-wrap')?.classList.add('hidden');
 if(mode==='month')document.getElementById('attendance-detail-month-wrap')?.classList.remove('hidden');
 if(mode==='date')document.getElementById('attendance-detail-date-wrap')?.classList.remove('hidden');
 if(mode==='range'){document.getElementById('attendance-detail-from-wrap')?.classList.remove('hidden');document.getElementById('attendance-detail-to-wrap')?.classList.remove('hidden')}
};
function currentParams(){
 const mode=document.getElementById('attendance-detail-mode')?.value||'period';
 let from=null,to=null;
 if(mode==='month'){
  const m=document.getElementById('attendance-detail-month')?.value||'';
  if(m){const [y,mo]=m.split('-').map(Number);from=m+'-01';to=y+'-'+String(mo).padStart(2,'0')+'-'+String(new Date(y,mo,0).getDate()).padStart(2,'0')}
 }else if(mode==='date'){
  from=to=document.getElementById('attendance-detail-date')?.value||null;
 }else if(mode==='range'){
  from=document.getElementById('attendance-detail-from')?.value||null;to=document.getElementById('attendance-detail-to')?.value||null;
 }
 return{periodeId:document.getElementById('attendance-detail-period')?.value||document.getElementById('attendance-period')?.value||null,from,to};
}
function periodOptions(periods,selected){
 const el=document.getElementById('attendance-detail-period');if(!el)return;
 const cur=el.value||selected?.id||'';
 el.innerHTML=(periods||[]).map(p=>`<option value="${e(p.id)}">${e(p.nama||p.id)}${String(p.status||'').toLowerCase()==='aktif'?' • Aktif':''}</option>`).join('');
 if([...el.options].some(o=>o.value===cur))el.value=cur;else if(selected?.id)el.value=selected.id;
}
function badge(v){const s=String(v||'').toLowerCase(),cl=s==='hadir'?'pill-green':s==='izin'||s==='sakit'?'pill-gold':'pill-gray';return`<span class="pill ${cl}">${e(v||'—')}</span>`}
function render(data){
 detailData=data||{sessions:[]};periodOptions(detailData.periods,detailData.selectedPeriod);
 const root=document.getElementById('attendance-detail-content'),sessions=detailData.sessions||[];if(!root)return;
 if(!sessions.length){root.innerHTML='<div class="empty">Belum ada sesi absensi pada cakupan ini.</div>';return}
 root.innerHTML=`<div class="space-y-3">${sessions.map(s=>`
  <details class="card-flat overflow-hidden">
   <summary class="p-4 md:p-5 cursor-pointer list-none flex flex-col md:flex-row md:items-center justify-between gap-3">
    <div><div class="text-[12px] font-extrabold">${e(s.nama||'Agenda')}</div><div class="text-[9px] text-[#849189] mt-1">${e(fmt(s.tanggal))} · Target ${e(s.target||'Umum')}</div></div>
    <div class="flex flex-wrap gap-2"><span class="pill pill-green">Hadir ${Number(s.hadir)||0}</span><span class="pill pill-gray">Izin ${Number(s.izin)||0}</span><span class="pill pill-gold">Sakit ${Number(s.sakit)||0}</span><span class="pill pill-gray">Alpa ${Number(s.alpa)||0}</span><span class="pill pill-gray">Klik detail</span></div>
   </summary>
   <div class="border-t border-[#e8eeea] p-3 flex justify-end"><button type="button" class="btn btn-soft" onclick="event.stopPropagation();openEmailCenter(JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify({name:'Email '+(s.nama||'Agenda'),audienceType:'attendance_status',filter:{sessionId:s.id,statuses:['Hadir']},context:{agenda:s.nama||'',tanggal:s.tanggal||''}}))}')))"><i data-lucide="mail-plus" class="w-4 h-4"></i>Email Peserta Hadir</button></div>
   <div class="table-wrap border-t border-[#e8eeea]"><table class="data-table"><thead><tr><th>Awardee</th><th>Angkatan</th><th>Status</th></tr></thead><tbody>${(s.records||[]).map(r=>`<tr><td><div class="font-semibold">${e(r.nama)}</div><div class="text-[9px] text-[#8a968f] mt-1">${e(r.id||'')}</div></td><td>${e(r.angkatan||'—')}</td><td>${badge(r.status)}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">Belum ada peserta.</td></tr>'}</tbody></table></div>
  </details>`).join('')}</div>`;
}
async function fetchDetail(){
 if(!pin())throw new Error('PIN fasilitator diperlukan untuk detail absensi.');
 const r=await window.etosAPI.call('getAttendanceDetail',currentParams());if(!r||r.success===false)throw new Error(r?.error||'Detail absensi gagal dimuat.');return r.data;
}
window.openAttendanceDetail=function(){
 ensureActions();ensurePanel();
 if(!pin())return needPin(()=>window.openAttendanceDetail());
 document.getElementById('attendance-detail-panel')?.classList.remove('hidden');
 document.getElementById('attendance-detail-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
 if(!detailData)window.loadAttendanceDetail(true).catch(()=>{});
};
window.closeAttendanceDetail=function(){document.getElementById('attendance-detail-panel')?.classList.add('hidden')};
window.loadAttendanceDetail=async function(force=false){
 ensurePanel();if(!pin())return needPin(()=>window.loadAttendanceDetail(true));if(loading&&!force)return detailData;loading=true;
 const root=document.getElementById('attendance-detail-content');if(root)root.innerHTML='<div class="empty">Memuat detail absensi…</div>';
 try{const data=await fetchDetail();render(data);return data}catch(err){if(root)root.innerHTML=`<div class="empty">${e(err?.message||String(err))}</div>`;throw err}finally{loading=false;window.lucide?.createIcons?.()}
};
function ensureXLSX(){if(window.XLSX)return Promise.resolve(window.XLSX);if(xlsxPromise)return xlsxPromise;xlsxPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.async=true;s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Library Excel tidak tersedia.'));s.onerror=()=>reject(new Error('Library Excel gagal dimuat.'));document.head.appendChild(s)}).finally(()=>{if(!window.XLSX)xlsxPromise=null});return xlsxPromise}
function exportRows(data){
 const detail=[],sessions=[],recap=new Map();
 for(const s of data?.sessions||[]){
  sessions.push({Tanggal:s.tanggal,Agenda:s.nama,Target:s.target,Hadir:s.hadir,Izin:s.izin,Sakit:s.sakit,Alpa:s.alpa,Total:s.total});
  for(const r of s.records||[]){
   detail.push({Tanggal:s.tanggal,Agenda:s.nama,'ID Awardee':r.id,Nama:r.nama,Angkatan:r.angkatan,Status:r.status});
   const k=r.id||r.nama;if(!recap.has(k))recap.set(k,{'ID Awardee':r.id,Nama:r.nama,Angkatan:r.angkatan,Hadir:0,Izin:0,Sakit:0,Alpa:0,'Belum Dicatat':0,'Total Tercatat':0,'Kehadiran (%)':0});
   const x=recap.get(k),st=String(r.status||'').toLowerCase();if(st==='hadir')x.Hadir++;else if(st==='izin')x.Izin++;else if(st==='sakit')x.Sakit++;else if(st==='alpa')x.Alpa++;else x['Belum Dicatat']++;if(['hadir','izin','sakit','alpa'].includes(st))x['Total Tercatat']++;
  }
 }
 for(const x of recap.values())x['Kehadiran (%)']=x['Total Tercatat']?Math.round(x.Hadir/x['Total Tercatat']*100):0;
 return{detail,sessions,recap:[...recap.values()]};
}
window.downloadAttendanceExcel=async function(){
 if(!pin())return needPin(()=>window.downloadAttendanceExcel());
 try{
  window.showLoader?.(true);const data=await fetchDetail();render(data);if(!(data?.sessions||[]).length)throw new Error('Tidak ada data absensi pada cakupan yang dipilih.');
  const XLSX=await ensureXLSX(),rows=exportRows(data),wb=XLSX.utils.book_new();
  const a=XLSX.utils.json_to_sheet(rows.recap),b=XLSX.utils.json_to_sheet(rows.sessions),d=XLSX.utils.json_to_sheet(rows.detail);
  XLSX.utils.book_append_sheet(wb,a,'Rekap Awardee');XLSX.utils.book_append_sheet(wb,b,'Rekap Agenda');XLSX.utils.book_append_sheet(wb,d,'Detail Absensi');
  const p=currentParams(),period=(data.selectedPeriod?.nama||'Periode').replace(/[^a-z0-9]+/gi,'_'),range=p.from||p.to?`_${p.from||'awal'}_sd_${p.to||'akhir'}`:'';
  XLSX.writeFile(wb,`Absensi_ETOS_Palu_${period}${range}.xlsx`,{compression:true});window.toast?.('File Excel absensi berhasil dibuat.','success');
 }catch(err){window.toast?.(err?.message||String(err),'error')}finally{window.showLoader?.(false)}
};
function install(){ensureActions();ensurePanel();window.attendanceDetailModeChanged()}
window.addEventListener('etos:enhancements-ready',install);install();
})();