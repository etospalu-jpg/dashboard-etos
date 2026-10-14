(()=>{'use strict';
const $=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses=['Diajukan','Dalam Tindak Lanjut','Perlu Konfirmasi','Dijadwalkan','Selesai','Dibatalkan'];
async function api(action,params={}){
 const r=await fetch('/api/secure',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({function:'readmapAdmin',params:{action,...params}})});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Gagal menghubungi server');return d;
}
async function loadServices(){
 $('admin-service-list').textContent='Memuat pengajuan…';
 try{
  const {requests=[]}=await api('awardeeServices');
  $('admin-service-counts').innerHTML=[['Total pengajuan',requests.length],['Perlu tindak lanjut',requests.filter(x=>!['Selesai','Dibatalkan'].includes(x.status)).length],['Mind Mate',requests.filter(x=>x.service_type==='mind_mate').length]].map(([k,v])=>'<div class="metric"><b>'+v+'</b><small>'+escape(k)+'</small></div>').join('');
  $('admin-service-list').innerHTML=requests.length?requests.map(r=>'<article class="item"><div class="toolbar"><div><strong>'+escape(r.awardee_name)+' · '+escape(r.service_type==='mind_mate'?'Mind Mate':'ETOS Research Clinic')+'</strong><small>'+escape(r.topic)+' · '+new Date(r.created_at).toLocaleDateString('id-ID')+'</small></div><span class="service-status">'+escape(r.status)+'</span></div>'+
   (r.details?'<p>'+escape(r.details)+'</p>':'')+
   '<p><small>Metode: '+escape(r.meeting_method||'Fleksibel')+' · Waktu: '+escape(r.preferred_time||'Belum dipilih')+'</small></p>'+
   (r.document_url?'<p><a href="'+escape(r.document_url)+'" target="_blank" rel="noopener noreferrer">Buka dokumen riset ↗</a></p>':'')+
   '<div class="admin-service-edit"><label>Status<select data-service-status="'+escape(r.id)+'">'+statuses.map(x=>'<option '+(x===r.status?'selected':'')+'>'+escape(x)+'</option>').join('')+'</select></label><label>Catatan tindak lanjut (opsional)<textarea maxlength="1500" rows="2" data-service-note="'+escape(r.id)+'">'+escape(r.admin_note||'')+'</textarea></label><button data-service-save="'+escape(r.id)+'">Simpan Tindak Lanjut</button></div></article>').join(''):'<p>Belum ada pengajuan layanan.</p>';
 }catch(e){$('admin-service-list').textContent='Tidak dapat memuat pengajuan: '+e.message}
}
$('admin-service-list').addEventListener('click',async e=>{
 const button=e.target.closest('[data-service-save]');if(!button)return;button.disabled=true;
 const id=button.dataset.serviceSave;
 try{
  await api('updateAwardeeService',{id,status:[...document.querySelectorAll('[data-service-status]')].find(x=>x.dataset.serviceStatus===id)?.value,note:[...document.querySelectorAll('[data-service-note]')].find(x=>x.dataset.serviceNote===id)?.value||''});
  button.textContent='Tersimpan ✓';setTimeout(()=>{button.textContent='Simpan Tindak Lanjut';button.disabled=false},1400);
 }catch(err){alert('Status belum tersimpan: '+err.message);button.disabled=false}
});
async function loadTahsin(){
 $('admin-tahsin-list').textContent='Memuat pertemuan…';
 try{
  const d=await api('tahsinOverview');
  $('admin-tahsin-list').innerHTML=d.sessions?.length?d.sessions.map(x=>'<article class="item"><strong>'+escape(x.name)+'</strong><small>'+escape(x.date)+' · '+x.submitted+' dari '+x.attendees+' peserta hadir mengisi refleksi</small><div class="toolbar"><input type="text" readonly value="'+escape(location.origin+x.link)+'" data-tahsin-url="'+escape(x.id)+'" style="max-width:75%"><button class="secondary" data-tahsin-copy="'+escape(x.id)+'">Salin Link Refleksi</button></div>'+(x.missing?.length?'<p><small>Belum mengisi: '+x.missing.map(escape).join(', ')+'</small></p>':'')+'</article>').join(''):'<p>Belum ada absensi Tahsin. Simpan absensi dari menu Absensi, lalu link refleksi akan tersedia otomatis.</p>';
  $('admin-tahsin-answers').innerHTML=d.responses?.length?d.responses.map(x=>'<article class="item"><strong>'+escape(x.awardee_name)+'</strong><small>Kepercayaan diri '+x.confidence+'/5 · Latihan '+escape(x.practice_frequency)+' · '+new Date(x.submitted_at).toLocaleDateString('id-ID')+'</small><p>'+escape(x.lesson)+'</p><small>Fokus perbaikan: '+escape((x.challenges||[]).join(', '))+'</small><p><small>Target: '+escape(x.improvement_goal)+'</small></p>'+(x.previous_goal_review?'<small>Evaluasi target lalu: '+escape(x.previous_goal_review)+'</small>':'')+'</article>').join(''):'<p>Belum ada jawaban refleksi Tahsin.</p>';
 }catch(err){$('admin-tahsin-list').textContent='Tidak dapat memuat Tahsin: '+err.message}
}
$('admin-tahsin-list').addEventListener('click',async e=>{const b=e.target.closest('[data-tahsin-copy]');if(!b)return;const input=[...document.querySelectorAll('[data-tahsin-url]')].find(x=>x.dataset.tahsinUrl===b.dataset.tahsinCopy);if(!input)return;try{await navigator.clipboard.writeText(input.value);b.textContent='Tersalin ✓';}catch{input.select();document.execCommand('copy');b.textContent='Silakan salin link';}});
$('reload-services').addEventListener('click',loadServices);
$('reload-tahsin').addEventListener('click',loadTahsin);
loadServices();loadTahsin();
})();