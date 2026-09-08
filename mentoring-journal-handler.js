const session=require('./server-session');
function json(res,status,body){res.status(status).setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
function bad(message,status=400){const e=new Error(message);e.status=status;throw e}
async function supa(path,c,options={}){const r=await fetch(session.PROJECT_URL+path,{...options,headers:{...session.dbHeaders(c),...(options.headers||{})}});const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!r.ok){const e=new Error(body?.message||body?.error_description||body?.error||`Supabase ${r.status}`);e.status=r.status;throw e}return body}
async function profileFor(c){if(c?.server)return{user:{id:null},profile:{full_name:'ETOS ID Palu Superadmin',role:'superadmin',is_active:true}};const user=await supa('/auth/v1/user',c);const rows=await supa(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,role,is_active`,c);const profile=rows?.[0];if(!profile?.is_active)bad('Akun belum aktif atau tidak memiliki akses.',403);return{user,profile}}
const DEV=new Set(['superadmin','admin','facilitator']);
function allow(role){if(!DEV.has(String(role||'').toLowerCase()))bad('Role ini tidak memiliki izin untuk Jurnal Pendampingan.',403)}
async function caseRow(ref,c){const id=String(ref||'').trim();if(!id)return null;const filter=/^CASE-/i.test(id)?`legacy_id=eq.${encodeURIComponent(id)}`:`id=eq.${encodeURIComponent(id)}`;const rows=await supa(`/rest/v1/mentoring_cases?${filter}&select=id,awardee_id`,c);return rows?.[0]||null}
module.exports=async function handleMentoringJournal(req,res){try{
 const c=session.credential(req);if(!c)return json(res,401,{success:false,error:'Akses operasional diperlukan.'});const{user,profile}=await profileFor(c);allow(profile.role);
 const fn=String(req.body?.function||''),p=req.body?.params||{};
 if(fn==='getMentoringJournal'){
  const mc=await caseRow(p.case_id||p.caseId,c);if(!mc)return json(res,404,{success:false,error:'Case pendampingan tidak ditemukan.'});
  const rows=await supa(`/rest/v1/mentoring_journal?mentoring_case_id=eq.${mc.id}&select=id,session_date,progress_note,intervention,awardee_response,follow_up_plan,next_follow_up,status_after,created_at,updated_at&order=session_date.desc,created_at.desc`,c);
  return json(res,200,{success:true,data:rows||[]});
 }
 if(fn==='saveMentoringJournal'){
  const mc=await caseRow(p.case_id||p.caseId,c);if(!mc)return json(res,404,{success:false,error:'Case pendampingan tidak ditemukan.'});const note=String(p.progress_note||'').trim();if(!note)bad('Catatan perkembangan wajib diisi.');
  const row={mentoring_case_id:mc.id,awardee_id:mc.awardee_id,session_date:p.session_date||new Date().toISOString().slice(0,10),progress_note:note,intervention:String(p.intervention||'').trim()||null,awardee_response:String(p.awardee_response||'').trim()||null,follow_up_plan:String(p.follow_up_plan||'').trim()||null,next_follow_up:p.next_follow_up||null,status_after:String(p.status_after||'').trim()||null,created_by:user.id||null,updated_by:user.id||null};
  const data=await supa('/rest/v1/mentoring_journal?select=id,session_date,progress_note,intervention,awardee_response,follow_up_plan,next_follow_up,status_after,created_at',c,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify([row])});
  if(row.status_after)await supa(`/rest/v1/mentoring_cases?id=eq.${mc.id}`,c,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:row.status_after,updated_by:user.id||null,updated_at:new Date().toISOString()})});
  return json(res,200,{success:true,data:data?.[0]||null});
 }
 return json(res,404,{success:false,error:'Fungsi jurnal tidak ditemukan.'});
}catch(err){console.error('[mentoring-journal]',err);return json(res,err?.status||500,{success:false,error:err?.message||String(err)})}};
