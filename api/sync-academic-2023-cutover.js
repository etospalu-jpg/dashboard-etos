const crypto=require('crypto');
const PROJECT_URL='https://weklmapqizeldfdalbgs.supabase.co';
const TOKEN_HASH='ae0e90dd05130404f8afd595c480e119bd19dddfa498de190d56d2868c956b84';
const ROWS=[
 {legacy_id:'AKD-053',awardee:'AWD-0008',semester:6,ipk:3.75},
 {legacy_id:'AKD-054',awardee:'AWD-0009',semester:6,ipk:3.97},
 {legacy_id:'AKD-055',awardee:'AWD-0010',semester:6,ipk:3.96},
 {legacy_id:'AKD-056',awardee:'AWD-0011',semester:6,ipk:3.87},
 {legacy_id:'AKD-057',awardee:'AWD-0012',semester:6,ipk:3.89},
 {legacy_id:'AKD-058',awardee:'AWD-0013',semester:6,ipk:3.79},
 {legacy_id:'AKD-059',awardee:'AWD-0014',semester:6,ipk:4.00},
 {legacy_id:'AKD-060',awardee:'AWD-0015',semester:6,ipk:3.95},
 {legacy_id:'AKD-061',awardee:'AWD-0016',semester:6,ipk:3.66}
];
function out(res,status,body){res.status(status);res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
function sha(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
async function req(path,{method='GET',body,key,headers={}}={}){const o={method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...headers}};if(body!==undefined)o.body=JSON.stringify(body);const r=await fetch(PROJECT_URL+path,o);const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={message:text}}if(!r.ok)throw new Error(data?.message||data?.error||data?.hint||`Supabase ${r.status}`);return data}
async function sync(service){const ids=ROWS.map(x=>x.awardee);const awards=await req('/rest/v1/awardees?legacy_id=in.('+ids.map(encodeURIComponent).join(',')+')&select=id,legacy_id,name,angkatan',{key:service});const map=new Map((awards||[]).map(x=>[x.legacy_id,x]));const missing=ids.filter(id=>!map.has(id));if(missing.length)throw new Error('Awardee Supabase belum lengkap: '+missing.join(', '));for(const row of ROWS){const a=map.get(row.awardee);if(String(a.angkatan)!=='2023')throw new Error(`${row.awardee} bukan angkatan 2023 di Supabase.`);const ex=await req(`/rest/v1/academic_records?awardee_id=eq.${encodeURIComponent(a.id)}&semester=eq.6&select=id,legacy_id,ipk`,{key:service});if(ex?.[0])await req(`/rest/v1/academic_records?id=eq.${encodeURIComponent(ex[0].id)}`,{method:'PATCH',body:{ipk:row.ipk},key:service,headers:{Prefer:'return=minimal'}});else await req('/rest/v1/academic_records',{method:'POST',body:[{legacy_id:row.legacy_id,awardee_id:a.id,semester:6,ipk:row.ipk}],key:service,headers:{Prefer:'return=minimal'}})}const verified=[];for(const row of ROWS){const a=map.get(row.awardee);const got=await req(`/rest/v1/academic_records?awardee_id=eq.${encodeURIComponent(a.id)}&semester=eq.6&select=legacy_id,semester,ipk`,{key:service});const r=got?.[0];if(!r||Number(r.semester)!==6||Math.abs(Number(r.ipk)-row.ipk)>0.0001)throw new Error(`Verifikasi gagal untuk ${row.awardee}.`);verified.push({awardee:row.awardee,name:a.name,semester:6,ipk:Number(r.ipk)})}return verified}
module.exports=async function handler(req,res){if(req.method!=='GET')return out(res,405,{success:false,error:'Method not allowed'});if(sha(req.query?.token)!==TOKEN_HASH)return out(res,404,{success:false,error:'Not found'});const service=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();if(!service)return out(res,503,{success:false,error:'Server credential Supabase belum tersedia.'});try{const rows=await sync(service);return out(res,200,{success:true,source:'DASHBOARD AWARDEE ETOS ID PALU / Akademik',cohort:'2023',semester:6,verified:rows.length,rows})}catch(e){console.error('[sync-academic-2023-cutover]',e&&e.message?e.message:e);return out(res,500,{success:false,error:e.message||'Sinkronisasi gagal.'})}}
