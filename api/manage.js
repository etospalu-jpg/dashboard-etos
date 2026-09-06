const PROJECT_URL='https://weklmapqizeldfdalbgs.supabase.co';
const KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';

function out(res,status,body){res.status(status).setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
function token(req){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim()}
function headers(t,extra={}){return{apikey:KEY,Authorization:`Bearer ${t}`,'Content-Type':'application/json',...extra}}
async function q(path,t,options={}){const r=await fetch(PROJECT_URL+path,{...options,headers:{...headers(t),...(options.headers||{})}});const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!r.ok)throw new Error(body?.message||body?.error||body?.hint||`Supabase ${r.status}`);return body}
async function identity(t){const user=await q('/auth/v1/user',t);const rows=await q(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,email,role,is_active`,t);const p=rows?.[0];if(!p?.is_active)throw new Error('Akun belum aktif.');return{user,profile:p}}
const canWrite=r=>['superadmin','admin','facilitator','operator'].includes(String(r));
const canAdmin=r=>['superadmin','admin'].includes(String(r));
async function awardeeId(legacy,t){const rows=await q(`/rest/v1/awardees?legacy_id=eq.${encodeURIComponent(String(legacy||'').trim().toUpperCase())}&select=id`,t);return rows?.[0]?.id||null}
async function nextLegacy(table,prefix,t){const rows=await q(`/rest/v1/${table}?select=legacy_id&legacy_id=like.${encodeURIComponent(prefix+'-*')}`,t);let n=0;(rows||[]).forEach(x=>{const m=String(x.legacy_id||'').match(/(\d+)$/);if(m)n=Math.max(n,Number(m[1]))});return`${prefix}-${String(n+1).padStart(4,'0')}`}
async function insert(table,data,t,select='*'){return q(`/rest/v1/${table}?select=${encodeURIComponent(select)}`,t,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify([data])})}
async function patch(table,filter,data,t,select='*'){return q(`/rest/v1/${table}?${filter}&select=${encodeURIComponent(select)}`,t,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(data)})}

module.exports=async function handler(req,res){
 if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
 try{
  const t=token(req);if(!t)return out(res,401,{success:false,error:'PIN access session diperlukan.'});
  const {user,profile}=await identity(t);if(!canWrite(profile.role))return out(res,403,{success:false,error:'Role tidak memiliki izin menulis.'});
  const fn=String(req.body?.function||''),p=req.body?.params||{};

  if(fn==='saveAwardee'){
    const legacy=String(p.id_awardee||p.legacy_id||'').trim().toUpperCase();
    const values={name:String(p.nama||p.name||'').trim(),kampus:p.kampus||null,jurusan:p.jurusan||null,angkatan:String(p.angkatan||'').trim()||null,status:p.status||'Aktif',motto:p.motto||null,photo_url:p.photo_url||p.foto||null,updated_by:user.id};
    if(!values.name)throw new Error('Nama Awardee wajib diisi.');
    let row;
    if(legacy){const r=await patch('awardees',`legacy_id=eq.${encodeURIComponent(legacy)}`,values,t);row=r?.[0]}
    else{values.legacy_id=await nextLegacy('awardees','AWD',t);values.created_by=user.id;const r=await insert('awardees',values,t);row=r?.[0]}
    if(!row)throw new Error('Awardee gagal disimpan.');
    if(p.whatsapp||p.email){await q('/rest/v1/awardee_contacts?on_conflict=awardee_id',t,{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{awardee_id:row.id,whatsapp:p.whatsapp||null,email:p.email||null,updated_by:user.id}])})}
    return out(res,200,{success:true,data:{id:row.legacy_id||row.id}});
  }

  if(fn==='saveAkademik'){
    const aid=await awardeeId(p.id_awardee,t);if(!aid)throw new Error('Awardee tidak ditemukan.');
    const sem=Number(p.semester),ipk=Number(String(p.ipk||'').replace(',','.'));if(!(sem>=1&&sem<=14))throw new Error('Semester harus 1–14.');if(!(ipk>=0&&ipk<=4))throw new Error('IPK harus 0–4.');
    const legacy=await nextLegacy('academic_records','AKD',t);const r=await insert('academic_records',{legacy_id:legacy,awardee_id:aid,semester:sem,ipk,created_by:user.id,updated_by:user.id},t);return out(res,200,{success:true,data:r?.[0]});
  }

  if(fn==='savePrestasi'){
    const aid=await awardeeId(p.id_awardee,t);if(!aid)throw new Error('Awardee tidak ditemukan.');
    if(!String(p.prestasi||'').trim())throw new Error('Nama prestasi wajib diisi.');
    const legacy=await nextLegacy('achievements','PRS',t);const r=await insert('achievements',{legacy_id:legacy,awardee_id:aid,achievement_name:p.prestasi,organizer:p.penyelenggara||null,year:p.tahun?Number(p.tahun):null,level:p.tingkat||null,category:p.kategori||null,created_by:user.id,updated_by:user.id},t);return out(res,200,{success:true,data:r?.[0]});
  }

  if(fn==='saveOrganisasi'){
    const aid=await awardeeId(p.id_awardee,t);if(!aid)throw new Error('Awardee tidak ditemukan.');
    if(!String(p.nama_organisasi||p.organisasi||'').trim())throw new Error('Nama organisasi wajib diisi.');
    const legacy=await nextLegacy('organization_records','ORG',t);const r=await insert('organization_records',{legacy_id:legacy,awardee_id:aid,organization_name:p.nama_organisasi||p.organisasi,position:p.jabatan||null,start_year:p.tahun_mulai?Number(p.tahun_mulai):null,end_year_text:p.tahun_selesai||null,level:p.tingkat||null,created_by:user.id,updated_by:user.id},t);return out(res,200,{success:true,data:r?.[0]});
  }

  if(fn==='savePortfolio'){
    const aid=await awardeeId(p.id_awardee,t);if(!aid)throw new Error('Awardee tidak ditemukan.');
    const existing=await q(`/rest/v1/portfolios?awardee_id=eq.${aid}&select=id,legacy_id`,t);let row;
    const data={cv_url:p.link_cv||p.cv_url||null,contribution:p.kontribusi||p.contribution||null,evidence_drive_url:p.link_gdrive||p.evidence_drive_url||null,linkedin_url:p.linkedin_url||null,updated_by:user.id};
    if(existing?.[0])row=(await patch('portfolios',`id=eq.${existing[0].id}`,data,t))?.[0];else{data.legacy_id=await nextLegacy('portfolios','PRT',t);data.awardee_id=aid;data.created_by=user.id;row=(await insert('portfolios',data,t))?.[0]}
    return out(res,200,{success:true,data:row});
  }

  if(fn==='saveFasilitatorProfile'){
    const existing=await q(`/rest/v1/facilitators?user_id=eq.${encodeURIComponent(user.id)}&select=id`,t);const data={name:p.nama||p.name||profile.full_name||'Fasilitator ETOS',email:p.email||profile.email||null,whatsapp:p.no_wa||p.whatsapp||null,wilayah:p.wilayah||'Palu',bio:p.bio||null,user_id:user.id,updated_at:new Date().toISOString()};let row;if(existing?.[0])row=(await patch('facilitators',`id=eq.${existing[0].id}`,data,t))?.[0];else row=(await insert('facilitators',data,t))?.[0];return out(res,200,{success:true,data:row});
  }

  if(fn==='archiveAwardee'){
    if(!canAdmin(profile.role))return out(res,403,{success:false,error:'Hanya admin yang dapat mengarsipkan Awardee.'});
    const legacy=String(p.id_awardee||'').trim().toUpperCase();const row=(await patch('awardees',`legacy_id=eq.${encodeURIComponent(legacy)}`,{status:'Arsip',updated_by:user.id},t))?.[0];return out(res,200,{success:true,data:row});
  }

  if(fn==='runRuleAnalysis'){
    const aid=await awardeeId(p.id_awardee,t);if(!aid)throw new Error('Awardee tidak ditemukan.');
    const [awd,academic,attendance,coaching,assessments]=await Promise.all([
      q(`/rest/v1/awardees?id=eq.${aid}&select=legacy_id,name`,t),
      q(`/rest/v1/academic_records?awardee_id=eq.${aid}&select=semester,ipk&order=semester.desc`,t),
      q(`/rest/v1/attendance_records?awardee_id=eq.${aid}&select=status`,t),
      q(`/rest/v1/coaching_sessions?awardee_id=eq.${aid}&select=session_date&order=session_date.desc&limit=1`,t),
      q(`/rest/v1/assessments?awardee_id=eq.${aid}&select=needs_checkin,status`,t)
    ]);
    const latest=academic?.[0]||null,prev=academic?.[1]||null;let score=0;const signals=[];
    if(latest&&Number(latest.ipk)<3){score+=3;signals.push('IPK terbaru di bawah 3,00')}
    if(latest&&prev&&Number(prev.ipk)-Number(latest.ipk)>=.3){score+=2;signals.push('Penurunan IPK ≥ 0,30')}
    const total=(attendance||[]).length,hadir=(attendance||[]).filter(x=>x.status==='Hadir').length,pct=total?Math.round(hadir/total*100):null;
    if(pct!==null&&pct<75){score+=3;signals.push(`Kehadiran ${pct}%`)}
    if((assessments||[]).some(x=>x.needs_checkin)){score+=2;signals.push('Asesmen menandai kebutuhan check-in')}
    if(coaching?.[0]?.session_date){const days=(Date.now()-new Date(coaching[0].session_date).getTime())/86400000;if(days>90){score+=1;signals.push('Tidak ada coaching >90 hari')}}
    const level=score>=6?'Tinggi':score>=3?'Sedang':'Rendah';const result={ringkasan:signals.length?`Perhatian ${level.toLowerCase()}: ${signals.join('; ')}.`:'Belum ada sinyal risiko utama dari data yang tersedia.',tingkat_perhatian:level,skor_perhatian:score,signals,academic:{latest:latest?.ipk||null,previous:prev?.ipk||null},attendance:{hadir,total,pct},generated_by:'ETOS-RULES-V2-SUPABASE',requires_facilitator_review:true};
    const legacy='ATO-'+new Date().toISOString().replace(/\D/g,'').slice(0,14)+'-'+Math.floor(Math.random()*900+100);const row=(await insert('rule_analyses',{legacy_id:legacy,awardee_id:aid,awardee_name_snapshot:awd?.[0]?.name||null,analyzed_at:new Date().toISOString(),engine_version:'ETOS-RULES-V2-SUPABASE',data_fingerprint:crypto.randomUUID(),result,review_status:'belum_ditinjau'},t))?.[0];return out(res,200,{success:true,data:row});
  }

  return out(res,404,{success:false,error:`Fungsi ${fn} tidak tersedia.`});
 }catch(e){console.error(e);return out(res,500,{success:false,error:e.message||String(e)})}
};
