const PROJECT_URL='https://weklmapqizeldfdalbgs.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const PUBLIC_EDGE=PROJECT_URL+'/functions/v1/public-api';
const REFLECTION_EDGE=PROJECT_URL+'/functions/v1/public-reflection';
const PUBLIC_FUNCTIONS=new Set(['getDashboardStats','getFeaturedAwardees','getAwardeeList','getAlumniList','getAkademikList','getPrestasiList','getOrganisasiList','getAwardeeProfile','getDropdownOptions']);
const REFLECTION_FUNCTIONS=new Set(['getPublicKajianReflectionForm','verifyKajianReflectionParticipant','submitKajianReflection']);
function out(res,status,body,cache='public, max-age=15, s-maxage=30, stale-while-revalidate=60'){res.status(status).setHeader('Content-Type','application/json');res.setHeader('Cache-Control',cache);res.end(JSON.stringify(body))}
async function edge(url,payload){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify(payload)});const text=await r.text();let b={};try{b=text?JSON.parse(text):{}}catch{b={success:false,error:'Respons Supabase tidak valid.'}}if(!r.ok||b?.success===false){const e=new Error(b?.error||b?.message||`Supabase Edge ${r.status}`);e.status=r.status;throw e}return b}
async function publicData(req,res){const fn=String(req.body?.function||'');if(!PUBLIC_FUNCTIONS.has(fn))return out(res,400,{success:false,error:'Fungsi data publik tidak valid.'},'no-store');try{const b=await edge(PUBLIC_EDGE,{function:fn,params:req.body?.params??null});b.source='supabase';return out(res,200,b)}catch(e){console.warn('[public-data]',fn,e.message);return out(res,502,{success:false,error:'Data Supabase tidak dapat dibaca saat ini.',source:'supabase'},'no-store')}}
function reflectionPayload(fn,params){const p=params&&typeof params==='object'?{...params}:{};if(fn==='getPublicKajianReflectionForm')return{action:'form',formToken:params};if(fn==='verifyKajianReflectionParticipant')return{...p,action:'verify'};return{...p,action:'submit'}}
async function reflectionData(req,res){const fn=String(req.body?.function||'');if(!REFLECTION_FUNCTIONS.has(fn))return out(res,400,{success:false,error:'Fungsi refleksi tidak valid.'},'no-store');try{return out(res,200,await edge(REFLECTION_EDGE,reflectionPayload(fn,req.body?.params)),'no-store')}catch(e){console.warn('[reflection-data]',fn,e.message);return out(res,502,{success:false,error:'Layanan refleksi Supabase tidak tersedia.'},'no-store')}}
async function dataHealth(res){try{const [stats,list]=await Promise.all([edge(PUBLIC_EDGE,{function:'getDashboardStats',params:null}),edge(PUBLIC_EDGE,{function:'getAwardeeList',params:null})]);const rows=Array.isArray(list?.data)?list.data:[];return out(res,200,{success:true,data:{source:'supabase',total:Number(stats?.data?.total??rows.length),active:Number(stats?.data?.aktif??0),alumni:Number(stats?.data?.alumni??0),withPhoto:rows.filter(x=>String(x.photo_url||x.foto||'').trim()).length}})}catch(e){console.warn('[data-health]',e.message);return out(res,502,{success:false,error:'Supabase public data belum sehat.'},'no-store')}}
module.exports=async function handler(req,res){
 if(!['GET','POST'].includes(req.method))return out(res,405,{success:false,error:'Method not allowed'},'no-store');
 if(req.method==='GET'&&String(req.query?.data_health||'')==='1')return dataHealth(res);
 if(req.method==='POST'&&req.body?.action==='public_data')return publicData(req,res);
 if(req.method==='POST'&&req.body?.action==='reflection_data')return reflectionData(req,res);
 return out(res,404,{success:false,error:'Endpoint publik hanya melayani data Supabase publik dan refleksi.'},'no-store');
};
