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
  $('asrama-sync-status').innerHTML=d.lastConnectorAt?
   '<strong>Sinkronisasi otomatis aktif</strong><p>Perubahan terakhir diterima '+esc(prettyDate(d.lastConnectorAt))+' WITA.</p>':
   d.connected?'<strong>Kunci sudah dibuat — menunggu sinkronisasi pertama</strong><p>Jalankan “Sinkronisasi sekarang” di menu ETOS · Asrama pada Google Sheets untuk memulai.</p>':
   '<strong>Data awal tersedia · Sambungan otomatis belum aktif</strong><p>Aktifkan konektor satu kali melalui dua langkah di bawah. Spreadsheet tetap tidak diubah oleh Dashboard.</p>';
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