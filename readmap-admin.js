(()=>{'use strict';
const $=id=>document.getElementById(id),records=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function tell(msg){$('notice').textContent=msg||''}
async function request(action,body){
 const r=await fetch('/api/secure',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({function:'readmapAdmin',params:{action:action||'list',...(body||{})}})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.error||'Permintaan tidak berhasil.');return data;
}
async function render(){
 try{
  const d=await request();$('summary').textContent=d.active+' dari '+d.total+' akun Etoser aktif sudah dibuat.';
  $('generate').disabled=d.active>=d.total;
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
   records.push(...(x.issued||[]));
   $('download').disabled=records.length===0;
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
 try{const x=await request('reset',{username});records.push(x);$('download').disabled=false;tell('PIN baru berhasil dibuat untuk '+username+'. Unduh file sekarang.');}
 catch(err){tell(err.message)}finally{await render();}
});
$('download').addEventListener('click',()=>{
 if(!records.length)return;
 const rows=[['Nama Etoser','Angkatan','Username','PIN'],...records.map(x=>[x.name,x.angkatan,x.username,x.pin])];
 const csv='\uFEFF'+rows.map(cols=>cols.map(v=>'"'+String(v??'').replace(/^[=+@\-]/,m=>"'"+m).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='READMAP-kredensial-baru-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 tell('File kredensial berhasil disiapkan. Simpan dan bagikan secara pribadi. Hapus file setelah distribusi.');
});
render();
})();