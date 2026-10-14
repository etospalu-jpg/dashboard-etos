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
  const minutesAgo=d.lastConnectorAt?(Date.now()-new Date(d.lastConnectorAt).getTime())/60000:Infinity;
  const status=d.lastConnectorAt&&minutesAgo<=10?
   '<strong>Konektor hampir real-time aktif</strong><p>Pembaruan terakhir diterima '+esc(prettyDate(d.lastConnectorAt))+' WITA. Pemeriksaan dilakukan sekitar setiap menit.</p>':
   d.lastConnectorAt?
    '<strong>Konektor pernah aktif, tetapi sekarang perlu diperiksa</strong><p>Terakhir terhubung '+esc(prettyDate(d.lastConnectorAt))+' WITA. Periksa pemicu dan riwayat eksekusi proyek Apps Script pribadi.</p>':
    '<strong>Data awal sudah tersedia · Sinkronisasi otomatis 1 menit belum diaktifkan</strong><p>Aktifkan sekali lewat Apps Script pribadi yang bisa membaca file pusat. Tidak perlu izin tambahan dari pemilik spreadsheet jika akun Anda memang sudah memiliki akses baca.</p>';
  $('asrama-sync-status').innerHTML=status;
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