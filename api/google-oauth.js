const store=require('../google-oauth-store');
const session=require('../server-session');
const REDIRECT_URI='https://etosidpalu.vercel.app/api/google-oauth-callback';
const EXPECTED_EMAIL='etospalu@gmail.com';
const SCOPE='openid email https://www.googleapis.com/auth/spreadsheets.readonly';
function out(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
module.exports=async function handler(req,res){
  try{
    if(!session.originAllowed(req))return out(res,403,{success:false,error:'Origin request tidak diizinkan.'});
    if(!session.verify(req))return out(res,401,{success:false,error:'PIN Superadmin diperlukan.'});
    if(req.method==='GET')return out(res,200,{success:true,data:await store.status()});
    if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
    const current=await store.getConfig().catch(()=>null),reuse=req.body?.reuse===true;
    const clientId=String(reuse?current?.clientId:req.body?.clientId||'').trim();
    const clientSecret=String(reuse?current?.clientSecret:req.body?.clientSecret||'').trim();
    if(!clientId||!clientSecret)return out(res,400,{success:false,error:'Client ID dan Client Secret belum tersimpan.'});
    const state=store.stateToken();
    await store.saveConfig({clientId,clientSecret,refreshToken:current?.refreshToken||'',pendingState:state},{connectedAt:current?.refreshToken?new Date().toISOString():null,account:EXPECTED_EMAIL,lastAttemptAt:new Date().toISOString()});
    const params=new URLSearchParams({client_id:clientId,redirect_uri:REDIRECT_URI,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',include_granted_scopes:'true',login_hint:EXPECTED_EMAIL,state});
    return out(res,200,{success:true,data:{authorizeUrl:'https://accounts.google.com/o/oauth2/v2/auth?'+params.toString(),expectedAccount:EXPECTED_EMAIL}});
  }catch(e){console.error('[Google OAuth setup]',e);return out(res,500,{success:false,error:e.message||'Setup OAuth gagal.'})}
};
