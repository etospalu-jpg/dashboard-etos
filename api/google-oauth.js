const store=require('../google-oauth-store');
const session=require('../server-session');
const REDIRECT_URI='https://etosidpalu.vercel.app/api/google-oauth-callback';
const SCOPE='https://www.googleapis.com/auth/spreadsheets.readonly';
function out(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
module.exports=async function handler(req,res){
  try{
    if(!session.originAllowed(req))return out(res,403,{success:false,error:'Origin request tidak diizinkan.'});
    if(!session.verify(req))return out(res,401,{success:false,error:'PIN Superadmin diperlukan.'});
    if(req.method==='GET')return out(res,200,{success:true,data:await store.status()});
    if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
    const clientId=String(req.body?.clientId||'').trim(),clientSecret=String(req.body?.clientSecret||'').trim();
    if(!clientId||!clientSecret)return out(res,400,{success:false,error:'Client ID dan Client Secret wajib diisi.'});
    const current=await store.getConfig().catch(()=>null),state=store.stateToken();
    await store.saveConfig({clientId,clientSecret,refreshToken:current?.refreshToken||'',pendingState:state},{connectedAt:current?.refreshToken?new Date().toISOString():null,account:'etospalu@gmail.com'});
    const params=new URLSearchParams({client_id:clientId,redirect_uri:REDIRECT_URI,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',include_granted_scopes:'true',state});
    return out(res,200,{success:true,data:{authorizeUrl:'https://accounts.google.com/o/oauth2/v2/auth?'+params.toString()}});
  }catch(e){console.error('[Google OAuth setup]',e);return out(res,500,{success:false,error:e.message||'Setup OAuth gagal.'})}
};
