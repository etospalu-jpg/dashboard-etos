'use strict';
// READMAP credential distribution: temporary input only; never persist access PINs.
const SUBJECT='Selamat Datang di Dashboard ETOS ID Palu! 💙';
const USERNAME=/^ETOS26-[A-F0-9]{10}$/;
const PIN=/^\d{10}$/;
const norm=s=>String(s??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('id');
const fail=(msg,status=400)=>{const e=new Error(msg);e.status=status;throw e};
const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e||'').trim());

function validate(rows){
 if(!Array.isArray(rows)||rows.length<1||rows.length>50)fail('Masukkan 1–50 baris kredensial READMAP.');
 const seen=new Set();
 return rows.map((r)=>{
  if(!r||typeof r!=='object')fail('Format baris CSV tidak valid.');
  const username=String(r.username||'').trim().toUpperCase();
  const pin=String(r.pin||'').trim();
  const name=String(r.name||'').trim();
  const cohort=String(r.angkatan||'').trim();
  if(!USERNAME.test(username)||!PIN.test(pin)||!name||!cohort)fail('CSV harus memuat nama, angkatan, username, dan PIN yang valid.');
  if(seen.has(username))fail('CSV berisi username duplikat.');
  seen.add(username);
  return {username,pin,name,angkatan:cohort};
 });
}
function body(r){
 return [
  'Assalamu’alaikum warahmatullahi wabarakatuh.','',
  'Halo, '+r.name+'! 👋','',
  'Selamat datang di ekosistem digital ETOS ID Palu! 💙','',
  'Kami mengirimkan akses akun pribadimu untuk menggunakan READMAP, ruang belajar digital untuk mencatat bacaan, melaporkan progres literasi, mengikuti pembelajaran video, serta memantau perkembangan belajarmu.','',
  '🔐 Informasi Akun READMAP',
  'Username: '+r.username,
  'PIN: '+r.pin,'',
  '🌐 Akses Website',
  'Dashboard Utama: https://dashboard.etosidpalu.com',
  'Portal READMAP: https://dashboard.etosidpalu.com/readmap.html','',
  'Silakan masuk ke READMAP menggunakan akun di atas dan jaga kerahasiaan PIN pribadimu.','',
  'Semoga platform ini menjadi ruang untuk terus belajar, konsisten berkembang, dan mengoptimalkan potensi diri.','',
  'Selamat belajar dan bertumbuh bersama ETOS ID Palu! ✨','',
  'Wassalamu’alaikum warahmatullahi wabarakatuh.','',
  'Salam hangat,','',
  'Muhammad Shadiq Muntashir',
  'Team Leader ETOS ID Palu'
 ].join('\n');
}
function escapeHtml(x){return String(x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function html(r){
 const escaped=escapeHtml(body(r)).replace(/https:\/\/dashboard\.etosidpalu\.com(?:\/readmap\.html)?/g, s=>'<a href="'+s+'" style="color:#0d5f91">'+s+'</a>');
 return '<!doctype html><html lang="id"><body style="margin:0;background:#f4f8fc;font-family:Arial,sans-serif;color:#1e293b"><main style="max-width:620px;margin:26px auto;background:#fff;border:1px solid #dce7f1;border-radius:16px;overflow:hidden"><header style="background:#082c4c;color:white;padding:22px 28px"><strong>ETOS ID PALU</strong><p style="margin:7px 0 0">Akses Akun READMAP</p></header><section style="padding:26px;line-height:1.8;font-size:14px;white-space:pre-wrap">'+escaped+'</section></main></body></html>';
}
async function lookup(c, rows, q){
 const [members,awards,contacts]=await Promise.all([
  q('/rest/v1/readmap_memberships?select=awardee_id,username',c),
  q('/rest/v1/awardees?select=id,name,angkatan,status',c),
  q('/rest/v1/awardee_contacts?select=awardee_id,email',c)
 ]);
 if(!Array.isArray(members)||!Array.isArray(awards)||!Array.isArray(contacts))fail('Database READMAP belum dapat diverifikasi.',502);
 const mm=new Map(members.map(m=>[String(m.username||'').toUpperCase(),m]));
 const am=new Map(awards.map(a=>[a.id,a]));
 const cm=new Map(contacts.map(t=>[t.awardee_id,t.email]));
 const result=rows.map(r=>{
  const member=mm.get(r.username),aw=am.get(member?.awardee_id),email=cm.get(aw?.id);
  let reason=null;
  if(!member||!aw)reason='Akun READMAP tidak ditemukan';
  else if(norm(aw.name)!==norm(r.name)||String(aw.angkatan||'')!==r.angkatan)reason='Nama atau angkatan tidak cocok';
  else if(String(aw.status||'').toLowerCase()!=='aktif')reason='Awardee tidak aktif';
  else if(!validEmail(email))reason='Email tidak tersedia';
  return {...r,awardeeId:aw?.id||null,email:reason?null:String(email).trim(),reason};
 });
 const seenEmails=new Set();
 for(const entry of result){
  if(entry.reason)continue;
  const mail=entry.email.toLowerCase();
  if(seenEmails.has(mail)){entry.reason='Email yang sama digunakan untuk beberapa akun';entry.email=null;}
  else seenEmails.add(mail);
 }
 return result;
}
async function prepare(c,p,q){
 const entries=await lookup(c,validate(p.rows),q);
 return {entries,preview:{
  total:entries.length,ready:entries.filter(x=>!x.reason).length,
  blocked:entries.filter(x=>x.reason).length,
  recipients:entries.map(x=>({name:x.name,angkatan:x.angkatan,username:x.username,email:x.email||null,ready:!x.reason,reason:x.reason}))
 }};
}
async function handle(c,p,deps){
 const {entries,preview}=await prepare(c,p,deps.q);
 if(p.action==='preview')return preview;
 if(p.action!=='send')fail('Aksi READMAP tidak dikenal.');
 if(p.confirmed!==true)fail('Konfirmasi pengiriman diperlukan.');
 if(preview.blocked)fail('Pengiriman ditolak: identitas atau email penerima tidak cocok.');
 const token=String(p.clientToken||'').trim();
 if(!/^readmap-[a-zA-Z0-9-]{12,90}$/.test(token))fail('Token pengiriman tidak valid.');
 const already=await deps.q('/rest/v1/email_campaigns?client_token=eq.'+encodeURIComponent(token)+'&select=id,status,accepted_count,failed_count,recipient_count&limit=1',c);
 if(already?.length)return {deduplicated:true,campaign:already[0],preview:{total:preview.total,ready:preview.ready}};
 const [s,st,key]=await Promise.all([deps.settings(c),deps.providerState(c),deps.providerKey(c)]);
 if(!st.ready||!s?.is_enabled||!key)fail('Email Center belum siap mengirim. Periksa domain dan Resend.',409);
 const campRows=await deps.q('/rest/v1/email_campaigns?select=*',c,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify([{
  name:'Distribusi Akun READMAP',
  subject:SUBJECT,
  body_text:'Email personal READMAP. Kredensial tidak disimpan dalam database kampanye.',
  audience_type:'manual',audience_filter:{type:'readmap_access'},context:{type:'readmap_onboarding'},
  mode:'now',status:'sending',recipient_count:entries.length,client_token:token
 }])});
 const campaign=campRows?.[0];if(!campaign?.id)fail('Catatan pengiriman gagal disiapkan.',500);
 const from=String(s.sender_name||'ETOS ID Palu')+' <'+String(s.sender_email||'')+'>';
 const payload=entries.map(r=>({
  from,to:[r.email],subject:SUBJECT,text:body(r),html:html(r),
  ...(s.reply_to?{reply_to:[s.reply_to]}:{}),
  tags:[{name:'campaign_id',value:String(campaign.id).replace(/[^A-Za-z0-9_-]/g,'_')}]
 }));
 let sentIds=[],errorMessage='';
 try{
  const result=await deps.resend('/emails/batch',key,{method:'POST',headers:{'Idempotency-Key':token},body:JSON.stringify(payload)});
  sentIds=Array.isArray(result?.data)?result.data:Array.isArray(result)?result:[];
  if(sentIds.length!==entries.length)errorMessage='Penyedia menerima respons yang tidak lengkap; periksa status pengiriman sebelum mencoba ulang.';
 }catch(_){errorMessage='Penyedia email gagal menerima permintaan. Periksa status Resend sebelum mencoba ulang.';}
 const accepted=!errorMessage;
 const deliveries=entries.map((r,i)=>({
  campaign_id:campaign.id,awardee_id:r.awardeeId,recipient_name:r.name,recipient_email:r.email,
  status:accepted?'accepted':'failed',
  provider_email_id:sentIds[i]?.id||null,
  ...(accepted?{sent_at:new Date().toISOString()}:{}),
  last_event:accepted?'accepted':'failed',
  last_event_at:new Date().toISOString(),
  ...(errorMessage?{error_message:errorMessage}:{}),
  metadata:{channel:'readmap_access'}
 }));
 await deps.q('/rest/v1/email_deliveries',c,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(deliveries)});
 const status=accepted?'sent':'failed';
 await deps.q('/rest/v1/email_campaigns?id=eq.'+encodeURIComponent(campaign.id),c,{
  method:'PATCH',headers:{Prefer:'return=minimal'},
  body:JSON.stringify({status,accepted_count:accepted?entries.length:0,failed_count:accepted?0:entries.length,
   sent_at:accepted?new Date().toISOString():null,updated_at:new Date().toISOString()})
 });
 return {campaignId:campaign.id,accepted:accepted?entries.length:0,failed:accepted?0:entries.length,
  status,notice:accepted?'Permintaan email diterima penyedia. Status terkirim ke inbox menunggu konfirmasi penyedia.':errorMessage};
}
module.exports={validate,prepare,handle,SUBJECT,body};
