const session=require('../server-session');
function out(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
function serverCredential(){
  const key=session.secret(),kind=session.kind(key);
  if(!key||!['secret','legacy'].includes(kind))throw new Error('Koneksi database coaching belum tersedia.');
  return{server:true,key,kind};
}
async function query(path){
  const c=serverCredential();
  const r=await fetch(session.PROJECT_URL+path,{headers:session.dbHeaders(c)});
  const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
  if(!r.ok)throw new Error(body?.message||body?.error||`Supabase ${r.status}`);
  return body;
}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
  if(String(req.body?.function||'')!=='getCoachingList')return out(res,400,{success:false,error:'Fungsi coaching publik tidak valid.'});
  try{
    const rows=await query('/rest/v1/coaching_sessions?select=legacy_id,session_date,topic_problem,solution,follow_up_plan,awardees!inner(legacy_id,name)&order=session_date.desc.nullslast');
    const data=(rows||[]).map(x=>({id:x.legacy_id,awdId:x.awardees?.legacy_id,nama:x.awardees?.name||'Unknown',tgl:x.session_date||'-',topik:x.topic_problem||'-',solusi:x.solution||'-',rtl:x.follow_up_plan||'-'}));
    return out(res,200,{success:true,data,source:'supabase-readonly'});
  }catch(e){console.error('[public-coaching]',e);return out(res,500,{success:false,error:'Data coaching belum dapat dibaca.'})}
};
