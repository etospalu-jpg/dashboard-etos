const PROJECT_URL = 'https://weklmapqizeldfdalbgs.supabase.co';
const KEY = 'sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';

const baseHeaders = token => ({
  apikey: KEY,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
});

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function tokenFrom(req) {
  const h = String(req.headers.authorization || '');
  return h.replace(/^Bearer\s+/i, '').trim();
}

async function supa(path, token, options = {}) {
  const r = await fetch(`${PROJECT_URL}${path}`, {
    ...options,
    headers: { ...baseHeaders(token), ...(options.headers || {}) }
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw new Error(body?.message || body?.error_description || body?.error || `Supabase ${r.status}`);
  return body;
}

async function profileFor(token) {
  const user = await supa('/auth/v1/user', token);
  const rows = await supa(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,email,role,is_active`, token);
  const profile = rows?.[0];
  if (!profile || !profile.is_active) throw new Error('Akun belum aktif atau tidak memiliki akses.');
  return { user, profile };
}

async function awardeeUuid(legacyId, token) {
  const id = String(legacyId || '').trim().toUpperCase();
  if (!id) return null;
  const rows = await supa(`/rest/v1/awardees?legacy_id=eq.${encodeURIComponent(id)}&select=id`, token);
  return rows?.[0]?.id || null;
}

function writable(role) { return ['superadmin','admin','facilitator','operator'].includes(String(role)); }
function admin(role) { return ['superadmin','admin'].includes(String(role)); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success:false, error:'Method not allowed' });
  try {
    const token = tokenFrom(req);
    if (!token) return json(res, 401, { success:false, error:'Sesi login diperlukan.' });
    const { user, profile } = await profileFor(token);
    const fn = String(req.body?.function || '');
    const p = req.body?.params ?? null;
    const role = profile.role;

    if (fn === 'verifyFacilitatorAccess' || fn === 'verifyAbsensiAdminPin') {
      return json(res, 200, { success:true, data:{ token, profile } });
    }

    if (fn === 'getFasilitatorProfile') {
      const rows = await supa(`/rest/v1/facilitators?user_id=eq.${encodeURIComponent(user.id)}&select=*`, token);
      return json(res, 200, { success:true, data: rows?.[0] || { name:profile.full_name, email:profile.email, role } });
    }

    if (fn === 'getCoachingList') {
      const rows = await supa('/rest/v1/coaching_sessions?select=legacy_id,session_date,topic_problem,solution,follow_up_plan,awardees!inner(legacy_id,name)&order=session_date.desc.nullslast', token);
      const data = (rows || []).map(x => ({ id:x.legacy_id, awdId:x.awardees?.legacy_id, nama:x.awardees?.name || 'Unknown', tgl:x.session_date || '-', topik:x.topic_problem || '-', solusi:x.solution || '-', rtl:x.follow_up_plan || '-' }));
      return json(res, 200, { success:true, data });
    }

    if (fn === 'saveCoaching') {
      if (!writable(role)) return json(res,403,{success:false,error:'Role tidak memiliki izin menulis.'});
      const aid = await awardeeUuid(p?.id_awardee, token);
      if (!aid) return json(res,404,{success:false,error:'Awardee tidak ditemukan.'});
      const body = [{ awardee_id:aid, facilitator_name_legacy:profile.full_name || profile.email, session_date:p?.tgl || null, topic_problem:p?.topik || null, solution:p?.solusi || null, follow_up_plan:p?.rtl || null, created_by:user.id, updated_by:user.id }];
      const data = await supa('/rest/v1/coaching_sessions?select=id', token, { method:'POST', headers:{Prefer:'return=representation'}, body:JSON.stringify(body) });
      return json(res,200,{success:true,data:data?.[0]});
    }

    if (fn === 'getAbsensiEntryOptions') {
      const [periods, awardees, sessions] = await Promise.all([
        supa('/rest/v1/development_periods?select=id,legacy_id,name,start_date,end_date,status&order=start_date.desc.nullslast', token),
        supa('/rest/v1/awardees?status=neq.Lulus&select=legacy_id,name,angkatan,status&order=name.asc', token),
        supa('/rest/v1/attendance_sessions?select=activity_name&order=activity_date.desc.nullslast', token)
      ]);
      const pp=(periods||[]).map(x=>({id:x.legacy_id||x.id,uuid:x.id,nama:x.name,mulai:x.start_date||'',selesai:x.end_date||'',status:x.status}));
      const requested=String(p?.periodeId||'');
      const selectedPeriod=pp.find(x=>x.id===requested)||pp.find(x=>String(x.status).toLowerCase()==='aktif')||pp[0]||null;
      const cohorts=[...new Set((awardees||[]).map(x=>String(x.angkatan||'')).filter(Boolean))].sort();
      const agendas=[...new Set((sessions||[]).map(x=>String(x.activity_name||'')).filter(Boolean))].sort();
      return json(res,200,{success:true,data:{periods:pp,selectedPeriod,awardees:(awardees||[]).map(x=>({id:x.legacy_id,nama:x.name,angkatan:x.angkatan,status:x.status})),cohorts,agendas}});
    }

    if (fn === 'savePeriodePembinaan') {
      if (!admin(role)) return json(res,403,{success:false,error:'Hanya admin yang dapat membuat periode.'});
      const legacyId='PRD-'+String(Date.now()).slice(-6);
      const body=[{legacy_id:legacyId,name:String(p?.nama||'').trim(),start_date:p?.mulai||null,end_date:p?.selesai||null,status:p?.status||'Aktif',created_by:user.id,updated_by:user.id}];
      const data=await supa('/rest/v1/development_periods?select=id,legacy_id,name,start_date,end_date,status',token,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
      const x=data?.[0];
      return json(res,200,{success:true,data:{id:x?.legacy_id||x?.id,nama:x?.name,mulai:x?.start_date,selesai:x?.end_date,status:x?.status}});
    }

    if (fn === 'getAbsensiList') {
      const periods=await supa('/rest/v1/development_periods?select=id,legacy_id,name,start_date,end_date,status&order=start_date.desc.nullslast',token);
      const pp=(periods||[]).map(x=>({id:x.legacy_id||x.id,uuid:x.id,nama:x.name,mulai:x.start_date||'',selesai:x.end_date||'',status:x.status}));
      const requested=typeof p==='string'?p:String(p?.periodeId||'');
      const selected=pp.find(x=>x.id===requested)||pp.find(x=>String(x.status).toLowerCase()==='aktif')||pp[0]||null;
      if(!selected) return json(res,200,{success:true,data:{items:[],periods:[],selectedPeriod:null,legacyMode:false,unresolvedTahsin:0}});
      const sessions=await supa(`/rest/v1/attendance_sessions?period_id=eq.${encodeURIComponent(selected.uuid)}&select=id`,token);
      const ids=(sessions||[]).map(x=>x.id);
      if(!ids.length) return json(res,200,{success:true,data:{items:[],periods:pp,selectedPeriod:selected,legacyMode:false,unresolvedTahsin:0}});
      const inFilter=`(${ids.map(encodeURIComponent).join(',')})`;
      const records=await supa(`/rest/v1/attendance_records?session_id=in.${inFilter}&select=status,awardees!inner(legacy_id,name,angkatan)`,token);
      const map=new Map();
      for(const r of records||[]){const a=r.awardees,k=a.legacy_id;if(!map.has(k))map.set(k,{id:k,nama:a.name,angkatan:a.angkatan,h:0,i:0,s:0,a:0,total:0});const x=map.get(k);x.total++;const st=String(r.status||'').toLowerCase();if(st==='hadir')x.h++;else if(st==='izin')x.i++;else if(st==='sakit')x.s++;else if(st==='alpa')x.a++;}
      const items=[...map.values()].map(x=>({...x,pct:x.total?Math.round(x.h/x.total*100):0})).sort((a,b)=>a.pct-b.pct||String(a.nama).localeCompare(String(b.nama),'id'));
      return json(res,200,{success:true,data:{items,periods:pp,selectedPeriod:selected,legacyMode:false,unresolvedTahsin:0}});
    }

    if (fn === 'saveAbsensiEntry') {
      if(!writable(role))return json(res,403,{success:false,error:'Role tidak memiliki izin absensi.'});
      const periodLegacy=String(p?.periodeId||'');
      let prs=await supa(`/rest/v1/development_periods?legacy_id=eq.${encodeURIComponent(periodLegacy)}&select=id`,token);
      if(!prs?.length) prs=await supa(`/rest/v1/development_periods?id=eq.${encodeURIComponent(periodLegacy)}&select=id`,token);
      const period=prs?.[0]; if(!period)return json(res,404,{success:false,error:'Periode tidak ditemukan.'});
      const activity=String(p?.namaKegiatan||'').trim(), date=String(p?.tanggal||'').trim();
      if(!activity||!/^\d{4}-\d{2}-\d{2}$/.test(date))return json(res,400,{success:false,error:'Agenda/tanggal tidak valid.'});
      const dup=await supa(`/rest/v1/attendance_sessions?period_id=eq.${period.id}&activity_name=eq.${encodeURIComponent(activity)}&activity_date=eq.${date}&select=id`,token);
      if(dup?.length)return json(res,409,{success:false,error:'Absensi untuk agenda dan tanggal tersebut sudah ada.'});
      const session=await supa('/rest/v1/attendance_sessions?select=id',token,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify([{period_id:period.id,activity_name:activity,activity_date:date,target_cohort:p?.targetAngkatan||'Umum',created_by:user.id,updated_by:user.id}])});
      const statuses=p?.statuses||{},legacyIds=Object.keys(statuses).map(x=>String(x).trim().toUpperCase()).filter(Boolean);
      if(!legacyIds.length)return json(res,400,{success:false,error:'Pilih minimal satu status kehadiran.'});
      const awards=await supa(`/rest/v1/awardees?legacy_id=in.(${legacyIds.map(x=>encodeURIComponent(x)).join(',')})&select=id,legacy_id`,token);
      const amap=new Map((awards||[]).map(x=>[x.legacy_id,x.id]));
      const rows=legacyIds.map(id=>({session_id:session[0].id,awardee_id:amap.get(id),status:String(statuses[id]||'').replace(/^Tidak Hadir$/i,'Alpa'),checked_at:new Date().toISOString(),checked_by:user.id})).filter(x=>x.awardee_id&&['Hadir','Izin','Sakit','Alpa'].includes(x.status));
      if(!rows.length)return json(res,400,{success:false,error:'Status kehadiran tidak valid.'});
      await supa('/rest/v1/attendance_records',token,{method:'POST',body:JSON.stringify(rows)});
      const counts={hadir:0,izin:0,sakit:0,alpa:0};rows.forEach(x=>counts[x.status.toLowerCase()]++);
      return json(res,200,{success:true,data:{row:session[0].id,periodId:periodLegacy,agenda:activity,tanggal:date,targetAngkatan:p?.targetAngkatan||'Umum',counts,totalDiisi:rows.length,reflectionForm:null}});
    }

    if (fn === 'getMentoringCases') {
      const rows=await supa('/rest/v1/mentoring_cases?select=*,awardees!inner(legacy_id,name)&order=created_at.desc',token);
      return json(res,200,{success:true,data:(rows||[]).map(x=>({id:x.legacy_id||x.id,awardeeId:x.awardees?.legacy_id,nama:x.awardees?.name,kategori:x.category,judul:x.title,sumber:x.signal_source,prioritas:x.priority,pic:x.pic,aksi:x.action_plan,deadline:x.deadline,status:x.status,outcome:x.outcome}))});
    }

    if (fn === 'saveMentoringCase') {
      if(!writable(role))return json(res,403,{success:false,error:'Role tidak memiliki izin menulis.'});
      const aid=await awardeeUuid(p?.id_awardee||p?.awardeeId,token);if(!aid)return json(res,404,{success:false,error:'Awardee tidak ditemukan.'});
      const body=[{awardee_id:aid,category:p?.kategori||null,title:p?.judul||null,signal_source:p?.sumber||null,priority:p?.prioritas||null,pic:p?.pic||null,action_plan:p?.aksi||null,deadline:p?.deadline||null,status:p?.status||'Open',outcome:p?.outcome||null,created_by:user.id,updated_by:user.id}];
      const data=await supa('/rest/v1/mentoring_cases?select=id',token,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
      return json(res,200,{success:true,data:data?.[0]});
    }

    if (fn === 'getFacilitatorAssessmentHub') {
      const [awards, assessments]=await Promise.all([
        supa('/rest/v1/awardees?status=neq.Lulus&select=id,legacy_id,name,angkatan&order=name.asc',token),
        supa('/rest/v1/assessments?select=awardee_id,assessment_code,status,needs_checkin',token)
      ]);
      const grouped=new Map();for(const a of assessments||[]){if(!grouped.has(a.awardee_id))grouped.set(a.awardee_id,[]);grouped.get(a.awardee_id).push(a)}
      const awardees=(awards||[]).map(a=>{const rs=grouped.get(a.id)||[];return{id:a.legacy_id,nama:a.name,angkatan:a.angkatan,completed:rs.filter(x=>String(x.status).toUpperCase()==='SELESAI').length,needCheckin:rs.some(x=>x.needs_checkin)}});
      return json(res,200,{success:true,data:{awardees}});
    }

    if (fn === 'getFacilitatorAssessmentReport') {
      const aid=await awardeeUuid(p?.id_awardee||p,token);if(!aid)return json(res,404,{success:false,error:'Awardee tidak ditemukan.'});
      const records=await supa(`/rest/v1/assessments?awardee_id=eq.${aid}&select=assessment_code,status,answers,result,needs_checkin,updated_at`,token);
      return json(res,200,{success:true,data:{records:records||[]}});
    }

    if (fn === 'getLatestAwardeeRuleAnalysis') {
      const aid=await awardeeUuid(p?.id_awardee||p,token);if(!aid)return json(res,404,{success:false,error:'Awardee tidak ditemukan.'});
      const rows=await supa(`/rest/v1/rule_analyses?awardee_id=eq.${aid}&select=*&order=analyzed_at.desc&limit=1`,token);
      return json(res,200,{success:true,data:rows?.[0]||null});
    }

    if (fn === 'getAwardee360') {
      const aid=await awardeeUuid(p?.id_awardee,token);if(!aid)return json(res,404,{success:false,error:'Awardee tidak ditemukan.'});
      const [a,c,ak,o,pr,co,ass,mc,ra]=await Promise.all([
        supa(`/rest/v1/awardees?id=eq.${aid}&select=*`,token),
        supa(`/rest/v1/awardee_contacts?awardee_id=eq.${aid}&select=whatsapp,email`,token),
        supa(`/rest/v1/academic_records?awardee_id=eq.${aid}&select=*&order=semester.asc`,token),
        supa(`/rest/v1/organization_records?awardee_id=eq.${aid}&select=*`,token),
        supa(`/rest/v1/achievements?awardee_id=eq.${aid}&select=*&order=year.desc`,token),
        supa(`/rest/v1/coaching_sessions?awardee_id=eq.${aid}&select=*&order=session_date.desc`,token),
        supa(`/rest/v1/assessments?awardee_id=eq.${aid}&select=*`,token),
        supa(`/rest/v1/mentoring_cases?awardee_id=eq.${aid}&select=*&order=created_at.desc`,token),
        supa(`/rest/v1/rule_analyses?awardee_id=eq.${aid}&select=*&order=analyzed_at.desc&limit=5`,token)
      ]);
      return json(res,200,{success:true,data:{awardee:a?.[0],contact:c?.[0],akademik:ak||[],organisasi:o||[],prestasi:pr||[],coaching:co||[],assessments:ass||[],cases:mc||[],analyses:ra||[]}});
    }

    return json(res,404,{success:false,error:`Fungsi ${fn} belum tersedia pada secure API.`});
  } catch (err) {
    console.error(err);
    return json(res,500,{success:false,error:err?.message || String(err)});
  }
};
