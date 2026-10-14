/* ETOS ID Palu — private Awardee academic and writing journey */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const sb=window.supabase?.createClient('https://weklmapqizeldfdalbgs.supabase.co','sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'etos-readmap-auth-v1'}});
const origin='https://dashboard.etosidpalu.com/tulisan/';
const n=value=>Number.isFinite(Number(value))?Number(value):0;
const format=value=>n(value).toLocaleString('id-ID');
const ip=value=>Number.isFinite(Number(value))?Number(value).toFixed(2).replace('.',','):'—';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const initials=name=>String(name||'E').trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0)).join('').toUpperCase()||'E';
function error(text){
 $('profile-loading').hidden=true;$('profile-main').hidden=true;$('profile-error').hidden=false;
 $('profile-error-detail').textContent=text||'Masuk menggunakan akun Ruang Awardee untuk melihat data pribadimu.';
}
function renderIdentity(a){
 $('identity-name').textContent=a.name||'Awardee ETOS';
 $('identity-initial').textContent=initials(a.name);
 $('identity-major').textContent=a.major||'Program studi belum tercatat';
 $('identity-campus').textContent=a.campus||'Kampus belum tercatat';
 $('identity-cohort').textContent='Angkatan '+(a.cohort||'—');
 $('identity-status').textContent=a.status||'Awardee';
 $('identity-motto').textContent=a.motto||'Setiap langkah memiliki ceritanya sendiri.';
 const photo=String(a.photo_url||'');
 if(/^https:\/\//i.test(photo)){
  const img=$('identity-img');img.src=photo;
  img.onload=()=>{$('identity-initial').hidden=true;img.hidden=false};
  img.onerror=()=>{img.hidden=true;$('identity-initial').hidden=false};
 }
}
function renderStatistics(s,semesters,summary){
 $('stat-writing').textContent=format(s.published_articles);
 $('stat-draft').textContent=format(s.draft_articles)+' draf tersimpan';
 $('stat-books').textContent=format(s.total_books);
 $('stat-pages').textContent=format(s.pages_read)+' halaman dilaporkan';
 $('stat-achievements').textContent=format(s.achievements);
 const latest=semesters.at(-1);
 $('stat-lastip').textContent=latest?ip(latest.ip):summary?ip(summary.value):'—';
 $('stat-semester').textContent=latest?'Semester '+latest.semester:summary?('Rekap Semester '+(summary.label||'1–8')):'Belum ada nilai semester';
}
function academicChart(raw,summary){
 const root=$('ip-chart');
 const sem=[...new Map((Array.isArray(raw)?raw:[]).filter(x=>
  Number.isInteger(Number(x.semester))&&Number(x.semester)>=1&&Number(x.semester)<=12&&Number(x.ip)>=0&&Number(x.ip)<=4&&x.ip!==null
 ).map(x=>[Number(x.semester),{semester:Number(x.semester),ip:Number(x.ip)}])).values()].sort((a,b)=>a.semester-b.semester);
 const summaryEl=$('academic-summary');
 if(summary&&summary.value!==null&&Number.isFinite(Number(summary.value))){
  summaryEl.hidden=false;
  const label=String(summary.label||'Rekap Akademik');
  summaryEl.innerHTML='<strong>'+ip(summary.value)+'</strong> Rekap IPK '+esc(label)+'. Nilai rekap tidak diperlakukan sebagai nilai setiap semester.';
 }else summaryEl.hidden=true;
 if(!sem.length){
  $('academic-range').textContent='Belum ada grafik semester';
  root.innerHTML='<div class="graph-empty">Nilai per semester belum tersedia pada catatan akademikmu.'+(summary?' Nilai rekap yang tersedia ditampilkan di bawah ini.':' Pembaruan akan tampil otomatis setelah dimasukkan pengelola.')+'</div>';
  root.setAttribute('aria-label','Belum ada nilai IP per semester');
  return sem;
 }
 const width=740,height=280,left=54,right=18,top=20,bottom=45,w=width-left-right,h=height-top-bottom;
 const maxSem=Math.max(6,...sem.map(x=>x.semester)),minSem=1;
 const x=s=>left+(s-minSem)/(maxSem-minSem)*w;
 const y=value=>top+(4-value)/4*h;
 let grid='',ticks='',segments='';
 for(let val=0;val<=4;val++){const py=y(val);grid+='<line x1="'+left+'" y1="'+py+'" x2="'+(left+w)+'" y2="'+py+'" stroke="#e6edf5" stroke-width="1" />';ticks+='<text x="'+(left-14)+'" y="'+(py+4)+'" text-anchor="end">'+val.toFixed(1)+'</text>'}
 for(let sm=1;sm<=maxSem;sm++)ticks+='<text x="'+x(sm)+'" y="'+(top+h+29)+'" text-anchor="middle">'+sm+'</text>';
 for(let i=1;i<sem.length;i++){
  const prev=sem[i-1],current=sem[i];
  if(current.semester-prev.semester!==1)continue;
  segments+='<line x1="'+x(prev.semester)+'" y1="'+y(prev.ip)+'" x2="'+x(current.semester)+'" y2="'+y(current.ip)+'" stroke="#2b68af" stroke-width="3.5" stroke-linecap="round" />';
 }
 const points=sem.map(r=>'<circle cx="'+x(r.semester)+'" cy="'+y(r.ip)+'" r="5.8" fill="#fff" stroke="#2867ac" stroke-width="3"><title>Semester '+r.semester+': '+ip(r.ip)+'</title></circle>').join('');
 root.innerHTML='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Grafik IP semester dari semester 1 sampai '+maxSem+'" focusable="false">'+grid+ticks+'<text x="'+(left+w/2)+'" y="'+(height-5)+'" text-anchor="middle" font-size="11">Semester</text>'+segments+points+'</svg>'+
 '<div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:11px">'+sem.map(row=>'<span style="display:inline-flex;gap:7px;align-items:center;padding:6px 10px;border:1px solid #dce7f2;border-radius:8px;font-size:10px;color:#426283;background:#f8fbfe">S'+row.semester+' <strong style="color:#1e5899">'+ip(row.ip)+'</strong></span>').join('')+'</div>';
 root.setAttribute('aria-label','IP per semester: '+sem.map(r=>'Semester '+r.semester+', '+ip(r.ip)).join('; '));
 $('academic-range').textContent='Semester '+sem[0].semester+' – '+sem.at(-1).semester;
 return sem;
}
function writings(items){
 const parent=$('recent-writings'),articles=Array.isArray(items)?items:[];
 if(!articles.length){parent.innerHTML='<div class="recent-empty">Belum ada tulisan terbit. Kamu bisa mulai menulis kapan saja di Ruang Gagasan.</div>';return}
 parent.innerHTML=articles.map(a=>'<a href="'+origin+encodeURIComponent(String(a.id))+'"><strong>'+esc(a.title||'Tulisan tanpa judul')+'</strong><span>Artikel terbit · Buka dan bagikan ↗</span></a>').join('');
}
async function run(){
 if(!sb)return error('Layanan akun belum tersedia. Muat ulang halaman.');
 try{
  const auth=await sb.auth.getUser();
  if(auth.error||!auth.data?.user)return error('Masuk menggunakan akun Ruang Awardee untuk membuka profil akademik pribadi.');
  const {data,error:rpcError}=await sb.rpc('awardee_self_snapshot');
  if(rpcError){return error('Profil akademik belum dapat dimuat. Fitur ini membutuhkan integrasi profil yang sedang disiapkan pengelola.')}
  if(!data||!data.identity)return error('Data profil belum tersedia untuk akun ini.');
  renderIdentity(data.identity);
  const semesterData=academicChart(data.semesters,data.academic_summary);
  renderStatistics(data.stats||{},semesterData,data.academic_summary);
  writings(data.recent_writings);
  $('profile-loading').hidden=true;$('profile-error').hidden=true;$('profile-main').hidden=false;
 }catch(e){error('Terjadi gangguan ketika memuat data pribadimu. Silakan coba kembali.')}
}
run();
})();