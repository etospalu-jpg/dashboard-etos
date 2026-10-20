'use strict';
const { createClient } = require('@supabase/supabase-js');
const session = require('../server-session');
const { fetchReports } = require('./adapter.cjs');
const { eligibleOnly } = require('./cohort.cjs');
function respond(res,code,data){res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store');res.end(JSON.stringify(data));}
module.exports=async function murajaah(req,res){
 if(req.method!=='POST'||!session.verify(req)||!session.originAllowed(req))return respond(res,401,{error:'Akses fasilitator diperlukan'});
 if(!session.credential(req)?.server)return respond(res,401,{error:'Sesi tidak valid'});
 try {
  const key=session.secret();
  if(!['secret','legacy'].includes(session.kind(key)))throw Error('Supabase server credential unavailable');
  const db=createClient(session.PROJECT_URL,key,{auth:{autoRefreshToken:false,persistSession:false},global:{fetch:session.proxyFetch}});
  const {data:roster,error}=await db.from('awardees').select('id,name,angkatan').eq('angkatan','2023');
  if(error)throw error;
  const allowed=eligibleOnly(roster||[]);
  const ids=new Set(allowed.map(a=>a.id.toLowerCase()));
  const report=await fetchReports({token:process.env.MURAJAAH_API_TOKEN||undefined});
  const accepted=[],unmatched=[];
  for(const entry of report.records){
   const raw=entry.raw;
   const id=String(raw.awardee_id||raw.awardeeId||raw.etos_awardee_id||'').toLowerCase();
   if(id&&ids.has(id)){accepted.push({awardee_id:id,record:raw});}else unmatched.push(entry.sourceIndex);
  }
  return respond(res,200,{success:true,cohort:'2023',awardees:allowed.length,records:accepted,unmatched_count:unmatched.length,source_count:report.records.length,fetched_at:report.fetchedAt,read_only:true});
 } catch(e){return respond(res,502,{success:false,error:String(e?.message||e).slice(0,200)});}
};
