const PROJECT_URL='https://weklmapqizeldfdalbgs.supabase.co';
const KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const AUTHORITY=require('../awardee-authority.json');
const AUDIT=require('../data-audit-manifest.json');
const CUTOVER='2026-09-07';
function out(res,status,body){res.status(status).setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
function token(req){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim()}
async function q(path,t){const r=await fetch(PROJECT_URL+path,{headers:{apikey:KEY,Authorization:`Bearer ${t}`}});const text=await r.text();let b=null;try{b=text?JSON.parse(text):null}catch{b=text}if(!r.ok)throw new Error(b?.message||b?.error||`Supabase ${r.status}`);return b}
async function identity(t){const u=await q('/auth/v1/user',t);const p=await q(`/rest/v1/profiles?id=eq.${encodeURIComponent(u.id)}&select=id,role,is_active`,t);if(!p?.[0]?.is_active)throw new Error('Akun belum aktif.');return p[0]}
async function resolveAwardee(ref,t){const v=String(ref||'').trim();if(!v)return null;let rows=[];if(/^AWD-/i.test(v))rows=await q(`/rest/v1/awardees?legacy_id=eq.${encodeURIComponent(v.toUpperCase())}&select=*`,t);else rows=await q(`/rest/v1/awardees?id=eq.${encodeURIComponent(v)}&select=*`,t);return rows?.[0]||null}
function nonblank(v){return v!==null&&v!==undefined&&String(v).trim()!==''}
function meaningful(x,fields){return !!x&&fields.some(k=>nonblank(x[k]))}
function patchAwardee(a){const legacy=String(a?.legacy_id||'').toUpperCase();const c=AUTHORITY[legacy];if(!c)return a;a.name=c.name;a.nama=c.name;if(c.jurusan)a.jurusan=c.jurusan;if(c.vision===null){a.motto=null;a.vision=null}else if(nonblank(c.vision)){a.motto=c.vision;a.vision=c.vision}a.profile_source=c.source;return a}
function validAcademic(rows){const quarantined=new Set(AUDIT?.academic?.quarantined_legacy_ids||[]);return (rows||[]).filter(x=>{const s=Number(x.semester);return !quarantined.has(String(x.legacy_id||''))&&Number.isInteger(s)&&s>=1&&s<=14}).sort((a,b)=>Number(a.semester)-Number(b.semester))}
function validOrganizations(rows){return (rows||[]).filter(x=>meaningful(x,['organization_name','position','level','start_year','end_year_text']))}
function validAchievements(rows){return (rows||[]).filter(x=>meaningful(x,['achievement_name','organizer','year','level','category']))}
function validCoaching(rows){return (rows||[]).filter(x=>meaningful(x,['session_date','facilitator','topic_problem','solution','follow_up_plan']))}
function validAttendance(rows){return (rows||[]).filter(x=>{const s=x.attendance_sessions;const sess=Array.isArray(s)?s[0]:s;const d=String(sess?.activity_date||'');return d&&d>=CUTOVER})}
function validAnalyses(rows){return (rows||[]).filter(x=>String(x.analyzed_at||'')>=CUTOVER)}
function auditedPortfolio(legacy){const p=AUDIT?.portfolio?.[legacy];if(!p)return null;if(p.status==='quarantined')return null;return{legacy_id:p.legacy_id||null,awardee_id:legacy,cv_url:p.cv_url||null,evidence_drive_url:p.evidence_drive_url||null,contribution:p.contribution||null,audit_status:p.status,audit_reason:p.reason||null,source:'Audited master Portfolio + Drive metadata'}}
module.exports=async function handler(req,res){
 if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
 try{
  const t=token(req);if(!t)return out(res,401,{success:false,error:'PIN access session diperlukan.'});await identity(t);
  const a=patchAwardee(await resolveAwardee(req.body?.params?.id_awardee||req.body?.params||'',t));if(!a)return out(res,404,{success:false,error:'Awardee tidak ditemukan.'});
  const id=a.id,legacy=String(a.legacy_id||'').toUpperCase();
  const [contact,academicRaw,organizationsRaw,achievementsRaw,coachingRaw,assessments,cases,analysesRaw,competencies,_portfolioRaw,reflections,attendanceRaw,networking,spiritual,idp]=await Promise.all([
   q(`/rest/v1/awardee_contacts?awardee_id=eq.${id}&select=whatsapp,email`,t),
   q(`/rest/v1/academic_records?awardee_id=eq.${id}&select=*&order=semester.asc.nullslast`,t),
   q(`/rest/v1/organization_records?awardee_id=eq.${id}&select=*&order=start_year.desc.nullslast`,t),
   q(`/rest/v1/achievements?awardee_id=eq.${id}&select=*&order=year.desc.nullslast`,t),
   q(`/rest/v1/coaching_sessions?awardee_id=eq.${id}&select=*&order=session_date.desc.nullslast`,t),
   q(`/rest/v1/assessments?awardee_id=eq.${id}&select=*&order=updated_at.desc`,t),
   q(`/rest/v1/mentoring_cases?awardee_id=eq.${id}&select=*&order=created_at.desc`,t),
   q(`/rest/v1/rule_analyses?awardee_id=eq.${id}&select=*&order=analyzed_at.desc&limit=10`,t),
   q(`/rest/v1/competencies?awardee_id=eq.${id}&select=*&order=assessed_at.desc.nullslast`,t),
   q(`/rest/v1/portfolios?awardee_id=eq.${id}&select=*`,t),
   q(`/rest/v1/reflection_responses?awardee_id=eq.${id}&select=*&order=submitted_at.desc.nullslast`,t),
   q(`/rest/v1/attendance_records?awardee_id=eq.${id}&select=status,notes,checked_at,attendance_sessions(activity_name,activity_date,target_cohort,period_id)&order=checked_at.desc.nullslast`,t),
   q(`/rest/v1/networking_records?awardee_id=eq.${id}&select=*&order=contact_date.desc.nullslast`,t),
   q(`/rest/v1/spiritual_records?awardee_id=eq.${id}&select=*&order=created_at.desc`,t),
   q(`/rest/v1/idp_snapshots?awardee_id=eq.${id}&select=payload,captured_at,source_sheet_name,idp_external_sources(source_name)&order=captured_at.desc&limit=1`,t)
  ]);
  const academic=validAcademic(academicRaw),organizations=validOrganizations(organizationsRaw),achievements=validAchievements(achievementsRaw),coaching=validCoaching(coachingRaw),attendance=validAttendance(attendanceRaw),analyses=validAnalyses(analysesRaw),portfolio=auditedPortfolio(legacy);
  const att={hadir:0,izin:0,sakit:0,alpa:0,total:0,pct:null,records:attendance};
  for(const r of attendance){att.total++;const s=String(r.status||'').toLowerCase();if(s==='hadir')att.hadir++;else if(s==='izin')att.izin++;else if(s==='sakit')att.sakit++;else if(s==='alpa')att.alpa++}
  att.pct=att.total?Math.round(att.hadir/att.total*100):null;
  const latestAcademic=academic.filter(x=>x.ipk!==null&&x.ipk!=='').slice(-1)[0]||null;
  const portfolioAudit=AUDIT?.portfolio?.[legacy]||null;
  const response={
   awardee:a,contact:contact?.[0]||null,academic,akademik:academic,organizations,organisasi:organizations,achievements,prestasi:achievements,coaching,assessments:assessments||[],cases:cases||[],analyses,competencies:competencies||[],portfolio,portfolio_audit:portfolioAudit,reflections:reflections||[],attendance:att,networking:networking||[],spiritual:spiritual||[],idp:idp?.[0]||null,
   data_quality:{source_policy:'audited',legacy_analysis_excluded:(analysesRaw||[]).length-analyses.length,legacy_attendance_excluded:(attendanceRaw||[]).length-attendance.length,invalid_academic_excluded:(academicRaw||[]).length-academic.length,portfolio_status:portfolioAudit?.status||'none'},
   summary:{latest_ipk:latestAcademic?.ipk??null,attendance_pct:att.pct,assessment_completed:(assessments||[]).filter(x=>String(x.status||'').toUpperCase()==='SELESAI').length,open_cases:(cases||[]).filter(x=>!['selesai','closed','done'].includes(String(x.status||'').toLowerCase())).length,achievement_count:achievements.length,organization_count:organizations.length,reflection_count:(reflections||[]).length,competency_count:(competencies||[]).length}
  };
  return out(res,200,{success:true,data:response});
 }catch(e){console.error('[Awardee360]',e);return out(res,500,{success:false,error:e.message||String(e)})}
};
