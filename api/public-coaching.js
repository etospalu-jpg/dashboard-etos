const session=require('../server-session');
function out(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
  if(!session.verify(req))return out(res,401,{success:false,error:'PIN fasilitator diperlukan untuk data coaching.'});
  if(String(req.body?.function||'')!=='getCoachingList')return out(res,400,{success:false,error:'Fungsi coaching publik tidak valid.'});
  try{
    const r=await fetch(session.PROJECT_URL+'/functions/v1/public-api',{
      method:'POST',
      headers:{apikey:session.PUBLISHABLE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({function:'getCoachingList',params:req.body?.params??null})
    });
    const b=await r.json().catch(()=>({}));
    if(!r.ok||b?.success===false)throw new Error(b?.error||('Supabase '+r.status));
    return out(res,200,{success:true,data:b.data||[],source:'supabase-public-api'});
  }catch(e){
    console.error('[public-coaching]',e);
    return out(res,500,{success:false,error:'Data coaching belum dapat dibaca.'});
  }
};
