const session=require('../server-session');
const palu=require('../idp-palu-source');

function out(res,status,body){
  res.status(status).setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}
function bad(message,status=400){const e=new Error(message);e.status=status;throw e}
async function q(path,c){
  const r=await fetch(session.PROJECT_URL+path,{headers:session.dbHeaders(c)});
  const text=await r.text();let b=null;try{b=text?JSON.parse(text):null}catch{b=text}
  if(!r.ok){const e=new Error(b?.message||b?.error||b?.hint||`Supabase ${r.status}`);e.status=r.status;throw e}
  return b;
}
async function resolveAwardee(ref,c){
  const v=String(ref||'').trim();if(!v)return null;
  const path=/^AWD-/i.test(v)
    ?`/rest/v1/awardees?legacy_id=eq.${encodeURIComponent(v.toUpperCase())}&select=*`
    :`/rest/v1/awardees?id=eq.${encodeURIComponent(v)}&select=*`;
  return(await q(path,c))?.[0]||null;
}
function nonblank(v){return v!==null&&v!==undefined&&String(v).trim()!==''}
function meaningful(x,fields){return!!x&&fields.some(k=>nonblank(x[k]))}
function validAcademic(rows){
  return(rows||[]).filter(x=>{
    if(String(x.record_type||'')==='rekap_1_8'){x.semester_label='1-8';x.is_summary=true;return true}
    const s=Number(x.semester);return Number.isInteger(s)&&s>=1&&s<=14
  }).sort((a,b)=>Number(a.semester||0)-Number(b.semester||0))
}
const validOrganizations=rows=>(rows||[]).filter(x=>meaningful(x,['organization_name','position','level','start_year','end_year_text']));
const validAchievements=rows=>(rows||[]).filter(x=>meaningful(x,['achievement_name','organizer','year','level','category']));
const validCoaching=rows=>(rows||[]).filter(x=>meaningful(x,['session_date','facilitator_name_legacy','topic_problem','solution','follow_up_plan']));

