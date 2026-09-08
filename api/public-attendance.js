const PROJECT_URL='https://weklmapqizeldfdalbgs.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const PUBLIC_EDGE=PROJECT_URL+'/functions/v1/public-api';
const REFLECTION_EDGE=PROJECT_URL+'/functions/v1/public-reflection';
const ASSESSMENT_EDGE=PROJECT_URL+'/functions/v1/awardee-assessment';
const LAUNCH_DATE='2026-09-07';
const PUBLIC_FUNCTIONS=new Set(['getDashboardStats','getFeaturedAwardees','getAwardeeList','getAlumniList','getAkademikList','getPrestasiList','getOrganisasiList','getAwardeeProfile','getDropdownOptions']);
const REFLECTION_FUNCTIONS=new Set(['getPublicKajianReflectionForm','verifyKajianReflectionParticipant','submitKajianReflection']);
function out(res,status,body,cache='public, max-age=15, s-maxage=30, stale-while-revalidate=60'){res.status(status).setHeader('Content-Type','application/json');res.setHeader('Cache-Control',cache);res.end(JSON.stringify(body))}
function auth(){const service=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();return{service,key:service||PUBLISHABLE_KEY}}
async function q(path){const a=auth();const headers={apikey:a.key};if(a.service)headers.Authorization=`Bearer ${a.service}`;const r=await fetch(PROJECT_URL+path,{headers});const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!r.ok)throw new Error(body?.message||body?.error||`Supabase ${r.status}`);return body}
async function edge(url,payload){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify(payload)});const text=await r.text();let b={};try{b=text?JSON.parse(text):{}}catch{b={success:false,error:'Respons Supabase tidak valid.'}}if(!r.ok||b?.success===false){const e=new Error(b?.error||b?.message||`Supabase Edge ${r.status}`);e.status=r.status;throw e}return b}
async function publicData(req,res){const fn=String(req.body?.function||'');if(!PUBLIC_FUNCTIONS.has(fn))return out(res,400,{success:false,error:'Fungsi data publik tidak valid.'},'no-store');try{const b=await edge(PUBLIC_EDGE,{function:fn,params:req.body?.params??null});b.source='supabase';return out(res,200,b)}catch(e){console.warn('[public-data]',fn,e.message);return out(res,502,{success:false,error:'Data Supabase tidak dapat dibaca saat ini.',source:'supabase'},'no-store')}}
function reflectionPayload(fn,params){const p=params&&typeof params==='object'?{...params}:{};if(fn==='getPublicKajianReflectionForm'){return{action:'form',formToken:params}}if(fn==='verifyKajianReflectionParticipant')return{...p,action:'verify'};return{...p,action:'submit'}}
async function reflectionData(req,res){const fn=String(req.body?.function||'');if(!REFLECTION_FUNCTIONS.has(fn))return out(res,400,{success:false,error:'Fungsi refleksi tidak valid.'},'no-store');try{return out(res,200,await edge(REFLECTION_EDGE,reflectionPayload(fn,req.body?.params)),'no-store')}catch(e){console.warn('[reflection-data]',fn,e.message);return out(res,502,{success:false,error:'Layanan refleksi Supabase tidak tersedia.'},'no-store')}}
async function assessmentHealth(res){try{const b=await edge(ASSESSMENT_EDGE,{action:'hub'});return out(res,200,{success:true,data:{edge:'healthy',awardeeCount:Array.isArray(b?.data?.awardees)?b.data.awardees.length:0}})}catch(e){return out(res,502,{success:false,error:'Assessment edge tidak terjangkau.'},'no-store')}}
async function dataHealth(res){try{const [stats,list]=await Promise.all([edge(PUBLIC_EDGE,{function:'getDashboardStats',params:null}),edge(PUBLIC_EDGE,{function:'getAwardeeList',params:null})]);const rows=Array.isArray(list?.data)?list.data:[];return out(res,200,{success:true,data:{source:'supabase',total:Number(stats?.data?.total??rows.length),active:Number(stats?.data?.aktif??0),alumni:Number(stats?.data?.alumni??0),withPhoto:rows.filter(x=>String(x.photo_url||x.foto||'').trim()).length}})}catch(e){console.warn('[data-health]',e.message);return out(res,502,{success:false,error:'Supabase public data belum sehat.'},'no-store')}}
module.exports=async function handler(req,res){
 if(!['GET','POST'].includes(req.method))return out(res,405,{success:false,error:'Method not allowed'},'no-store');
 if(req.method==='GET'&&String(req.query?.assessment_health||'')==='1')return assessmentHealth(res);
 if(req.method==='GET'&&String(req.query?.data_health||'')==='1')return dataHealth(res);
 if(req.method==='POST'&&req.body?.action==='public_data')return publicData(req,res);
 if(req.method==='POST'&&req.body?.action==='reflection_data')return reflectionData(req,res);
 try{
  const p=req.method==='POST'?(req.body?.params??req.body):req.query;
  const periods=await q('/rest/v1/development_periods?select=id,legacy_id,name,start_date,end_date,status&order=start_date.desc.nullslast');
  const pp=(periods||[]).map(x=>({id:x.legacy_id||x.id,uuid:x.id,nama:x.name,mulai:x.start_date||'',selesai:x.end_date||'',status:x.status}));
  const requested=typeof p==='string'?p:String(p?.periodeId||'');
  const selected=pp.find(x=>x.id===requested)||pp.find(x=>String(x.status).toLowerCase()==='aktif')||pp[0]||null;
  if(!selected)return out(res,200,{success:true,data:{items:[],periods:[],selectedPeriod:null,legacyMode:false,unresolvedTahsin:0,freshStart:true}});
  const sessions=await q(`/rest/v1/attendance_sessions?period_id=eq.${encodeURIComponent(selected.uuid)}&activity_date=gte.${LAUNCH_DATE}&select=id`);
  const ids=(sessions||[]).map(x=>x.id);
  if(!ids.length)return out(res,200,{success:true,data:{items:[],periods:pp,selectedPeriod:selected,legacyMode:false,unresolvedTahsin:0,freshStart:true}});
  const records=await q(`/rest/v1/attendance_records?session_id=in.(${ids.map(encodeURIComponent).join(',')})&select=status,awardees!inner(legacy_id,name,angkatan)`);
  const map=new Map();
  for(const r of records||[]){const a=r.awardees,k=a.legacy_id;if(!map.has(k))map.set(k,{id:k,nama:a.name,angkatan:a.angkatan,h:0,i:0,s:0,a:0,total:0});const x=map.get(k);x.total++;const st=String(r.status||'').toLowerCase();if(st==='hadir')x.h++;else if(st==='izin')x.i++;else if(st==='sakit')x.s++;else if(st==='alpa')x.a++}
  const items=[...map.values()].map(x=>({...x,pct:x.total?Math.round(x.h/x.total*100):0})).sort((a,b)=>a.pct-b.pct||String(a.nama).localeCompare(String(b.nama),'id'));
  return out(res,200,{success:true,data:{items,periods:pp,selectedPeriod:selected,legacyMode:false,unresolvedTahsin:0,freshStart:true}})
 }catch(e){console.warn('[public-attendance]',e.message);return out(res,200,{success:true,data:{items:[],periods:[],selectedPeriod:null,legacyMode:false,unresolvedTahsin:0,freshStart:true},source:'fresh-start',warning:'Absensi dimulai dari September 2026.'})}
};
