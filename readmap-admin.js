(()=>{'use strict';
const $=id=>document.getElementById(id),records=[];
let resetting=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function tell(msg){$('notice').textContent=msg||''}
function saveIssued(row){const i=records.findIndex(x=>x.username===row.username);if(i>=0)records[i]=row;else records.push(row);$('download').disabled=!records.length}
function showIssued(row){$('pin-name').textContent=row.name||'';$('pin-username').textContent=row.username||'';$('pin-value').value=row.pin||'';$('pin-value').type='password';$('pin-toggle').textContent='Tampilkan PIN';$('pin-result').hidden=false}

async function request(action,body){
 const r=await fetch('/api/secure',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({function:'readmapAdmin',params:{action:action||'list',...(body||{})}})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.error||'Permintaan tidak berhasil.');return data;
}
async function render(){
 try{
  const d=await request();$('summary').textContent=d.active+' dari '+d.total+' akun Etoser aktif sudah dibuat.';
  $('generate').disabled=resetting||d.active>=d.total;
  $('reset-all').disabled=resetting||d.active===0;
  $('member-list').innerHTML=d.members.map(m=>'<div class="item"><strong>'+esc(m.name)+'</strong><small>'+esc(m.angkatan)+' · '+esc(m.username||'Belum dibuat')+'</small>'+(m.provisioned?'<button class="secondary" data-reset="'+esc(m.username)+'">Reset PIN</button>':'')+'</div>').join('');
 }catch(e){tell(e.message);$('summary').textContent='Akses tidak tersedia. Masuk dengan PIN Superadmin pada Dashboard terlebih dahulu.';}
}
$('generate').addEventListener('click',async()=>{
 if(!confirm('Buat username dan PIN acak untuk Etoser aktif yang belum memiliki akun? Kredensial baru hanya ditampilkan satu kali.'))return;
 $('generate').disabled=true;
 let failed=false,loops=0;
 try{
  while(loops++<40){
   const x=await request('provision',{});
   (x.issued||[]).forEach(saveIssued);
   if(x.errors?.length){failed=true;break;}
   if(x.remaining===0||!(x.issued||[]).length)break;
  }
  tell(failed?'Sebagian akun gagal dibuat. Unduh PIN yang berhasil diterbitkan dan periksa koneksi.':'Akun berhasil diterbitkan. Unduh daftar PIN sekarang sebelum meninggalkan halaman.');
 }catch(e){tell('Proses berhenti: '+e.message+'. Unduh kredensial yang sudah diterima, dan reset akun jika PIN tidak tersimpan.');}
 finally{await render();}
});
$('member-list').addEventListener('click',async e=>{
 const username=e.target.dataset.reset;if(!username)return;
 if(!confirm('Reset PIN untuk akun '+username+'? PIN sebelumnya tidak dapat dipakai untuk login baru.'))return;
 e.target.disabled=true;
 try{const x=await request('reset',{username});saveIssued(x);showIssued(x);tell('PIN baru untuk '+username+' berhasil diterbitkan. Salin PIN atau unduh CSV sebelum menutup halaman.');}
 catch(err){tell(err.message)}finally{await render();}
});
function downloadCredentials(){
 if(!records.length)return false;
 const rows=[['Nama Etoser','Angkatan','Username','PIN'],...records.map(x=>[x.name,x.angkatan,x.username,x.pin])];
 const csv='\uFEFF'+rows.map(cols=>cols.map(v=>'"'+String(v??'').replace(/^[=+@\-\t\r\n]/,m=>"'"+m).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='READMAP-PIN-BARU-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 tell('File PIN baru berhasil disiapkan. Periksa unduhan Anda dan bagikan setiap akun secara pribadi. Hapus CSV setelah distribusi.');
 return true;
}
$('download').addEventListener('click',downloadCredentials);
$('pin-toggle').addEventListener('click',()=>{const input=$('pin-value');input.type=input.type==='password'?'text':'password';$('pin-toggle').textContent=input.type==='password'?'Tampilkan PIN':'Sembunyikan PIN';});
$('pin-copy').addEventListener('click',async()=>{if(!$('pin-value').value)return;try{await navigator.clipboard.writeText($('pin-value').value);tell('PIN baru disalin. Jangan bagikan kepada orang lain.');}catch{tell('Gagal menyalin otomatis. Gunakan Tampilkan PIN dan salin secara manual.')}});
$('reset-all').addEventListener('click',async()=>{
 if(resetting)return;
 let list;try{list=await request()}catch(e){tell(e.message);return}
 const members=(list.members||[]).filter(x=>x.provisioned&&x.username);
 if(!members.length)return tell('Tidak ada akun aktif yang perlu direset.');
 const typed=prompt('Anda akan MENGGANTI PIN '+members.length+' akun Etoser. PIN lama tidak bisa dipakai untuk login baru. Untuk menyetujui, ketik persis: RESET SEMUA');
 if(typed!=='RESET SEMUA')return tell('Reset semua PIN dibatalkan. Tidak ada yang diubah.');
 resetting=true;$('reset-all').disabled=true;$('generate').disabled=true;$('pin-result').hidden=true;
 let failures=0;
 try{
  for(let i=0;i<members.length;i++){
   const m=members[i];
   $('reset-progress').textContent='Memproses PIN '+(i+1)+' dari '+members.length+'. Jangan tutup halaman ini.';
   try{const issued=await request('reset',{username:m.username});saveIssued(issued)}
   catch(e){failures++;tell('Ada PIN yang gagal direset. PIN yang sudah berhasil akan tetap dapat diunduh.')}
  }
  $('reset-progress').textContent=(members.length-failures)+' dari '+members.length+' PIN baru berhasil diterbitkan.'+(failures?' Silakan ulangi untuk akun yang gagal.':'');
  if(records.length){downloadCredentials();tell((failures?'Sebagian PIN berhasil dibuat. ':'Semua PIN baru berhasil dibuat. ')+'File CSV telah disiapkan; periksa folder unduhan sebelum menutup halaman.');}
 }finally{
  resetting=false;
  await render();
 }
});
function bars(id,values,suffix){
 const root=$(id),pairs=Object.entries(values||{}).sort((a,b)=>suffix==='hlm'?b[1]-a[1]:a[0].localeCompare(b[0]));
 if(!pairs.length){root.textContent='Belum ada laporan.';return;}
 const high=Math.max(1,...pairs.map(x=>x[1]));
 root.innerHTML=pairs.slice(-12).map(([name,val])=>'<div class="cat-row"><span>'+esc(name)+'</span><div><div style="width:'+Math.round(val/high*100)+'%"></div></div><strong>'+val+' '+suffix+'</strong></div>').join('');
}
async function overview(){
 try{
  const d=await request('overview');
  const items=[['Etoser Aktif',d.totals.awardees],['Akun Diterbitkan',d.totals.members],['Halaman Dilaporkan',d.totals.pages],['Video Selesai',d.totals.videosFinished],['Buku Selesai',d.totals.booksFinished],['Laporan Bacaan',d.totals.readingReports]];
  $('overview-stats').innerHTML=items.map(([k,v])=>'<div class="metric"><b>'+Number(v).toLocaleString('id-ID')+'</b><small>'+esc(k)+'</small></div>').join('');
  bars('overview-weeks',d.weekly,'hlm');
  bars('overview-categories',d.categories,'hlm');
  $('overview-members').innerHTML=d.members.map(m=>'<div class="item"><strong>'+esc(m.name)+' · '+esc(m.angkatan)+'</strong><small>'+m.pages+' halaman · '+m.booksFinished+' buku selesai · '+m.videosFinished+' video selesai · '+m.weeks+' pekan laporan</small></div>').join('');
 }catch(e){tell(e.message)}
}
$('reload-overview').addEventListener('click',overview);
overview();
render();
})();