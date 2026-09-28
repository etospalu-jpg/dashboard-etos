const session=require('./server-session');

function out(res,status,body){
  res.status(status);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}
function bad(message,status=400){const e=new Error(message);e.status=status;throw e}
async function q(path,c,options={}){
  const r=await fetch(session.PROJECT_URL+path,{...options,headers:{...session.dbHeaders(c),...(options.headers||{})}});
  const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
  if(!r.ok){const e=new Error(body?.message||body?.error_description||body?.error||body?.hint||`Supabase ${r.status}`);e.status=r.status;throw e}
  return body;
}
function norm(v){return String(v||'').toLowerCase().replace(/[^a-z0-9\s]+/g,' ').replace(/\s+/g,' ').trim()}
const THEMES=[
 ['Spiritualitas & Ibadah',['ibadah','iman','keimanan','spiritual','allah','akhirat','islam','kajian','niat','syukur']],
 ['Teknologi & Media Digital',['media sosial','medsos','teknologi','digital','hp','handphone','ai','artificial intelligence','internet']],
 ['Kebiasaan & Disiplin',['disiplin','konsisten','konsistensi','kebiasaan','tidur','begadang','rutinitas','jadwal','waktu','prioritas']],
 ['Akademik & Belajar',['akademik','kuliah','belajar','tugas','ipk','nilai','skripsi','kampus','ujian']],
 ['Motivasi & Pengembangan Diri',['motivasi','semangat','malas','percaya diri','pengembangan diri','diri sendiri','potensi','tujuan hidup']],
 ['Relasi & Komunikasi',['komunikasi','teman','relasi','keluarga','konflik','sosial','hubungan']],
 ['Organisasi & Kepemimpinan',['organisasi','kepemimpinan','leadership','pemimpin','kepanitiaan']],
 ['Karier & Masa Depan',['karier','kerja','pekerjaan','magang','profesi','masa depan','skill','keterampilan']],
 ['Kesehatan & Keseimbangan',['kesehatan','sehat','istirahat','pola tidur','keseimbangan','burnout','lelah']]
];
function classify(text){
 const t=norm(text);if(!t)return'Belum terklasifikasi';
 let best=null,bestCount=0;
 for(const [name,keys] of THEMES){
  let n=0;for(const k of keys)if(t.includes(norm(k)))n++;
  if(n>bestCount){best=name;bestCount=n}
 }
 return best||'Lainnya';
}
function rankedTheme(items,textOf){
 const m=new Map();
 for(const x of items||[]){const theme=classify(textOf(x));m.set(theme,(m.get(theme)||0)+1)}
 return [...m.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'id'));
}
function rankedValues(items,valueOf){
 const m=new Map();
 for(const x of items||[]){const v=String(valueOf(x)||'').trim();if(!v)continue;m.set(v,(m.get(v)||0)+1)}
 return [...m.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'id'));
}
function dateOk(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))}
async function resolvePeriod(ref,c){
 const v=String(ref||'').trim();if(!v)return null;
 let rows=await q(`/rest/v1/development_periods?legacy_id=eq.${encodeURIComponent(v)}&select=id,legacy_id,name,start_date,end_date,status&limit=1`,c);
 if(!rows?.length&&/^[0-9a-f-]{36}$/i.test(v))rows=await q(`/rest/v1/development_periods?id=eq.${encodeURIComponent(v)}&select=id,legacy_id,name,start_date,end_date,status&limit=1`,c);
 return rows?.[0]||null;
}
async function insights(c){
 const [coaching,reflections]=await Promise.all([
  q('/rest/v1/coaching_sessions?select=id,session_date,topic_problem,solution,follow_up_plan,awardees!inner(legacy_id,name,angkatan)&order=session_date.desc.nullslast&limit=500',c).catch(()=>[]),
  q('/rest/v1/reflection_responses?select=id,agenda_name_snapshot,agenda_date,awardee_name_snapshot,cohort_snapshot,awareness_finding,event_facts,memorable_fact,feeling,action_plan,support_needed,support_notes,submitted_at&order=submitted_at.desc.nullslast&limit=500',c).catch(()=>[])
 ]);
 const coachingThemes=rankedTheme(coaching,x=>[x.topic_problem,x.solution,x.follow_up_plan].filter(Boolean).join(' '));
 const reflectionThemes=rankedTheme(reflections,x=>[x.awareness_finding,x.memorable_fact,x.event_facts,x.action_plan].filter(Boolean).join(' '));
 const supports=rankedValues(reflections,x=>x.support_needed);
 return{
  coaching:{total:coaching.length,themes:coachingThemes.slice(0,8),items:coaching.slice(0,100).map(x=>({tanggal:x.session_date,nama:x.awardees?.name||'—',id:x.awardees?.legacy_id||'',angkatan:x.awardees?.angkatan||'',topik:x.topic_problem||'',solusi:x.solution||'',rtl:x.follow_up_plan||'',theme:classify([x.topic_problem,x.solution,x.follow_up_plan].join(' '))}))},
  reflections:{total:reflections.length,themes:reflectionThemes.slice(0,8),supports:supports.slice(0,8),items:reflections.slice(0,150).map(x=>({agenda:x.agenda_name_snapshot||'Kajian',tanggal:x.agenda_date,nama:x.awardee_name_snapshot||'—',angkatan:x.cohort_snapshot||'',temuan:x.awareness_finding||'',rencana:x.action_plan||'',dukungan:x.support_needed||'',theme:classify([x.awareness_finding,x.memorable_fact,x.event_facts,x.action_plan].join(' '))}))}
 };
}
async function reflectionHub(c,p){
 const from=String(p?.from||'').trim(),to=String(p?.to||'').trim();
 const periodRows=await q('/rest/v1/development_periods?select=id,legacy_id,name,start_date,end_date,status&order=start_date.desc.nullslast,created_at.desc',c);
 let period=await resolvePeriod(p?.periodeId,c);
 if(!period)period=(periodRows||[]).find(x=>String(x.status||'').toLowerCase()==='aktif')||(periodRows||[])[0]||null;
 if(from&&!dateOk(from))bad('Tanggal mulai tidak valid.');
 if(to&&!dateOk(to))bad('Tanggal selesai tidak valid.');
 if(from&&to&&to<from)bad('Tanggal selesai tidak boleh sebelum tanggal mulai.');
 let path='/rest/v1/reflection_forms?select=id,legacy_id,period_id,agenda_name,agenda_date,target_cohort,status,public_code,created_at&order=agenda_date.desc.nullslast,created_at.desc&limit=300';
 if(period)path+=`&period_id=eq.${encodeURIComponent(period.id)}`;
 if(from)path+=`&agenda_date=gte.${encodeURIComponent(from)}`;
 if(to)path+=`&agenda_date=lte.${encodeURIComponent(to)}`;
 const forms=await q(path,c),ids=(forms||[]).map(x=>x.id);
 let responses=[];
 if(ids.length)responses=await q(`/rest/v1/reflection_responses?form_id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,form_id,awardee_id,agenda_name_snapshot,agenda_date,awardee_name_snapshot,cohort_snapshot,event_facts,memorable_fact,feeling,awareness_finding,action_plan,support_needed,support_notes,submitted_at&order=submitted_at.asc`,c);
 const grouped=new Map((forms||[]).map(f=>[f.id,{id:f.id,legacyId:f.legacy_id,agenda:f.agenda_name,tanggal:f.agenda_date,target:f.target_cohort||'Umum',status:f.status,publicCode:f.public_code,responses:[],eligibleCount:0}]));
 for(const r of responses||[]){const g=grouped.get(r.form_id);if(g)g.responses.push({id:r.id,awardeeId:r.awardee_id,nama:r.awardee_name_snapshot||'—',angkatan:r.cohort_snapshot||'',faktaKejadian:r.event_facts||'',membekas:r.memorable_fact||'',perasaan:r.feeling||'',temuan:r.awareness_finding||'',rencana:r.action_plan||'',dukungan:r.support_needed||'',catatanDukungan:r.support_notes||'',submittedAt:r.submitted_at})}
 const sessions=period?await q(`/rest/v1/attendance_sessions?period_id=eq.${encodeURIComponent(period.id)}&select=id,activity_name,activity_date&order=activity_date.desc`,c).catch(()=>[]):[];
 const sessionByKey=new Map((sessions||[]).map(s=>[`${s.activity_name}|${s.activity_date}`,s]));
 const sessionIds=[...new Set((sessions||[]).map(s=>s.id))];
 let hadir=[];
 if(sessionIds.length)hadir=await q(`/rest/v1/attendance_records?session_id=in.(${sessionIds.map(encodeURIComponent).join(',')})&status=eq.Hadir&select=session_id`,c).catch(()=>[]);
 const hadirCount=new Map();for(const r of hadir||[])hadirCount.set(r.session_id,(hadirCount.get(r.session_id)||0)+1);
 for(const g of grouped.values()){
  let s=sessionByKey.get(`${g.agenda}|${g.tanggal}`);
  if(!s&&sessions?.length)s=(sessions||[]).find(x=>x.activity_name===g.agenda)||null;
  g.eligibleCount=s?hadirCount.get(s.id)||0:0;
  g.responseCount=g.responses.length;
  g.pendingCount=Math.max(0,g.eligibleCount-g.responseCount);
 }
 return{periods:(periodRows||[]).map(x=>({id:x.legacy_id||x.id,nama:x.name,mulai:x.start_date,selesai:x.end_date,status:x.status})),period:period?{id:period.legacy_id||period.id,nama:period.name,mulai:period.start_date,selesai:period.end_date,status:period.status}:null,from:from||null,to:to||null,forms:[...grouped.values()]};
}
module.exports=async function handler(req,res){
 if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
 if(!session.verify(req))return out(res,401,{success:false,error:'PIN fasilitator diperlukan.'});
 try{
  const c=session.credential(req);if(!c)bad('Session PIN tidak valid.',401);
  const fn=String(req.body?.function||''),p=req.body?.params||{};
  if(fn==='getFacilitatorInsights')return out(res,200,{success:true,data:await insights(c)});
  if(fn==='getReflectionHub')return out(res,200,{success:true,data:await reflectionHub(c,p)});
  return out(res,404,{success:false,error:'Fungsi intelligence tidak ditemukan.'});
 }catch(e){console.error('[facilitator-intelligence]',e);return out(res,e.status||500,{success:false,error:e.message||String(e)})}
};