const THEMES=[
 ['Spiritualitas & Ibadah',['ibadah','iman','keimanan','spiritual','allah','akhirat','islam','kajian','niat','syukur']],
 ['Teknologi & Media Digital',['media sosial','medsos','teknologi','digital','hp','handphone','ai','internet']],
 ['Kebiasaan & Disiplin',['disiplin','konsisten','konsistensi','kebiasaan','tidur','begadang','rutinitas','jadwal','waktu','prioritas']],
 ['Akademik & Belajar',['akademik','kuliah','belajar','tugas','ipk','nilai','skripsi','kampus','ujian']],
 ['Motivasi & Pengembangan Diri',['motivasi','semangat','malas','percaya diri','pengembangan diri','potensi','tujuan hidup']],
 ['Relasi & Komunikasi',['komunikasi','teman','relasi','keluarga','konflik','sosial','hubungan']],
 ['Organisasi & Kepemimpinan',['organisasi','kepemimpinan','leadership','pemimpin','kepanitiaan']],
 ['Karier & Masa Depan',['karier','kerja','pekerjaan','magang','profesi','masa depan','skill','keterampilan']],
 ['Kesehatan & Keseimbangan',['kesehatan','sehat','istirahat','pola tidur','keseimbangan','lelah']]
];
function norm(v){return String(v||'').toLowerCase().replace(/[^a-z0-9\s]+/g,' ').replace(/\s+/g,' ').trim()}
function classify(text){
  const t=norm(text);if(!t)return'Belum terklasifikasi';
  let best='Lainnya',score=0;
  for(const [name,keys] of THEMES){let n=0;for(const k of keys)if(t.includes(norm(k)))n++;if(n>score){score=n;best=name}}
  return best;
}
function rank(items,textOf){
  const m=new Map();for(const x of items||[]){const k=classify(textOf(x));m.set(k,(m.get(k)||0)+1)}
  return[...m.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'id'))
}
function rankValue(items,getter){
  const m=new Map();for(const x of items||[]){const k=String(getter(x)||'').trim();if(k)m.set(k,(m.get(k)||0)+1)}
  return[...m.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'id'))
}
function attendanceSummary(rows){
  const x={hadir:0,izin:0,sakit:0,alpa:0,total:0,pct:null,records:rows||[]};
  for(const r of rows||[]){x.total++;const s=String(r.status||'').toLowerCase();if(s==='hadir')x.hadir++;else if(s==='izin')x.izin++;else if(s==='sakit')x.sakit++;else if(s==='alpa')x.alpa++}
  x.pct=x.total?Math.round(x.hadir/x.total*100):null;return x;
}
function automaticAnalysis({academic,attendance,coaching,reflections,cases,achievements,organizations,idp,journal}){
  const notes=[];
  const numeric=academic.filter(x=>x.ipk!==null&&x.ipk!==''&&!x.is_summary);
  const latest=numeric.at(-1)||academic.find(x=>x.is_summary)||null;
  if(latest)notes.push({area:'Akademik',summary:`IPK terbaru yang tercatat ${Number(latest.ipk).toFixed(2)}${latest.semester?` pada semester ${latest.semester}`:''}.`,source:'academic_records'});
  if(numeric.length>=2){
    const prev=Number(numeric.at(-2).ipk),last=Number(numeric.at(-1).ipk),delta=last-prev;
    notes.push({area:'Tren akademik',summary:Math.abs(delta)<0.05?'Dua catatan IPK terakhir relatif stabil.':delta>0?`IPK meningkat ${delta.toFixed(2)} dari catatan sebelumnya.`:`IPK menurun ${Math.abs(delta).toFixed(2)} dari catatan sebelumnya; ini dapat dijadikan bahan percakapan, bukan penilaian tunggal.`,source:'academic_records'});
  }
  if(attendance.total)notes.push({area:'Kehadiran',summary:`${attendance.hadir} hadir dari ${attendance.total} catatan (${attendance.pct}%). Izin ${attendance.izin}, sakit ${attendance.sakit}, alpa ${attendance.alpa}.`,source:'attendance_records'});
  if(coaching.length)notes.push({area:'Coaching',summary:`${coaching.length} sesi coaching tercatat. Tema paling sering terbaca: ${rank(coaching,x=>[x.topic_problem,x.solution,x.follow_up_plan].join(' '))[0]?.name||'belum terklasifikasi'}.`,source:'coaching_sessions'});
  if(reflections.length)notes.push({area:'Refleksi',summary:`${reflections.length} refleksi tersimpan. Tema temuan yang paling sering terbaca: ${rank(reflections,x=>[x.awareness_finding,x.memorable_fact,x.event_facts,x.action_plan].join(' '))[0]?.name||'belum terklasifikasi'}.`,source:'reflection_responses'});
  const supports=rankValue(reflections,x=>x.support_needed);
  if(supports.length)notes.push({area:'Dukungan',summary:`Dukungan yang paling sering dipilih: ${supports[0].name} (${supports[0].count} kali).`,source:'reflection_responses'});
  const open=(cases||[]).filter(x=>!['selesai','closed','done'].includes(String(x.status||'').toLowerCase()));
  if(open.length)notes.push({area:'Pendampingan',summary:`${open.length} case pendampingan masih terbuka dan perlu ditinjau fasilitator sesuai catatan tindak lanjut.`,source:'mentoring_cases'});
  if(journal?.length)notes.push({area:'Jurnal fasilitator',summary:`${journal.length} catatan jurnal pendampingan terhubung ke Awardee ini.`,source:'facilitator_journal_entries'});
  if(idp?.connected!==false&&idp?.summary)notes.push({area:'IDP',summary:`Workbook IDP terhubung: ${idp.summary.filledRows||0} baris dan ${idp.summary.filledCells||0} sel terisi.`,source:'IDP workbook'});
  if(achievements.length)notes.push({area:'Prestasi',summary:`${achievements.length} prestasi tercatat di profil.`,source:'achievements'});
  if(organizations.length)notes.push({area:'Organisasi',summary:`${organizations.length} riwayat organisasi tercatat.`,source:'organization_records'});
  return{
    generatedAt:new Date().toISOString(),
    disclaimer:'Analisis ini merangkum pola pada data yang tersimpan. Gunakan sebagai bahan percakapan fasilitator, bukan diagnosis atau penilaian tunggal.',
    notes,
    coachingThemes:rank(coaching,x=>[x.topic_problem,x.solution,x.follow_up_plan].join(' ')).slice(0,5),
    reflectionThemes:rank(reflections,x=>[x.awareness_finding,x.memorable_fact,x.event_facts,x.action_plan].join(' ')).slice(0,5),
    supportPatterns:supports.slice(0,5)
  };
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
  if(!session.verify(req))return out(res,401,{success:false,error:'PIN fasilitator diperlukan untuk Awardee 360°.'});
  try{
    const c=session.credential(req);if(!c)bad('Session PIN tidak valid.',401);
    const a=await resolveAwardee(req.body?.params?.id_awardee||req.body?.params||'',c);
    if(!a)return out(res,404,{success:false,error:'Awardee tidak ditemukan.'});
    const id=a.id;
    const promises=[
      q(`/rest/v1/awardee_contacts?awardee_id=eq.${id}&select=whatsapp,email`,c),
      q(`/rest/v1/academic_records?awardee_id=eq.${id}&select=*&order=semester.asc.nullslast`,c),
      q(`/rest/v1/organization_records?awardee_id=eq.${id}&select=*&order=start_year.desc.nullslast`,c),
      q(`/rest/v1/achievements?awardee_id=eq.${id}&select=*&order=year.desc.nullslast`,c),
      q(`/rest/v1/portfolios?awardee_id=eq.${id}&select=*&order=updated_at.desc.nullslast&limit=1`,c).catch(()=>[]),
      q(`/rest/v1/attendance_records?awardee_id=eq.${id}&select=status,notes,checked_at,attendance_sessions(activity_name,activity_date,target_cohort,period_id)&order=checked_at.desc.nullslast`,c),
      q(`/rest/v1/coaching_sessions?awardee_id=eq.${id}&select=*&order=session_date.desc.nullslast`,c),
      q(`/rest/v1/mentoring_cases?awardee_id=eq.${id}&select=*&order=created_at.desc`,c),
      q(`/rest/v1/rule_analyses?awardee_id=eq.${id}&select=*&order=analyzed_at.desc&limit=10`,c).catch(()=>[]),
      q(`/rest/v1/competencies?awardee_id=eq.${id}&select=*&order=assessed_at.desc.nullslast`,c).catch(()=>[]),
      q(`/rest/v1/reflection_responses?awardee_id=eq.${id}&select=*&order=submitted_at.desc.nullslast`,c),
      q(`/rest/v1/networking_records?awardee_id=eq.${id}&select=*&order=contact_date.desc.nullslast`,c).catch(()=>[]),
      q(`/rest/v1/spiritual_records?awardee_id=eq.${id}&select=*&order=created_at.desc`,c).catch(()=>[]),
      q(`/rest/v1/facilitator_journal_entries?awardee_id=eq.${id}&select=*&order=observed_at.desc.nullslast`,c).catch(()=>[]),
      q(`/rest/v1/facilitator_monthly_summaries?awardee_id=eq.${id}&select=*&order=month_start.desc`,c).catch(()=>[])
    ];
    const [
      contactRows,academicRaw,organizationsRaw,achievementsRaw,portfolioRows,attendanceRaw,coachingRaw,cases,
      analyses,competencies,reflections,networking,spiritual,journal,monthlySummaries
    ]=await Promise.all(promises);
    const academic=validAcademic(academicRaw),organizations=validOrganizations(organizationsRaw),achievements=validAchievements(achievementsRaw),coaching=validCoaching(coachingRaw);
    const attendance=attendanceSummary(attendanceRaw||[]);
    let idp=null;
    try{idp=await palu.detail(a.name,a.angkatan||'',false);idp.connected=true}catch(e){idp={connected:false,error:e.message||'IDP belum terhubung.',summary:null,values:[]}}
    const withIpk=academic.filter(x=>x.ipk!==null&&x.ipk!==''),latestAcademic=withIpk.filter(x=>!x.is_summary).at(-1)||withIpk.find(x=>x.is_summary)||null;
    const analysis=automaticAnalysis({academic,attendance,coaching,reflections:reflections||[],cases:cases||[],achievements,organizations,idp,journal:journal||[]});
    const response={
      awardee:a,
      contact:contactRows?.[0]||null,
      academic,akademik:academic,
      organizations,organisasi:organizations,
      achievements,prestasi:achievements,
      portfolio:portfolioRows?.[0]||null,
      attendance,
      coaching,
      cases:cases||[],
      analyses:analyses||[],
      competencies:competencies||[],
      reflections:reflections||[],
      networking:networking||[],
      spiritual:spiritual||[],
      journal:journal||[],
      monthlySummaries:monthlySummaries||[],
      idp,
      automaticAnalysis:analysis,
      access:{role:'superadmin',kind:'pin',private_ops:true,development:true,hidden_sections:[]},
      summary:{
        latest_ipk:latestAcademic?.ipk??null,
        latest_ipk_label:latestAcademic?.is_summary?'Rekap Semester 1-8':latestAcademic?.semester?`Semester ${latestAcademic.semester}`:null,
        attendance_pct:attendance.pct,
        open_cases:(cases||[]).filter(x=>!['selesai','closed','done'].includes(String(x.status||'').toLowerCase())).length,
        achievement_count:achievements.length,
        organization_count:organizations.length,
        reflection_count:(reflections||[]).length,
        coaching_count:coaching.length,
        competency_count:(competencies||[]).length,
        journal_count:(journal||[]).length,
        idp_connected:!!idp?.connected
      }
    };
    return out(res,200,{success:true,data:response});
  }catch(e){
    console.error('[Awardee360]',e);
    return out(res,e.status||500,{success:false,error:e.message||String(e)});
  }
};