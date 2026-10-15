'use strict';
const crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const session=require('./server-session');
const COOKIE='etos_ski_private';
const ALLOWED=new Set(['fasilitator','espresi','awardee_reminder','prestasi']);
const STATES=new Set(['belum','proses','siap','terkirim','terverifikasi']);
const PERIODS=new Set(['2026-2','2027-1']);
const CODES=new Set(['duta','yic','capacity','coaching','akademik','espresi','pembinaan','penokohan','kualitas','bulanan','publikasi','seleksi','ktg','anggaran','uang_muka','arsip']);
const respond=(res,n,data)=>{res.status(n);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store, max-age=0');res.end(JSON.stringify(data))};
function db(){const key=session.secret();if(!key||!['secret','legacy'].includes(session.kind(key)))throw Object.assign(new Error('Server database belum tersedia.'),{status:503});return createClient(session.PROJECT_URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:session.directFetch}})}
function queryResult(r){if(r.error)throw Object.assign(new Error('Akses data SKI gagal: '+r.error.message),{status:503});return r.data}
function cookie(req,key){const raw=String(req.headers?.cookie||'');const item=raw.split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='));if(!item)return'';try{return decodeURIComponent(item.slice(key.length+1))}catch{return''}}
function pinSessionHash(req){return crypto.createHash('sha256').update(cookie(req,'etos_session')).digest('hex')}
function signature(req,owner,payload){return crypto.createHmac('sha256',session.secret()).update('etos-ski-v1|'+owner.secret_hash+'|'+pinSessionHash(req)+'|'+payload).digest('base64url')}
function authorized(req,owner){const token=cookie(req,COOKIE),[body,sig]=token.split('.');if(!body||!sig)return false;const expected=signature(req,owner,body);if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;try{const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));return p.v===1&&p.exp>Date.now()&&p.exp<=Date.now()+6*60*60*1000}catch{return false}}
function setPrivateCookie(req,res,owner){const body=Buffer.from(JSON.stringify({v:1,exp:Date.now()+2*60*60*1000})).toString('base64url');res.setHeader('Set-Cookie',COOKIE+'='+encodeURIComponent(body+'.'+signature(req,owner,body))+'; Path=/api/secure; HttpOnly; Secure; SameSite=Strict; Max-Age=7200')}
function clearPrivateCookie(res){res.setHeader('Set-Cookie',COOKIE+'=; Path=/api/secure; HttpOnly; Secure; SameSite=Strict; Max-Age=0')}
function hash(pass,salt){return crypto.scryptSync(pass,salt,64,{maxmem:64*1024*1024}).toString('hex')}
function safeUrl(value){const v=String(value||'').trim();if(!v)return null;if(v.length>1200)throw Object.assign(new Error('Tautan terlalu panjang.'),{status:400});try{const u=new URL(v);if(!['https:','http:'].includes(u.protocol))throw Error();return u.href}catch{throw Object.assign(new Error('Bukti harus berupa tautan HTTP(S) valid.'),{status:400})}}
function clean(value,n=1000){return String(value||'').trim().slice(0,n)}
function fail(message,status=400){throw Object.assign(new Error(message),{status})}
function monthValue(p){const v=String(p||'');if(!/^20(26|27)-(0[1-9]|1[0-2])$/.test(v)||v<'2026-07'||v>'2027-06')fail('Bulan di luar periode SKI.');return v+'-01'}
async function snapshot(client){
 const [aw,ac,ach,org,at,att,coach,journal,reports,evid,check,forms,reflect]=await Promise.all([
 client.from('awardees').select('id,status,angkatan'),
 client.from('academic_records').select('awardee_id,ipk,is_summary'),
 client.from('achievements').select('awardee_id,year,level,evidence_url'),
 client.from('organization_records').select('awardee_id'),
 client.from('attendance_sessions').select('id,activity_date').gte('activity_date','2026-07-01').lte('activity_date','2026-12-31'),
 client.from('attendance_records').select('session_id,awardee_id,status'),
 client.from('coaching_sessions').select('awardee_id,session_date,follow_up_plan').gte('session_date','2026-07-01').lte('session_date','2026-12-31'),
 client.from('facilitator_journal_entries').select('id,observed_at'),
 client.from('ski_report_items').select('*').order('month_start',{ascending:false}),
 client.from('ski_evidence').select('*').order('created_at',{ascending:false}),
 client.from('ski_weekly_checks').select('*').order('checked_at',{ascending:false}).limit(1),
 client.from('reflection_forms').select('id,agenda_date'),
 client.from('reflection_responses').select('awardee_id,form_id')
 ]);
 const all=queryResult(aw)||[],active=all.filter(x=>String(x.status||'').trim().toLowerCase()==='aktif'),ids=new Set(active.map(x=>x.id));
 const academics=queryResult(ac)||[],achievements=queryResult(ach)||[],orgs=queryResult(org)||[];
 const sessions=queryResult(at)||[],attendance=queryResult(att)||[],coaches=queryResult(coach)||[], journals=queryResult(journal)||[];
 const sessionIds=new Set(sessions.map(x=>x.id));
 const countDistinct=(arr,fn)=>new Set(arr.filter(x=>ids.has(x.awardee_id)).map(fn||((x)=>x.awardee_id))).size;
 return{metrics:{
 awardeeActive:active.length,cohort2023:active.filter(x=>x.angkatan==='2023').length,cohort2026:active.filter(x=>x.angkatan==='2026').length,
 academicCovered:countDistinct(academics.filter(x=>x.ipk!==null)),
 achievements:achievements.length,achievementNationalAwardees:countDistinct(achievements.filter(x=>x.year===2026&&String(x.level||'').trim().toLowerCase()==='nasional')),
 achievementEvidence:achievements.filter(x=>x.evidence_url).length,
 organizationActive:countDistinct(orgs),attendanceSessions:sessions.length,
 attendanceRecords:attendance.filter(x=>sessionIds.has(x.session_id)).length,
 coachingSessions:coaches.length,coachingAwardees:countDistinct(coaches),
 coachingFollowup:coaches.filter(x=>String(x.follow_up_plan||'').trim()).length,
 journalEntries:journals.length,reflectionForms:(queryResult(forms)||[]).length,reflectionResponses:(queryResult(reflect)||[]).length
 },reports:queryResult(reports)||[],evidence:queryResult(evid)||[],weekly:(queryResult(check)||[])[0]||null,updatedAt:new Date().toISOString(),
 caution:'Angka ringkasan sumber data, bukan persentase SKI. Data semester, kelayakan sasaran, dan bukti wajib diverifikasi.'};
}
module.exports=async function handler(req,res){
 if(req.method!=='POST')return respond(res,405,{success:false,error:'Gunakan POST.'});
 if(!session.originAllowed(req))return respond(res,403,{success:false,error:'Asal permintaan ditolak.'});
 if(!session.verify(req))return respond(res,401,{success:false,error:'Masuk memakai PIN operasional dahulu.'});
 try{
 const client=db(),action=clean(req.body?.params?.action||req.body?.action,32)||'status',payload=req.body?.params?.data||req.body?.data||{};
 const owner=queryResult(await client.from('ski_private_owner').select('*').eq('id',true).maybeSingle());
 if(action==='status')return respond(res,200,{success:true,data:{configured:!!owner,unlocked:!!owner&&authorized(req,owner)}});
 if(action==='setup'){
  if(owner)fail('Kunci SKI sudah disiapkan.',409);
  const pass=String(payload.passphrase||'');if(pass.length<12||pass.length>128)fail('Buat kunci pribadi minimal 12 karakter (maksimal 128).');
  const salt=crypto.randomBytes(24).toString('hex'),digest=hash(pass,salt);
  const r=await client.from('ski_private_owner').insert({id:true,salt,secret_hash:digest});
  if(r.error)fail('Kunci SKI sudah diklaim atau penyimpanan gagal.',409);
  const created={salt,secret_hash:digest};setPrivateCookie(req,res,created);
  return respond(res,200,{success:true,data:{unlocked:true,configured:true}});
 }
 if(!owner)fail('Buat kunci pribadi SKI terlebih dahulu.',409);
 if(action==='unlock'){
  if(owner.locked_until&&new Date(owner.locked_until).getTime()>Date.now())fail('Terlalu banyak percobaan. Coba lagi setelah masa penguncian.',429);
  const pass=String(payload.passphrase||'');if(pass.length>128)fail('Kunci SKI tidak valid.',401);
  const digest=hash(pass,owner.salt);
  if(!crypto.timingSafeEqual(Buffer.from(digest,'hex'),Buffer.from(owner.secret_hash,'hex'))){
   const failed=(Number(owner.failed_attempts)||0)+1;
   await client.from('ski_private_owner').update({failed_attempts:failed>=5?0:failed,locked_until:failed>=5?new Date(Date.now()+15*60*1000).toISOString():null}).eq('id',true);
   fail('Kunci pribadi SKI tidak cocok.',401);
  }
  await client.from('ski_private_owner').update({failed_attempts:0,locked_until:null}).eq('id',true);
  setPrivateCookie(req,res,owner);return respond(res,200,{success:true,data:{unlocked:true}});
 }
 if(action==='lock'){clearPrivateCookie(res);return respond(res,200,{success:true,data:{unlocked:false}})}
 if(!authorized(req,owner))fail('Ruang SKI terkunci. Masukkan kunci pribadi Anda.',403);
 if(action==='overview')return respond(res,200,{success:true,data:await snapshot(client)});
 if(action==='save_report'){
  const kind=clean(payload.kind,50),month=monthValue(payload.month),status=clean(payload.status,24);
  if(!ALLOWED.has(kind)||!STATES.has(status))fail('Jenis laporan atau status tidak dikenal.');
  const proof=safeUrl(payload.proofUrl),notes=clean(payload.notes,2500);
  if(['terkirim','terverifikasi'].includes(status)&&!proof)fail('Status terkirim/terverifikasi wajib memiliki tautan bukti.');
  const body={report_kind:kind,month_start:month,status,notes,proof_url:proof,completed_at:['terkirim','terverifikasi'].includes(status)?new Date().toISOString():null,updated_at:new Date().toISOString()};
  const r=await client.from('ski_report_items').upsert(body,{onConflict:'report_kind,month_start'}).select('*').single();
  return respond(res,200,{success:true,data:queryResult(r)});
 }
 if(action==='save_evidence'){
  const semester=clean(payload.semester,12),code=clean(payload.code,30),title=clean(payload.title,160),notes=clean(payload.notes,2800),proof=safeUrl(payload.evidenceUrl);
  if(!PERIODS.has(semester)||!CODES.has(code)||!title)fail('Indikator, periode, dan judul wajib diisi.');
  if(payload.verified&&!proof&&!notes)fail('Verifikasi membutuhkan tautan atau catatan bukti.');
  let r;
  const body={semester,indicator_code:code,title,notes,evidence_url:proof,is_verified:!!payload.verified,updated_at:new Date().toISOString()};
  if(payload.id){if(!/^[0-9a-f-]{36}$/i.test(String(payload.id)))fail('ID bukti tidak valid.');r=await client.from('ski_evidence').update(body).eq('id',payload.id).select('*').single()}
  else r=await client.from('ski_evidence').insert(body).select('*').single();
  return respond(res,200,{success:true,data:queryResult(r)});
 }
 if(action==='delete_evidence'){
  const id=String(payload.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))fail('ID bukti tidak valid.');
  queryResult(await client.from('ski_evidence').delete().eq('id',id));return respond(res,200,{success:true,data:{deleted:true}});
 }
 fail('Aksi SKI tidak tersedia.',404);
 }catch(e){console.error('[ski-workspace]',e.message);return respond(res,Number(e.status)||500,{success:false,error:e.status?e.message:'Permintaan SKI gagal. Periksa konfigurasi server.'})}
};