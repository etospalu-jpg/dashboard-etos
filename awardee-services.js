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

const demoReport=()=>({
 name:'Awardee Demo',cohort:'2026',
 tahsin:[
  {date:'2026-09-17',confidence:2,practice:'1 kali',lesson:'Memahami cara memperhatikan panjang-pendek bacaan.',challenges:['Panjang dan pendek bacaan'],goal:'Berlatih 10 menit dua kali'},
  {date:'2026-09-24',confidence:3,practice:'2–3 kali',lesson:'Mencoba menerapkan makharijul huruf.',challenges:['Makharijul huruf'],goal:'Latihan makhraj pada bacaan harian'},
  {date:'2026-10-01',confidence:3,practice:'2–3 kali',lesson:'Membaca lebih perlahan dengan tartil.',challenges:['Kelancaran dan tartil'],goal:'Berlatih tiga kali sepekan'},
  {date:'2026-10-08',confidence:4,practice:'4 kali atau lebih',lesson:'Lebih percaya diri menjaga panjang pendek bacaan.',challenges:['Hukum tajwid'],goal:'Mengulang materi mad pekan ini'}
 ],
 kajian:[
  {date:'2026-09-20',agenda:'Kajian Keislaman',memorable:'Konsistensi dalam melakukan kebaikan.',awareness:'Saya perlu memberi waktu untuk refleksi diri.',action_plan:'Menyediakan waktu singkat untuk evaluasi diri setiap malam.'},
  {date:'2026-09-27',agenda:'Kajian Keislaman',memorable:'Pentingnya ikhlas dalam belajar.',awareness:'Saya ingin memperbaiki niat dan kebiasaan belajar.',action_plan:'Membuat satu catatan hal baik setiap pekan.'},
  {date:'2026-10-04',agenda:'Kajian Keislaman',memorable:'Mempraktikkan nilai yang dipelajari.',awareness:'Saya menyadari perlu lebih konsisten.',action_plan:'Menerapkan satu kebiasaan baik yang sederhana.'}
 ]});
