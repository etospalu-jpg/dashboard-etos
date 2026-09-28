(function(){
'use strict';
if(window.ETOS_ATTENDANCE_DETAIL_READY)return;window.ETOS_ATTENDANCE_DETAIL_READY='v1';
const escHtml=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let detailData=null,loading=false,xlsxPromise=null;
function fmtDate(v){if(!v)return'—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v+'T00:00:00+08:00'))}catch{return v}}
function ensurePanel(){
 const view=document.getElementById('view-attendance');if(!view||document.getElementById('attendance-detail-panel'))return;
 const panel=document.createElement('section');panel.id='attendance-detail-panel';panel.className='mt-5';
 panel.innerHTML=`
 <div class="card overflow-hidden">
   <div class="p-5 md:p-6 border-b border-[#e8eeea]">
     <div class="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
       <div>
         <div class="eyebrow">Riwayat Detail</div>
         <h3 class="section-title text-[20px] mt-2">Absensi per Agenda</h3>
         <p class="text-[10px] text-[#7b8981] mt-2">Lihat siapa Hadir, Izin, Sakit, atau Alpa pada setiap agenda. Pilih rentang tanggal untuk laporan bulanan, beberapa bulan, atau satu periode.</p>
       </div>
       <div class="flex flex-wrap gap-2">
         <button class="btn btn-soft" type="button" onclick="loadAttendanceDetail(true)"><i data-lucide="refresh-cw" class="w-4 h-4"></i>Perbarui</button>
         <button class="btn btn-green" type="button" onclick="downloadAttendanceExcel()"><i data-lucide="download" class="w-4 h-4"></i>Download Excel</button>
       </div>
     </div>
     <div class="grid sm:grid-cols-3 gap-3 mt-5">
       <label><span class="text-[9px] uppercase tracking-[.1em] font-bold text-[#7f8c84]">Periode</span><select id="attendance-detail-period" class="input select mt-2"></select></label>
       <label><span class="text-[9px] uppercase tracking-[.1em] font-bold text-[#7f8c84]">Dari Tanggal</span><input id="attendance-detail-from" type="date" class="input mt-2"></label>
       <label><span class="text-[9px] uppercase tracking-[.1em] font-bold text-[#7f8c84]">Sampai Tanggal</span><input id="attendance-detail-to" type="date" class="input mt-2"></label>
     </div>
     <div class="flex flex-wrap gap-2 mt-3">
       <button class="btn btn-soft" type="button" onclick="setAttendanceRange('month')">Bulan Ini</button>
       <button class="btn btn-soft" type="button" onclick="setAttendanceRange('all')">Seluruh Periode</button>
       <button class="btn btn-primary" type="button" onclick="loadAttendanceDetail(true)">Tampilkan</button>
     </div>
   </div>
   <div id="attendance-detail-content" class="p-4 md:p-5 space-y-4"><div class="empty">Memuat detail absensi…</div></div>
 </div>`;
 view.appendChild(panel);window.lucide?.createIcons?.();
}
function currentParams(){
 return{
   periodeId:document.getElementById('attendance-detail-period')?.value||document.getElementById('attendance-period')?.value||null,
   from:document.getElementById('attendance-detail-from')?.value||null,
   to:document.getElementById('attendance-detail-to')?.value||null
 };
}
function periodOptions(periods,selected){
 const el=document.getElementById('attendance-detail-period');if(!el)return;
 const cur=el.value||selected?.id||'';
 el.innerHTML=(periods||[]).map(p=>`<option value="${escHtml(p.id)}">${escHtml(p.nama||p.id)}${String(p.status||'').toLowerCase()==='aktif'?' • Aktif':''}</option>`).join('');
 if([...el.options].some(o=>o.value===cur))el.value=cur;else if(selected?.id)el.value=selected.id;
}
function badge(status){
 const s=String(status||'').toLowerCase(),cls=s==='hadir'?'pill-green':s==='izin'||s==='sakit'?'pill-gold':'pill-gray';
 return `<span class="pill ${cls}">${escHtml(status||'—')}</span>`;
}
function render(data){
 detailData=data||{sessions:[]};periodOptions(detailData.periods,detailData.selectedPeriod);
 const root=document.getElementById('attendance-detail-content');if(!root)return;
 const sessions=detailData.sessions||[];
 if(!sessions.length){root.innerHTML='<div class="empty">Belum ada sesi absensi pada rentang ini.</div>';return}
 root.innerHTML=sessions.map((s,idx)=>`
 <article class="card-flat overflow-hidden">
   <div class="p-4 md:p-5 border-b border-[#e8eeea] flex flex-col md:flex-row md:items-center justify-between gap-3">
     <div>
       <div class="text-[12px] font-extrabold text-[#223028]">${escHtml(s.nama||'Agenda')}</div>
       <div class="text-[9px] text-[#849189] mt-1">${escHtml(fmtDate(s.tanggal))} · Target ${escHtml(s.target||'Umum')}</div>
     </div>
     <div class="flex flex-wrap gap-2 text-[9px]">
       <span class="pill pill-green">Hadir ${Number(s.hadir)||0}</span>
       <span class="pill pill-gray">Izin ${Number(s.izin)||0}</span>
       <span class="pill pill-gold">Sakit ${Number(s.sakit)||0}</span>
       <span class="pill pill-gray">Alpa ${Number(s.alpa)||0}</span>
     </div>
   </div>
   <div class="table-wrap">
     <table class="data-table">
       <thead><tr><th>Awardee</th><th>Angkatan</th><th>Status</th></tr></thead>
       <tbody>${(s.records||[]).length?(s.records||[]).map(r=>`<tr><td><div class="font-semibold">${escHtml(r.nama)}</div><div class="text-[9px] text-[#8a968f] mt-1">${escHtml(r.id||'')}</div></td><td>${escHtml(r.angkatan||'—')}</td><td>${badge(r.status)}</td></tr>`).join(''):'<tr><td colspan="3" class="empty">Belum ada catatan peserta pada sesi ini.</td></tr>'}</tbody>
     </table>
   </div>
 </article>`).join('');
}
async function fetchDetail(){
 const r=await window.etosAPI.call('getAttendanceDetail',currentParams());
 if(!r||r.success===false)throw new Error(r?.error||'Detail absensi gagal dimuat.');
 return r.data;
}
window.loadAttendanceDetail=async function(force=false){
 ensurePanel();if(loading&&!force)return detailData;loading=true;
 const root=document.getElementById('attendance-detail-content');if(root&&!detailData)root.innerHTML='<div class="empty">Memuat detail absensi…</div>';
 try{const data=await fetchDetail();render(data);return data}
 catch(err){if(root)root.innerHTML=`<div class="empty">Detail absensi belum dapat dimuat. ${escHtml(err?.message||String(err))}</div>`;throw err}
 finally{loading=false;window.lucide?.createIcons?.()}
};
window.setAttendanceRange=function(mode){
 ensurePanel();const from=document.getElementById('attendance-detail-from'),to=document.getElementById('attendance-detail-to');
 if(mode==='all'){from.value='';to.value='';return window.loadAttendanceDetail(true)}
 const d=new Date(),y=d.getFullYear(),m=d.getMonth();const a=new Date(y,m,1),b=new Date(y,m+1,0),iso=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
 from.value=iso(a);to.value=iso(b);return window.loadAttendanceDetail(true)
};
function ensureXLSX(){
 if(window.XLSX)return Promise.resolve(window.XLSX);if(xlsxPromise)return xlsxPromise;
 xlsxPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.async=true;s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Library Excel tidak tersedia.'));s.onerror=()=>reject(new Error('Library Excel gagal dimuat.'));document.head.appendChild(s)}).finally(()=>{if(!window.XLSX)xlsxPromise=null});
 return xlsxPromise;
}
function exportRows(data){
 const detail=[],sessions=[],recap=new Map();
 for(const s of data?.sessions||[]){
   sessions.push({Tanggal:s.tanggal,Agenda:s.nama,Target:s.target,Hadir:s.hadir,Izin:s.izin,Sakit:s.sakit,Alpa:s.alpa,Total:s.total});
   for(const r of s.records||[]){
     detail.push({Tanggal:s.tanggal,Agenda:s.nama,'ID Awardee':r.id,Nama:r.nama,Angkatan:r.angkatan,Status:r.status});
     const k=r.id||r.nama;if(!recap.has(k))recap.set(k,{'ID Awardee':r.id,Nama:r.nama,Angkatan:r.angkatan,Hadir:0,Izin:0,Sakit:0,Alpa:0,'Belum Dicatat':0,'Total Tercatat':0,'Kehadiran (%)':0});
     const x=recap.get(k),st=String(r.status||'').toLowerCase();if(st==='hadir')x.Hadir++;else if(st==='izin')x.Izin++;else if(st==='sakit')x.Sakit++;else if(st==='alpa'||st==='tidak hadir')x.Alpa++;else x['Belum Dicatat']++;if(st==='hadir'||st==='izin'||st==='sakit'||st==='alpa'||st==='tidak hadir')x['Total Tercatat']++;
   }
 }
 for(const x of recap.values())x['Kehadiran (%)']=x['Total Tercatat']?Math.round(x.Hadir/x['Total Tercatat']*100):0;
 return{detail,sessions,recap:[...recap.values()]};
}
window.downloadAttendanceExcel=async function(){
 try{
   window.showLoader?.(true);const data=await fetchDetail();render(data);if(!(data?.sessions||[]).length)throw new Error('Tidak ada data absensi pada rentang yang dipilih.');
   const XLSX=await ensureXLSX(),rows=exportRows(data),wb=XLSX.utils.book_new();
   const wsDetail=XLSX.utils.json_to_sheet(rows.detail),wsRecap=XLSX.utils.json_to_sheet(rows.recap),wsSessions=XLSX.utils.json_to_sheet(rows.sessions);
   wsDetail['!cols']=[{wch:13},{wch:34},{wch:14},{wch:28},{wch:10},{wch:12}];wsRecap['!cols']=[{wch:14},{wch:28},{wch:10},{wch:9},{wch:9},{wch:9},{wch:9},{wch:14},{wch:14},{wch:15}];wsSessions['!cols']=[{wch:13},{wch:34},{wch:14},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9}];
   XLSX.utils.book_append_sheet(wb,wsRecap,'Rekap Awardee');XLSX.utils.book_append_sheet(wb,wsSessions,'Rekap Agenda');XLSX.utils.book_append_sheet(wb,wsDetail,'Detail Absensi');
   const p=currentParams(),period=(data.selectedPeriod?.nama||'Periode').replace(/[^a-z0-9]+/gi,'_'),range=p.from||p.to?`_${p.from||'awal'}_sd_${p.to||'akhir'}`:'';
   XLSX.writeFile(wb,`Absensi_ETOS_Palu_${period}${range}.xlsx`,{compression:true});
   if(typeof toast==='function')toast('File Excel absensi berhasil dibuat.','success');
 }catch(err){if(typeof toast==='function')toast(err?.message||String(err),'error')}finally{window.showLoader?.(false)}
};
function install(){
 ensurePanel();
 const base=window.loadAttendance;
 if(typeof base==='function'&&!base.__detailWrapped){
   const wrapped=async function(){const result=await base.apply(this,arguments);Promise.resolve(window.loadAttendanceDetail(false)).catch(()=>{});return result};wrapped.__detailWrapped=true;window.loadAttendance=wrapped;
 }
}
window.addEventListener('etos:enhancements-ready',install);
install();
})();