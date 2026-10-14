(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'" :'&#39;'}[c]));
async function call(action){
 const res=await fetch('/api/secure',{method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json'},body:JSON.stringify({function:'readmapAdmin',params:{action}})});
 const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||'Sesi Superadmin tidak tersedia');
 return data;
}
function prettyDate(date){return date?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Makassar'}).format(new Date(date)):'Belum tersambung'}
async function refresh(){
 $('asrama-sync-status').textContent='Memeriksa status konektor…';
 try{
  const d=await call('asramaStatus');
  const daysSinceSync=d.lastSyncAt?(Date.now()-new Date(d.lastSyncAt).getTime())/86400000:Infinity;
  $('asrama-sync-status').innerHTML=d.lastSyncAt?
   (daysSinceSync<=8?
     '<strong>Data asrama tersimpan · Pembaruan mingguan dijadwalkan</strong><p>Rekap terakhir diterima '+esc(prettyDate(d.lastSyncAt))+' WITA. Perubahan pada jurnal pusat akan diperiksa tiap Senin pagi melalui koneksi Google Drive.</p>':
     '<strong>Data tersimpan · Jadwal pembaruan perlu diperiksa</strong><p>Rekap terakhir '+esc(prettyDate(d.lastSyncAt))+' WITA. Jika belum diperbarui lebih dari satu minggu, periksa tugas sinkronisasi dan izin baca Google Drive.</p>'):
   '<strong>Menunggu pembaruan pertama</strong><p>Pemeriksaan otomatis mingguan telah dijadwalkan tanpa perlu mengubah spreadsheet pusat.</p>';
  $('asrama-sync-totals').innerHTML=[['Pertemuan',d.sessionCount],['Catatan Absensi',d.recordCount],['Sumber','Google Sheets']].map(([name,v])=>'<div class="metric"><b>'+esc(v)+'</b><small>'+esc(name)+'</small></div>').join('');
  $('asrama-sync-events').innerHTML=d.sessions?.length?d.sessions.map(e=>
    '<div class="asrama-sync-row"><div><b>'+esc(e.name)+'</b><small>'+esc(e.date)+'</small></div><div><strong>'+e.present+'</strong><small>Hadir</small></div><div><strong>'+e.absent+'</strong><small>Izin/Sakit/Alpa</small></div></div>').join(''):
    '<p>Belum ada absensi yang tercatat dari jurnal asrama.</p>';
 }catch(e){$('asrama-sync-status').textContent='Gagal memuat integrasi: '+e.message;}
}
$('asrama-refresh').addEventListener('click',refresh);
$('asrama-generate-key').addEventListener('click',async()=>{
 const ok=confirm('Buat kunci baru? Kunci lama akan berhenti berfungsi dan perlu diganti di Apps Script. Lanjutkan?');
 if(!ok)return;
 const b=$('asrama-generate-key');b.disabled=true;
 try{
  const d=await call('asramaIssueKey');
  $('asrama-sync-key').value=d.key||'';
  $('asrama-key-box').hidden=false;
  $('asrama-sync-key').focus();$('asrama-sync-key').select();
  await refresh();
 }catch(e){alert('Gagal membuat kunci: '+e.message)}
 finally{b.disabled=false}
});
$('asrama-copy-key').addEventListener('click',async()=>{
 const input=$('asrama-sync-key');if(!input.value)return;
 try{await navigator.clipboard.writeText(input.value);$('asrama-copy-key').textContent='Kunci tersalin ✓'}
 catch{input.focus();input.select();$('asrama-copy-key').textContent='Pilih dan salin kunci'}
});
refresh();
})();