function short(value,max=230){const t=String(value||'').trim().replace(/\s+/g,' ');return t.length>max?t.slice(0,max-1)+'…':t;}
function dates(v){try{return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(new Date(v+'T12:00:00+08:00'))}catch{return 'Tanggal tidak diketahui'}}
function emptyReport(label){return '<div class="reflection-empty"><span class="reflection-icon">✦</span><strong>Belum ada '+escape(label)+'</strong><p>Setelah kegiatan dan pengisian melalui link fasilitator, rangkumanmu akan muncul di sini.</p></div>'}
function reportBar(label,n,max,suffix){return '<div class="report-bar-row"><span>'+escape(label)+'</span><div class="report-bar-track"><i style="width:'+Math.max(0,Math.min(100,Math.round(n/Math.max(max,1)*100)))+'%"></i></div><b>'+escape(String(n))+escape(suffix||'')+'</b></div>'}
function renderReport(data){
 const tahsin=(data.tahsin||[]).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
 const kajian=(data.kajian||[]).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
 const count=tahsin.length+kajian.length;
 $('reflection-overview').innerHTML=[
  ['Refleksi Tahsin',tahsin.length],['Refleksi Kajian',kajian.length],['Total refleksi',count]
 ].map(([label,n])=>'<div class="reflection-kpi"><strong>'+n+'</strong><small>'+label+'</small></div>').join('');
 const latestT=tahsin.at(-1),latestK=kajian.at(-1);
 const sentence=count===0?'Perjalanan pembinaanmu siap dicatat. Hadiri kegiatan dan isi refleksi lewat link dari fasilitator agar rangkumanmu tumbuh dari waktu ke waktu.':
 count===1?'Kamu sudah mencatat refleksi pertama. Lanjutkan kebiasaan meninjau pelajaran dan target kecilmu pada kegiatan berikutnya.':
 'Sudah '+count+' refleksi tersimpan. Gunakan catatan yang pernah kamu buat untuk meninjau kembali komitmen, bukan membandingkan pencapaianmu dengan peserta lain.';
 let change='';
 if(tahsin.length>=2){const first=tahsin[0].confidence,last=latestT.confidence;change=' Penilaian kepercayaan dirimu saat Tahsin tercatat '+first+'/5 pada awal dan '+last+'/5 pada catatan terakhir. Ini laporan diri, bukan penilaian kemampuan oleh pengajar.';}
 $('reflection-narrative').textContent=sentence+change;
 const meaningful=latestT?.goal?'Target latihan terakhirmu: '+short(latestT.goal,180):'Setiap latihan kecil memberi kesempatan untuk memperbaiki bacaan.';
 if(!tahsin.length)$('tahsin-report').innerHTML=emptyReport('refleksi Tahsin');
 else if(tahsin.length===1)$('tahsin-report').innerHTML='<div class="reflection-single"><span class="kicker">'+escape(dates(latestT.date))+'</span><h4>Refleksi pertamamu</h4><p>'+escape(short(latestT.lesson))+'</p><div class="reflection-soft">Kepercayaan diri '+escape(latestT.confidence)+'/5 · Latihan '+escape(latestT.practice)+'</div><strong>Target berikutnya</strong><p>'+escape(short(latestT.goal))+'</p></div>';
 else{
  const bars=tahsin.map((t,i)=>reportBar('Pertemuan '+(i+1),Number(t.confidence)||0,5,'/5')).join('');
  const freq=['Belum sempat','1 kali','2–3 kali','4 kali atau lebih'];const counts=freq.map(x=>({key:x,num:tahsin.filter(t=>t.practice===x).length}));
  const peak=Math.max(1,...counts.map(x=>x.num));
  const list=tahsin.map(t=>'<div class="reflection-history-entry"><b>'+escape(dates(t.date))+'</b><p>'+escape(short(t.lesson,350))+'</p><small>Target: '+escape(short(t.goal,220))+'</small></div>').join('');
  $('tahsin-report').innerHTML='<div class="report-chart-grid"><div><h4>Kepercayaan diri per pertemuan</h4><p class="report-hint">Penilaian mandiri, skala 1 sampai 5.</p>'+bars+'</div><div><h4>Konsistensi latihan mandiri</h4><p class="report-hint">Frekuensi yang dilaporkan setiap pertemuan.</p>'+counts.map(x=>reportBar(x.key,x.num,peak,'')).join('')+'</div></div><div class="reflection-soft"><b>Saran untuk pekan berikutnya</b><p>'+escape(meaningful)+'</p></div><details class="reflection-history"><summary>Lihat '+tahsin.length+' catatan Tahsin</summary>'+list+'</details>';
 }
 if(!kajian.length)$('kajian-report').innerHTML=emptyReport('refleksi Kajian');
 else if(kajian.length===1){
  const k=latestK;$('kajian-report').innerHTML='<div class="reflection-single"><span class="kicker">'+escape(dates(k.date))+'</span><h4>Refleksi Kajian pertamamu</h4><p>'+escape(short(k.memorable||k.awareness||k.understanding))+'</p><strong>Langkah yang kamu rencanakan</strong><p>'+escape(short(k.action_plan||'Belum tercatat'))+'</p></div>';
 }else{
  const monthly=new Map();for(const k of kajian){const key=String(k.date||'').slice(0,7)||'Lainnya';monthly.set(key,(monthly.get(key)||0)+1)}
  const values=[...monthly.entries()].slice(-6),high=Math.max(1,...values.map(x=>x[1]));
  const monthBars=values.map(([key,v])=>reportBar(key,v,high,'')).join('');
  const list=kajian.map(k=>'<div class="reflection-history-entry"><b>'+escape(dates(k.date))+'</b><p>'+escape(short(k.memorable||k.awareness||k.understanding,350))+'</p><small>Rencana: '+escape(short(k.action_plan||'Belum tercatat',220))+'</small></div>').join('');
  $('kajian-report').innerHTML='<div class="report-chart-grid"><div><h4>Konsistensi refleksi Kajian</h4><p class="report-hint">Jumlah refleksi yang telah kamu kirim setiap bulan.</p>'+monthBars+'</div><div class="reflection-soft"><h4>Hal yang paling membekas belakangan ini</h4><p>'+escape(short(latestK.memorable||latestK.awareness||latestK.understanding,280))+'</p><h4>Komitmen terakhirmu</h4><p>'+escape(short(latestK.action_plan||'Belum dicatat',280))+'</p></div></div><details class="reflection-history"><summary>Lihat '+kajian.length+' catatan Kajian</summary>'+list+'</details>';
 }
 const nick=String(data.name||'').trim().split(/\s+/)[0]||'Awardee';
 $('awardee-first-name').textContent=nick;
 $('welcome-recommendation').textContent= count?sentence: 'Mulai dari satu bacaan, satu pembelajaran, atau satu refleksi yang bermakna.';
}
async function pullReflectionReport(){
 if(!member())return;
 if(demo()){renderReport(demoReport());return}
 const {data,error}=await sb().rpc('my_learning_reflection_report');
 if(error)throw error;
 renderReport(data||{name:'Awardee',tahsin:[],kajian:[]});
}
async function openPanel(panel){if(!member())return;try{if(panel==='services')await pullServices();if(panel==='tahsin')await pullReflectionReport();}catch(e){if(panel==='services')$('service-history').textContent='Gagal memuat pengajuan: '+e.message;else $('tahsin-report').textContent='Gagal memuat refleksi: '+e.message;}}
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
window.addEventListener('readmap:ready',()=>pullReflectionReport().catch(error=>{$('welcome-recommendation').textContent='Rangkuman refleksi belum dapat dimuat: '+error.message}));
window.addEventListener('readmap:panel',e=>openPanel(e.detail.panel));
})();
