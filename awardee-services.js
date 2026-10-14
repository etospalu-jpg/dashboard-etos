/* ETOS awardee services and attendance-gated Tahsin journal. */
(()=>{'use strict';
const $=id=>document.getElementById(id),bridge=()=>window.ETOS_AWARDEE_BRIDGE;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const topics={
 mind_mate:['Akademik dan tekanan perkuliahan','Adaptasi, relasi, dan kehidupan pribadi','Butuh teman untuk berbagi','Topik pribadi lainnya'],
 research_clinic:['Mencari ide atau topik riset','Proposal dan metodologi','Pengolahan dan analisis data','Penulisan artikel atau karya ilmiah','Lainnya']
};
let requests=[],tahsin=[],responses=[],loaded={services:false,tahsin:false},busy=false;
const demo=()=>bridge()?.getIsDemo();
const member=()=>bridge()?.getAwardee();
const sb=()=>bridge()?.client;
function feedback(id,msg,ok=false){const el=$(id);el.textContent=msg;el.classList.toggle('is-ok',ok)}
function fmt(date){return date?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(new Date(date+'T12:00:00+08:00')):'Tanggal belum tersedia'}
async function pullServices(){
 if(demo()){
  requests=[{id:'contoh-1',service_type:'research_clinic',topic:'Proposal dan metodologi',status:'Dalam Tindak Lanjut',created_at:new Date().toISOString()}];
 }else if(member()){
  const {data,error}=await sb().from('awardee_service_requests').select('id,service_type,topic,status,admin_note,created_at').eq('awardee_id',member()).order('created_at',{ascending:false}).limit(50);
  if(error)throw error;requests=data||[];
 }
 $('service-history').innerHTML=requests.length?requests.map(r=>'<div class="service-history-item"><div><strong>'+escape(r.service_type==='mind_mate'?'Mind Mate':'ETOS Research Clinic')+'</strong><small>'+escape(r.topic)+' · '+escape(new Date(r.created_at).toLocaleDateString('id-ID'))+'</small></div><span class="service-status">'+escape(r.status)+'</span>'+(r.admin_note?'<p class="service-admin-note">Tindak lanjut: '+escape(r.admin_note)+'</p>':'')+'</div>').join(''):'<div class="empty-state"><span class="empty-icon">♡</span><strong>Belum ada pengajuan</strong><p>Ajukan layanan ketika kamu membutuhkannya. Statusnya bisa dipantau di sini.</p></div>';
 loaded.services=true;
}
async function pullTahsin(){
 if(demo()){
  tahsin=[{session_id:'demo-tahsin-1',activity_name:'Tahsin Al-Qur’an',activity_date:'2026-10-12',reflection_submitted:true,previous_goal:null},{session_id:'demo-tahsin-2',activity_name:'Tahsin Al-Qur’an',activity_date:'2026-10-19',reflection_submitted:false,previous_goal:'Berlatih panjang-pendek bacaan 10 menit sehari'}];
  responses=[{session_id:'demo-tahsin-1',confidence:3,practice_frequency:'2–3 kali',improvement_goal:'Berlatih panjang-pendek bacaan 10 menit sehari'}];
 }else if(member()){
  const [one,two]=await Promise.all([sb().rpc('my_tahsin_sessions'),sb().from('tahsin_weekly_reflections').select('session_id,confidence,practice_frequency,improvement_goal').eq('awardee_id',member())]);
  if(one.error)throw one.error;if(two.error)throw two.error;tahsin=one.data||[];responses=two.data||[];
 }
 $('tahsin-sessions').innerHTML=tahsin.length?tahsin.map(t=>{
  const recorded=responses.find(x=>x.session_id===t.session_id);
  return '<div class="tahsin-session"><div><strong>'+escape(t.activity_name)+'</strong><small>'+escape(fmt(t.activity_date))+' · Kehadiran: Hadir</small><span class="service-status">'+(t.reflection_submitted?'Refleksi tercatat':'Menunggu refleksi')+'</span>'+(recorded?'<small>Kepercayaan diri: '+recorded.confidence+'/5 · Latihan: '+escape(recorded.practice_frequency)+'</small>':'')+'</div><button type="button" data-open-tahsin="'+escape(t.session_id)+'">'+(t.reflection_submitted?'Lihat / perbarui':'Isi Refleksi')+'</button></div>';
 }).join(''):'<div class="empty-state"><span class="empty-icon">✧</span><strong>Belum ada pertemuan Tahsin</strong><p>Setelah absensi Tahsin dicatat dan kamu berstatus Hadir, refleksinya akan muncul di sini. Link dari fasilitator juga akan membawamu ke pertemuan tersebut.</p></div>';
 loaded.tahsin=true;
}
async function openPanel(panel){
 if(!member())return;
 try{
  if(panel==='services')await pullServices();
  if(panel==='tahsin'){await pullTahsin();const q=new URLSearchParams(location.search).get('tahsin');if(q&&tahsin.some(t=>t.session_id===q))openTahsin(q)}
 }catch(e){if(panel==='services')$('service-history').textContent='Gagal memuat pengajuan: '+e.message;else $('tahsin-sessions').textContent='Gagal memuat Tahsin: '+e.message;}
}
function openRequest(service){
 const research=service==='research_clinic';
 $('service-type').value=service;
 $('service-dialog-title').textContent=research?'Ajukan ETOS Research Clinic':'Ajukan Mind Mate';
 $('service-dialog-note').textContent=research?'Ceritakan kebutuhan risetmu. Pengelola akan menghubungi dan mengatur pendampingan sesuai ketentuan yang disepakati.':'Ruang dukungan sebaya bersama ter.rangkum. Ceritakan seperlunya saja; tidak perlu membagikan informasi yang terlalu pribadi.';
 $('service-topic').innerHTML=topics[service].map(x=>'<option>'+escape(x)+'</option>').join('');
 $('research-doc-wrap').hidden=!research;
 $('service-dialog').hidden=false;
 $('service-topic').focus();
}
function closeRequest(){$('service-dialog').hidden=true;feedback('service-feedback','');}
function openTahsin(id){
 const t=tahsin.find(x=>x.session_id===id);if(!t)return;
 $('tahsin-session').value=id;$('tahsin-form-title').textContent='Refleksi '+t.activity_name;
 $('tahsin-form-date').textContent=fmt(t.activity_date);
 $('tahsin-previous-wrap').hidden=!t.previous_goal;
 $('tahsin-previous-label').textContent=t.previous_goal?'Target pekan sebelumnya: '+t.previous_goal:'';
 $('tahsin-form').reset();$('tahsin-form-card').hidden=false;
 feedback('tahsin-feedback','');
 $('tahsin-form-card').scrollIntoView({behavior:'smooth',block:'start'});
}
document.querySelectorAll('[data-service-open]').forEach(b=>b.addEventListener('click',()=>openRequest(b.dataset.serviceOpen)));
$('service-close').addEventListener('click',closeRequest);
$('service-dialog').addEventListener('click',e=>{if(e.target===$('service-dialog'))closeRequest()});
$('service-form').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;
 busy=true;const btn=$('service-send');btn.disabled=true;
 try{
  if(demo())throw Error('Mode Demo hanya untuk contoh. Masuk ke akun Awardee untuk mengajukan layanan.');
  const type=$('service-type').value,topic=$('service-topic').value;
  const doc=$('research-doc').value.trim();
  if(doc&&!/^https:\/\//i.test(doc))throw Error('Tautan dokumen harus dimulai dengan https://');
  const payload={awardee_id:member(),service_type:type,topic,details:$('service-detail').value.trim()||null,
   meeting_method:$('service-method').value,preferred_time:$('service-time').value.trim()||null,document_url:type==='research_clinic'?doc||null:null};
  const {error}=await sb().from('awardee_service_requests').insert(payload);
  if(error)throw error;
  $('service-form').reset();closeRequest();await pullServices();bridge()?.notify('Pengajuan berhasil dikirim. Statusnya dapat dipantau di Layanan.');
 }catch(err){feedback('service-feedback',err.message)}
 finally{busy=false;btn.disabled=false}
});
$('tahsin-sessions').addEventListener('click',e=>{const b=e.target.closest('[data-open-tahsin]');if(b)openTahsin(b.dataset.openTahsin)});
$('tahsin-form').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;
 busy=true;const btn=$('tahsin-send');btn.disabled=true;
 try{
  if(demo())throw Error('Mode Demo tidak mengirim refleksi asli. Masuk menggunakan akun Awardee.');
  const payload={p_session:$('tahsin-session').value,p_lesson:$('tahsin-lesson').value.trim(),
   p_challenges:[...document.querySelectorAll('[name=tahsin-challenge]:checked')].map(x=>x.value),
   p_confidence:Number($('tahsin-confidence').value),p_practice:$('tahsin-practice').value,
   p_goal:$('tahsin-goal').value.trim(),p_previous:$('tahsin-previous-wrap').hidden?null:$('tahsin-previous').value||null};
  const {error}=await sb().rpc('submit_my_tahsin_reflection',payload);if(error)throw error;
  feedback('tahsin-feedback','Refleksi berhasil disimpan. Terima kasih sudah bertumbuh!',true);
  await pullTahsin();bridge()?.notify('Refleksi Tahsin tersimpan untuk pertemuan ini.');
  $('tahsin-form-card').hidden=true;
 }catch(err){feedback('tahsin-feedback',err.message)}
 finally{busy=false;btn.disabled=false}
});
window.addEventListener('readmap:ready',()=>{
 if(!member())return;
 const deep=new URLSearchParams(location.search).get('tahsin');
 if(deep){bridge().openPanel('tahsin');$('tahsin-panel').scrollIntoView({behavior:'smooth',block:'start'});}
});
window.addEventListener('readmap:panel',e=>openPanel(e.detail.panel));
})();
