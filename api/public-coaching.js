const session=require('../server-session');
const secure=require('../secure-cookie');
function out(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
  if(!session.verify(req))return out(res,401,{success:false,error:'PIN fasilitator diperlukan untuk data coaching.'});
  if(String(req.body?.function||'')!=='getCoachingList')return out(res,400,{success:false,error:'Fungsi coaching tidak valid.'});
  return secure(req,res);
};