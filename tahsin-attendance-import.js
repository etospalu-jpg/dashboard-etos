(function(){'use strict';
let roster=[];
const norm=s=>String(s||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('id');
function toast(m,type=''){window.toast?.(m,type);}
window.installTahsinAttendanceImport=function(awardees){
 roster=awardees||[];
 const list=document.getElementById('attendance-entry-list');if(!list)return;
 const modal=list.closest('.modal-card')||list.parentElement;
 if(!modal)return;
 let area=document.getElementById('tahsin-import-area');
 if(!area){
  area=document.createElement('div');area.id='tahsin-import-area';area.className='bg-[#f4faf3] border border-[#d6e8d4] p-3 rounded-xl my-3';
  area.innerHTML='<label class="block text-[11px] font-bold text-[#276141]">Impor Absensi Excel / CSV (opsional)<input type="file" id="tahsin-attendance-file" accept=".xlsx,.xls,.csv" class="input mt-2" /></label><p class="text-[10px] leading-5 text-[#6b8375] mt-2">Kolom minimal: Nama dan Status (Hadir / Izin / Sakit / Alpa). Data tidak disimpan sebelum Anda meninjau dan menekan Simpan Absensi. Nama yang tidak cocok persis akan dilewati.</p><div id="tahsin-import-result" class="text-[11px] font-semibold mt-2" role="status"></div>';
  list.parentNode.insertBefore(area,list);
  document.getElementById('tahsin-attendance-file').addEventListener('change',importFile);
 }else{
  document.getElementById('tahsin-import-result').textContent='';
  document.getElementById('tahsin-attendance-file').value='';
 }
};
async function importFile(e){
 const file=e.target.files?.[0];if(!file)return;
 const output=document.getElementById('tahsin-import-result');output.textContent='Membaca file…';
 try{
  if(file.size>4*1024*1024)throw Error('Ukuran file maksimal 4 MB.');
  if(!window.XLSX){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';script.onload=resolve;script.onerror=()=>reject(Error('Pembaca Excel gagal dimuat. Pastikan internet tersedia.'));document.head.appendChild(script)})}if(!window.XLSX)throw Error('Pembaca Excel tidak tersedia.');
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),sh=wb.Sheets[wb.SheetNames[0]];
  if(!sh)throw Error('Sheet pertama kosong.');
  const grid=XLSX.utils.sheet_to_json(sh,{header:1,defval:'',raw:false}).slice(0,1050);
  const index=grid.findIndex(row=>row.some(x=>/^(nama|nama lengkap|nama peserta|nama awardee|awardee)$/i.test(String(x).trim()))&&row.some(x=>/^(status|kehadiran|keterangan|absensi)$/i.test(String(x).trim())));
  if(index<0)throw Error('Baris judul harus memiliki kolom Nama dan Status/Kehadiran.');
  const hdr=grid[index].map(norm),ci=hdr.findIndex(x=>['nama','nama lengkap','nama peserta','nama awardee','awardee'].includes(x)),si=hdr.findIndex(x=>['status','kehadiran','keterangan','absensi'].includes(x));
  const byName=new Map();for(const x of roster){const n=norm(x.nama);if(!byName.has(n))byName.set(n,[]);byName.get(n).push(x);}
  const assignments=new Map(),skipped=[];
  for(const row of grid.slice(index+1)){
   const name=norm(row[ci]);if(!name)continue;
   const people=byName.get(name)||[];
   const raw=norm(row[si]);const status={hadir:'Hadir',h:'Hadir',izin:'Izin',i:'Izin',sakit:'Sakit',s:'Sakit',alpa:'Alpa',a:'Alpa','tidak hadir':'Alpa'}[raw];
   if(people.length!==1||!status){skipped.push(String(row[ci]).slice(0,90));continue}
   if(assignments.has(people[0].id)){skipped.push(String(row[ci]).slice(0,90)+' (duplikat)');continue}
   assignments.set(people[0].id,status);
  }
  if(!assignments.size)throw Error('Tidak ada nama dan status yang cocok persis dengan daftar Awardee.');
  if(!confirm('Terapkan '+assignments.size+' hasil pencocokan ke formulir absensi untuk ditinjau? Belum disimpan ke database.')){output.textContent='Impor dibatalkan.';return}
  document.querySelectorAll('.attendance-status').forEach(el=>{if(assignments.has(el.dataset.id))el.value=assignments.get(el.dataset.id)});
  output.textContent=assignments.size+' status cocok dan sudah dimasukkan ke formulir. '+skipped.length+' baris dilewati'+(skipped.length?': '+skipped.slice(0,5).join(', '):'')+'. Periksa, lalu klik Simpan Absensi.';
  toast('Impor berhasil dipratinjau. Periksa status sebelum menyimpan.','success');
 }catch(err){output.textContent=err.message;toast(err.message,'error')}
}
})();
