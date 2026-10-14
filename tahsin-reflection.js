(()=>{'use strict';
const $=id=>document.getElementById(id);
const message=(str,bad=false)=>{const el=$('message');el.textContent=str;el.className=str?'status'+(bad?' error':''):'';el.hidden=!str};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pathCode=location.pathname.match(/^\/t\/([0-9a-f]{12})\/?$/i)?.[1];
const reference=pathCode||new URLSearchParams(location.search).get('session')||new URLSearchParams(location.search).get('code')||'';
let participant=null,session=null,priorGoal=null,verifiedSuffix='';
function date(v){return v?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(new Date(v+'T12:00:00+08:00')):'Tanggal belum tersedia'}
async function api(action,data={}){
 const res=await fetch('/api/public-attendance',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action:'tahsin_data',params:{action,reference,...data}})});
 const body=await res.json().catch(()=>({success:false,error:'Respons layanan tidak valid.'}));
 if(!res.ok||body?.success===false)throw new Error(body?.error||'Tidak dapat memproses refleksi.');
 return body.data;
}
async function load(){
 if(!(/^([a-f0-9]{12}|[a-f0-9-]{36})$/i.test(reference))){message('Link refleksi Tahsin tidak valid. Minta link baru dari fasilitator.',true);return}
 message('Menyiapkan formulir Tahsin…');
 const data=await api('form');
 session=data;
 const people=Array.isArray(data.participants)?data.participants:[];
 $('session-title').textContent=data.title||'Tahsin Al-Qur’an';
 $('session-date').textContent=date(data.date);
 $('participant').innerHTML='<option value="">Pilih namamu</option>'+people.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' — '+esc(p.cohort||'')+'</option>').join('');
 if(!people.length){
  message('Belum ada peserta dengan status Hadir pada sesi ini. Hubungi fasilitator untuk memeriksa absensi.',true);
  return;
 }
 $('identity-card').hidden=false;message('');
}
$('identity-form').addEventListener('submit',async e=>{
 e.preventDefault();
 const btn=$('verify-button');btn.disabled=true;
 try{
  const id=$('participant').value,wa=$('wa-last4').value.trim();
  if(!id||!/^[0-9]{4}$/.test(wa))throw Error('Pilih nama dan isi tepat 4 digit terakhir WhatsApp.');
  message('Memverifikasi kehadiran dan WhatsApp…');
  const result=await api('verify',{awardeeId:id,waLast4:wa});
  participant=id;verifiedSuffix=wa;priorGoal=result.previousGoal||null;
  $('session-title').textContent=result.title||'Tahsin Al-Qur’an';
  $('session-date').textContent=date(result.date);
  $('participant-name').textContent='Peserta: '+(result.participant?.name||'Awardee')+' · Terverifikasi Hadir';
  $('previous-wrap').hidden=!priorGoal;$('previous').required=Boolean(priorGoal);
  if(priorGoal)$('previous-goal').textContent='Target pertemuan sebelumnya: '+priorGoal;
  const old=result.existing;
  if(old){
   $('lesson').value=old.lesson||'';$('goal').value=old.improvement_goal||'';
   $('confidence').value=old.confidence||3;$('practice').value=old.practice_frequency||'2–3 kali';
   $('previous').value=old.previous_goal_review||'';
   document.querySelectorAll('[name=challenge]').forEach(c=>c.checked=(old.challenges||[]).includes(c.value));
  }
  $('identity-card').hidden=true;$('reflection-card').hidden=false;message('');
  $('reflection-card').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(err){message(err.message,true)}
 finally{btn.disabled=false}
});
$('reflection-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!participant)return;
 const button=$('submit-reflection');button.disabled=true;
 try{
  const payload={awardeeId:participant,waLast4:verifiedSuffix,
   lesson:$('lesson').value.trim(),
   challenges:[...document.querySelectorAll('[name=challenge]:checked')].map(x=>x.value),
   confidence:Number($('confidence').value),practice:$('practice').value,
   goal:$('goal').value.trim(),previousReview:priorGoal?$('previous').value:null};
  message('Menyimpan refleksi…');
  const outcome=await api('submit',payload);
  verifiedSuffix='';$('wa-last4').value='';
  $('reflection-card').hidden=true;$('complete-card').hidden=false;
  $('complete-card').querySelector('h2').textContent='Terima kasih, '+(outcome.name||'Awardee')+'! ✦';
  message('Refleksimu sudah tersimpan.');window.scrollTo({top:0,behavior:'smooth'});
 }catch(err){message(err.message,true)}
 finally{button.disabled=false}
});
load().catch(e=>message(e.message,true));
})();