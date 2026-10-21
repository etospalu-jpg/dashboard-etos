'use strict';
// Tahfidz 2026 API. Reuses the authenticated Superadmin PIN session; never stores the PIN.
const session=require('./server-session');
const ROOT=session.PROJECT_URL;
function reply(res,status,data){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));}
function fault(message,status=400){const e=new Error(message);e.status=status;throw e;}
async function query(path,credential,method='GET',body=null){
 const opts={method,headers:session.dbHeaders(credential)};
 if(body!==null){opts.body=JSON.stringify(body);opts.headers.Prefer='return=representation';}
 const r=await fetch(ROOT+path,opts),t=await r.text();
 let data;try{data=t?JSON.parse(t):null}catch{fault('Respons database tidak valid.',502)}
 if(!r.ok)fault(data?.message||data?.error||'Gagal mengakses database.',r.status===401||r.status===403?403:502);
 return data;
}
async function actor(req){
 if(!session.originAllowed(req))fault('Asal permintaan tidak diizinkan.',403);
 if(!session.verify(req))fault('PIN Superadmin diperlukan untuk mencatat Tahfidz.',401);
 const c=session.credential(req);
 if(!c?.server||!c.session)fault('Sesi PIN Superadmin tidak valid.',401);
 return c;
}

function whole(v,label,min,max){const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)fault(label+' tidak valid.');return n;}
function safeDate(v,optional=false){
 if(optional&&(v==null||v===''))return null;
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fault('Tanggal tidak valid.');
 return v;
}
function uuid(v){if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))fault('ID tidak valid.');return v;}
async function planFor(credential,id){
 const rows=await query('/rest/v1/tahfidz_plans?awardee_id=eq.'+encodeURIComponent(uuid(id))+'&select=awardee_id&limit=1',credential);
 if(!rows?.length)fault('Awardee bukan peserta Tahfidz 2026.',404);
}
async function roster(credential){
 const [plans,surahs,baselines,submissions]=await Promise.all([
  query('/rest/v1/tahfidz_plans?select=awardee_id,start_date,target_date,awardees!inner(name,angkatan,status)&awardees.angkatan=eq.2026&order=awardee_id.asc',credential),
  query('/rest/v1/tahfidz_surahs?select=surah_no,name,ayah_count&order=surah_no.asc',credential),
  query('/rest/v1/tahfidz_baselines?select=awardee_id,surah_no,accepted_until,source_note',credential),
  query('/rest/v1/tahfidz_submissions?select=id,awardee_id,surah_no,kind,ayah_from,ayah_to,grade,submitted_on,notes,created_at,voided_at&order=submitted_on.desc,created_at.desc&limit=3000',credential)
 ]);
 return {plans,surahs,baselines,submissions};
}
module.exports=async function handler(req,res){
 if(req.method!=='POST')return reply(res,405,{success:false,error:'Method not allowed'});
 try{
  if(JSON.stringify(req.body||{}).length>15000)fault('Permintaan terlalu besar.',413);
  const c=await actor(req),p=req.body?.params||{},action=String(p.action||'list');
  if(action==='access')return reply(res,200,{success:true,data:{allowed:true}});
  if(action==='list')return reply(res,200,{success:true,data:await roster(c)});
  if(action==='save'){
   const id=uuid(p.awardee_id);await planFor(c,id);
   const sn=whole(p.surah_no,'Surah',1,37),sur=await query('/rest/v1/tahfidz_surahs?surah_no=eq.'+sn+'&select=ayah_count&limit=1',c);
   if(!sur?.length)fault('Surah tidak ditemukan.');
   const start=whole(p.ayah_from,'Ayat awal',1,sur[0].ayah_count),end=whole(p.ayah_to,'Ayat akhir',start,sur[0].ayah_count);
   const kind=String(p.kind||''),grade=String(p.grade||'');
   if(!['Baru','M'].includes(kind))fault('Jenis setoran tidak valid.');
   if(!['L','KL','U'].includes(grade))fault('Nilai setoran tidak valid.');
   const notes=String(p.notes||'').trim();
   if(notes.length>500)fault('Catatan terlalu panjang.');
   const row={awardee_id:id,surah_no:sn,kind,ayah_from:start,ayah_to:end,grade,notes,submitted_on:safeDate(p.submitted_on)};
   const saved=await query('/rest/v1/tahfidz_submissions?select=id',c,'POST',[row]);
   return reply(res,200,{success:true,data:{id:saved?.[0]?.id||null}});
  }
  if(action==='void'){
   const id=uuid(p.id),existing=await query('/rest/v1/tahfidz_submissions?id=eq.'+encodeURIComponent(id)+'&voided_at=is.null&select=id&limit=1',c);
   if(!existing?.length)fault('Setoran tidak ditemukan atau sudah dibatalkan.',404);
   const changed=await query('/rest/v1/tahfidz_submissions?id=eq.'+encodeURIComponent(id)+'&voided_at=is.null&select=id',c,'PATCH',{voided_at:new Date().toISOString()});
   if(!changed?.length)fault('Perubahan setoran gagal.',409);
   return reply(res,200,{success:true,data:{voided:true}});
  }
  if(action==='target'){
   const id=uuid(p.awardee_id);await planFor(c,id);
   const start=safeDate(p.start_date,true),target=safeDate(p.target_date,true);
   if(start&&target&&target<start)fault('Target tidak boleh sebelum tanggal mulai.');
   const rows=await query('/rest/v1/tahfidz_plans?awardee_id=eq.'+encodeURIComponent(id)+'&select=awardee_id',c,'PATCH',{start_date:start,target_date:target});
   if(!rows?.length)fault('Target gagal disimpan.',409);
   return reply(res,200,{success:true,data:{saved:true}});
  }
  return reply(res,400,{success:false,error:'Aksi Tahfidz tidak dikenal.'});
 }catch(e){console.warn('[tahfidz]',e.status||500,String(e.message||e).slice(0,180));return reply(res,e.status&&e.status>=400&&e.status<600?e.status:500,{success:false,error:e.status===502||!e.status?'Layanan Tahfidz belum tersedia.':e.message});}
};