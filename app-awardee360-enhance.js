/* ETOS Awardee 360: incremental history, read-only learning sources. */
(function(){
'use strict';
if(window.ETOS_A360_V2)return;window.ETOS_A360_V2=true;
const e=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const date=v=>v?String(v).slice(0,10):'—';
function page(host,rows){
 const items=Array.from(rows);if(items.length<=5)return;
 items.forEach((x,i)=>{x.hidden=i>=5;x.dataset.a360Entry='1'});
 const button=document.createElement('button');button.type='button';button.className='btn btn-soft a360-more';
 const label=()=>{const left=items.filter(x=>x.hidden).length;button.textContent=left?'Lihat Selengkapnya · '+left+' entri tersisa':'Ringkas ke 5 entri';button.setAttribute('aria-expanded',String(!left))};
 button.addEventListener('click',()=>{const hidden=items.filter(x=>x.hidden);if(hidden.length)hidden.slice(0,5).forEach(x=>x.hidden=false);else items.forEach((x,i)=>x.hidden=i>=5);label()});
 host.append(button);label();
}
function tile(title,desc,obj,render){
 const section=document.createElement('details');section.className='card mt-4 a360-extra';
 const summary=document.createElement('summary');summary.className='p-5 cursor-pointer list-none';
 summary.innerHTML='<div class="eyebrow">Awardee 360 · Sumber Terhubung</div><div class="section-title text-[16px] mt-1">'+e(title)+'</div><p class="text-[10px] text-[#70849b] mt-1">'+e(desc)+'</p>';
 section.append(summary);
 const body=document.createElement('div');body.className='px-5 pb-5 pt-4 border-t border-[#e5edf5]';
 const rows=obj?.rows||[];
 if(!obj?.available)body.innerHTML='<div class="empty">Sumber data belum dapat dimuat. Bukan berarti aktivitas kosong.</div>';
 else if(!rows.length)body.innerHTML='<div class="empty">Belum ada catatan pada sumber ini.</div>';
 else{const list=document.createElement('div');list.className='space-y-2';for(const x of rows){const item=document.createElement('div');item.className='card-flat p-4';item.innerHTML=render(x);list.appendChild(item)}body.append(list);page(body,list.children)}
 section.append(body);return section;
}
function val(label,value){return '<div class="mt-2"><b class="text-[10px] text-[#6982a0]">'+e(label)+': </b><span class="text-[11px] leading-5">'+e(value??'—')+'</span></div>'}
function videoPct(v){const duration=num(v.duration_seconds);if(!duration)return null;const intervals=(Array.isArray(v.watched_intervals)?v.watched_intervals:[]).filter(x=>Array.isArray(x)&&x.length>=2).map(x=>[Math.max(0,num(x[0])),Math.min(duration,num(x[1]))]).filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0]);let end=0,seen=0;for(const [a,b]of intervals){seen+=Math.max(0,b-Math.max(end,a));end=Math.max(end,b)}return Math.min(100,Math.round(seen/duration*100))}
function progress(p){return p===null?'<div class="text-[10px] text-[#74879c] mt-2">Progres belum dapat dihitung</div>':'<div class="a360-progress"><span style="width:'+p+'%"></span></div><div class="text-[10px] text-[#607b9d]">'+p+'% tercatat</div>'}
// Close and clear sensitive 360 details whenever the operational PIN session ends.
const priorAuthUi=window.updateAuthUI;
window.updateAuthUI=function(){
 const outcome=typeof priorAuthUi==='function'?priorAuthUi.apply(this,arguments):undefined;
 try{if(state?.session?.kind!=='pin'){
   const drawer=document.getElementById('awardee-drawer');
   if(drawer){drawer.classList.remove('open','a360-expanded');const content=drawer.querySelector('#drawer-content');if(content)content.replaceChildren();}
 }}catch(_){}
 return outcome;
};
window.a360Enhance=function(data){
 const root=document.getElementById('drawer-content');if(!root||state?.session?.kind!=='pin')return;
 const sections=[...root.children].filter(x=>x.tagName==='DETAILS');
 for(const section of sections){
  const name=section.querySelector('summary .section-title')?.textContent||'',body=section.querySelector(':scope > div');if(!body)continue;
  if(name==='Absensi'||name==='Akademik')page(body,body.querySelectorAll('tbody tr'));
  else if(name==='Coaching')page(body,[...body.children].filter(x=>x.classList.contains('card-flat')));
  else if(name==='Refleksi')page(body,body.querySelectorAll(':scope > details.card-flat'));
  else if(name==='Pendampingan & Jurnal')page(body,body.querySelectorAll('.space-y-3 > .card-flat'));
  else if(name==='Prestasi & Organisasi')body.querySelectorAll('.space-y-3 > div').forEach(group=>page(group,[...group.children].filter(x=>x.classList.contains('card-flat'))));
 }
 const analysis=[...root.children].find(x=>x.classList.contains('card')&&x.querySelector('.space-y-2'));if(analysis){const n=analysis.querySelector('.space-y-2');page(n,[...n.children].filter(x=>x.classList.contains('card-flat')))}
 const l=data?.learning||{},books=l.books?.rows||[],lookup=new Map(books.map(x=>[x.id,x.title]));
 const total=(l.reading?.rows||[]).reduce((s,x)=>s+num(x.pages_read),0),weeks=new Set((l.reading?.rows||[]).map(x=>x.week_start)).size;
 const top=document.createElement('div');top.className='a360-overview mt-4';top.innerHTML='<div class="eyebrow">READMAP · Perjalanan Literasi</div><div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">'+[['Buku',l.books],['Halaman',l.reading],['Pekan',l.reading],['Video',l.videos]].map(([label,x],i)=>'<div class="card-flat p-3"><span class="text-[10px] text-[#70849b]">'+label+'</span><div class="text-[21px] font-extrabold">'+(x?.available?[books.length,total,weeks,(l.videos?.rows||[]).length][i]:'—')+'</div></div>').join('')+'</div><p class="text-[10px] text-[#70849b] mt-3">Jumlah halaman adalah laporan tercatat; progres pemutaran bukan bukti memahami video.</p>';root.append(top);
 root.append(tile('Rak Buku & Progres','Sampul, posisi membaca dan status tersimpan di READMAP',l.books,x=>'<b class="text-[12px]">'+e(x.title)+'</b>'+val('Penulis',x.author)+val('Kategori',x.category)+val('Halaman',num(x.current_page)+' / '+(x.total_pages||'—'))+progress(num(x.total_pages)>0?Math.max(0,Math.min(100,Math.round(num(x.current_page)/num(x.total_pages)*100))):null)));
 root.append(tile('Laporan Bacaan Pekanan','Halaman, insight dan jumlah bukti unggahan',l.reading,x=>'<b class="text-[12px]">'+e(lookup.get(x.book_id)||'Buku')+'</b>'+val('Pekan',x.week_start)+val('Halaman dilaporkan',x.pages_read)+val('Pembelajaran',x.insight)+val('Bukti bacaan',Array.isArray(x.evidence_paths)?x.evidence_paths.length+' foto tersimpan (privat)':'Belum ada')));
 root.append(tile('Riwayat Pekanan Tanpa Bacaan','Status laporan dari Awardee',l.weeks,x=>'<b>Pekan '+e(x.week_start)+'</b>'+val('Status',x.no_reading?'Melaporkan tidak membaca':'Laporan masuk')+val('Catatan',x.note)));
 root.append(tile('Video Belajar & Tontonan','Interval video yang diputar, bukan bukti perhatian',l.videos,x=>{const p=videoPct(x);return '<b class="text-[12px]">'+e(x.title||'Video')+'</b>'+val('Status',x.status)+val('Aktivitas terakhir',date(x.last_watched_at))+progress(p)+val('Insight',x.insight)}));
 root.append(tile('Refleksi Tahsin','Jawaban tiap pertemuan dan target latihan',l.tahsin,x=>'<b class="text-[12px]">Tahsin · '+e(date(x.submitted_at))+'</b>'+val('Pelajaran',x.lesson)+val('Kesulitan',(x.challenges||[]).join(', '))+val('Kepercayaan diri',x.confidence==null?'—':x.confidence+'/5')+val('Latihan',x.practice_frequency)+val('Target perbaikan',x.improvement_goal)+val('Evaluasi sebelumnya',x.previous_goal_review)));
 root.append(tile('Ruang Gagasan','Tulisan dan status karya Awardee',l.writings,x=>'<b class="text-[12px]">'+e(x.title||'Tulisan')+'</b>'+val('Kategori',x.category)+val('Status',x.status)+val('Ringkasan',x.excerpt)));
 if(String(data?.awardee?.angkatan||'').replace(/\.0$/,'')==='2023'){const n=document.createElement('div');n.className='card p-5 mt-4';n.innerHTML='<div class="eyebrow">Hafalan Juz 30 · Target 2027</div><div class="text-[12px] mt-2">Integrasi Murojaahku (ETOS23) ditunda. Belum ada data hafalan terverifikasi untuk ditampilkan.</div>';root.append(n)}
 const auxiliary=[['Kompetensi',data?.competencies,x=>'<b>'+e(x.competency||'Kompetensi')+'</b>'+val('Level',x.level)+val('Status verifikasi',x.verification_status)],['Portofolio',data?.portfolio?[data.portfolio]:[],x=>val('Kontribusi',x.contribution)],['Catatan Spiritual',data?.spiritual,x=>val('Periode',x.month_label)+val('Tahsin',x.tahsin_progress)+val('Tilawah',x.tilawah_achievement)],['Jaringan & Relasi',data?.networking,x=>val('Catatan',x.notes||x.purpose)],['Rekap Fasilitator',data?.monthlySummaries,x=>val('Periode',x.month_start)+val('Ringkasan',x.summary||x.notes)]];
 for(const [name,rows,renderer]of auxiliary)if(Array.isArray(rows)&&rows.length)root.append(tile(name,'Catatan internal yang sudah tersedia',{available:true,rows},renderer));
 const action=document.createElement('div');action.className='mt-4 flex flex-wrap items-center gap-3';action.innerHTML='<button type="button" class="btn btn-primary" id="a360-expand-btn">Perluas Tampilan Profil 360°</button><span class="text-[10px] text-[#70849b]">Masing-masing daftar menampilkan 5 entri pertama.</span>';root.insertBefore(action,root.firstChild);
 action.querySelector('button').addEventListener('click',ev=>{const on=document.getElementById('awardee-drawer').classList.toggle('a360-expanded');ev.currentTarget.textContent=on?'Tampilan Ringkas':'Perluas Tampilan Profil 360°'});
 window.lucide?.createIcons?.();
};
})();