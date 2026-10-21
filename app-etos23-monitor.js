/* MurojaAku ETOS23 — live read-only monitoring in existing Hafalan tab. */
(function(){
'use strict';
const rootId='ki-etos23-root';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pending=null;
function fmt(n){return Number(n||0).toLocaleString('id-ID')}
async function load(){
 const root=document.getElementById(rootId);if(!root||pending)return;
 root.innerHTML='<div class="card p-5 text-[12px] text-[#617994]">Membaca laporan ETOS23 dari MurojaAku…</div>';
 pending=(async()=>{
  try{
   const response=await fetch('/api/public-attendance',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'etos23_report'})});
   const json=await response.json().catch(()=>({}));
   if(!response.ok||!json.success)throw Error(json.error||'Gagal menghubungkan laporan.');
   const d=json.data||{},people=d.peserta||[],total=people.reduce((n,p)=>n+Number(p.total_ayat_lulus||0),0);
   const toDate=v=>{if(!v)return '—';return String(v).slice(0,10)};
   if(!root.isConnected)return;
   root.innerHTML=
    '<section class="card p-5 md:p-7 mb-4"><div class="flex flex-wrap gap-3 justify-between items-start"><div><div class="eyebrow">SUMBER LANGSUNG · MUROJAAKU / ETOS23</div><h3 class="section-title text-[22px] mt-3">Monitoring Hafalan Angkatan 2023</h3><p class="text-[11px] text-[#617994] mt-2">Data langsung dari '+esc(d.room||'ruang ETOS23')+' · baca-saja, tidak mengubah catatan ustaz.</p></div><button class="btn btn-soft" type="button" id="etos23-refresh">↻ Sinkronkan Ulang</button></div><div class="grid sm:grid-cols-3 gap-3 mt-5"><div class="card-flat p-4"><div class="eyebrow">Peserta terhubung</div><strong class="text-[27px]">'+fmt(people.length)+'</strong></div><div class="card-flat p-4"><div class="eyebrow">Ayat lulus tercatat</div><strong class="text-[27px]">'+fmt(total)+'</strong></div><div class="card-flat p-4"><div class="eyebrow">Catatan setoran rinci</div><strong class="text-[27px]">'+fmt((d.setoran||[]).length)+'</strong></div></div><p class="text-[10px] text-[#617994] mt-3">Disinkronkan '+esc(new Date(d.fetched_at).toLocaleString('id-ID'))+'. Angka lulus mengikuti laporan MurojaAku; bukan asumsi total Juz 30.</p></section>'+
    '<section class="card p-5 md:p-6 mb-4"><h4 class="section-title text-[17px] mb-4">Progres setiap Awardee</h4><div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">'+
    (people.length?people.map(p=>'<article class="card-flat p-4"><div class="text-[12px] font-extrabold text-[#19395e]">'+esc(p.nama||'Peserta')+'</div><div class="text-[25px] font-extrabold mt-3 text-[#1e4c87]">'+fmt(p.total_ayat_lulus)+' <span class="text-[11px] font-normal">ayat lulus</span></div><div class="text-[10px] text-[#71849b] mt-2">Target surah: '+esc(p.target_surah||'Belum tercatat')+'</div><div class="text-[10px] text-[#71849b]">Target ayat: '+esc(p.target_ayat_awal??'—')+' – '+esc(p.target_ayat_akhir??'—')+'</div></article>').join(''):'<div class="empty">Belum ada peserta pada respons MurojaAku.</div>')+
    '</div></section>'+
    '<section class="grid xl:grid-cols-2 gap-4"><div class="card p-5"><h4 class="section-title text-[16px] mb-3">Catatan Pembimbing</h4>'+((d.feedback||[]).length?(d.feedback||[]).map(x=>'<div class="card-flat p-4 mb-2"><div class="text-[10px] text-[#71849b]">'+esc(toDate(x.tanggal))+'</div><p class="text-[12px] mt-2 whitespace-pre-wrap">'+esc(x.catatan)+'</p></div>').join(''):'<p class="text-[11px] text-[#71849b]">Belum ada catatan umum.</p>')+'</div><div class="card p-5"><h4 class="section-title text-[16px] mb-3">Aktivitas Tercatat</h4><p class="text-[12px] text-[#617994]">Riwayat setoran: '+fmt((d.setoran||[]).length)+' catatan · Kehadiran: '+fmt((d.kehadiran||[]).length)+' catatan.</p><p class="text-[11px] text-[#71849b] mt-3">'+((d.setoran||[]).length?'Data setoran ditarik dari sumber asli.':'Endpoint belum mengirim rincian setoran. Progres tetap memakai angka ayat lulus yang tersedia.')+'</p><a href="https://www.murojaahku.web.id/" target="_blank" rel="noopener noreferrer" class="btn btn-soft mt-4">Buka MurojaAku ↗</a></div></section>';
  }catch(e){if(root.isConnected)root.innerHTML='<div class="card p-5"><h4 class="font-extrabold text-[14px]">Koneksi MurojaAku belum tersedia</h4><p class="text-[12px] text-[#617994] mt-2">'+esc(e.message)+'</p><button class="btn btn-soft mt-3" id="etos23-refresh">Coba Lagi</button></div>'}
 })().finally(()=>pending=null);
 await pending;
}
document.addEventListener('click',event=>{if(event.target.closest('#etos23-refresh'))load()});
window.ETOS23Monitor={load};
})();