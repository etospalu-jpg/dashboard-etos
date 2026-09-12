const store=require('../google-oauth-store');
const session=require('../server-session');
const REDIRECT_URI='https://etosidpalu.vercel.app/api/google-oauth-callback';
function redirect(res,path){res.statusCode=302;res.setHeader('Cache-Control','no-store');res.setHeader('Location',path);res.end()}
module.exports=async function handler(req,res){
  try{
    if(req.method!=='GET')return redirect(res,'/oauth-setup?error=method');
    if(!session.verify(req))return redirect(res,'/oauth-setup?error=session');
    const code=String(req.query?.code||'').trim(),state=String(req.query?.state||'').trim();
    if(!code||!state)return redirect(res,'/oauth-setup?error=oauth_response');
    const cfg=await store.getConfig();
    if(!cfg?.clientId||!cfg?.clientSecret||!cfg?.pendingState||!store.safeEqual(state,cfg.pendingState))return redirect(res,'/oauth-setup?error=state');
    const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:cfg.clientId,client_secret:cfg.clientSecret,redirect_uri:REDIRECT_URI,grant_type:'authorization_code'})});
    const body=await r.json().catch(()=>({}));
    if(!r.ok||!body.access_token)throw new Error(body.error_description||body.error||'Pertukaran token Google gagal.');
    const refreshToken=String(body.refresh_token||cfg.refreshToken||'').trim();
    if(!refreshToken)throw new Error('Google tidak mengirim refresh token. Ulangi koneksi dengan prompt consent.');
    const check=await fetch('https://sheets.googleapis.com/v4/spreadsheets/1OzW2RfiXL5SmqLOJx-t4Grimy7usdnSqVvSQszZ8WvQ?includeGridData=false&fields=properties.title',{headers:{Authorization:'Bearer '+body.access_token}});
    const checkBody=await check.json().catch(()=>({}));
    if(!check.ok)throw new Error(checkBody?.error?.message||'Akun Google belum dapat membaca IDP pusat.');
    await store.saveConfig({clientId:cfg.clientId,clientSecret:cfg.clientSecret,refreshToken,pendingState:''},{connectedAt:new Date().toISOString(),account:'etospalu@gmail.com',sheetTitle:checkBody?.properties?.title||'IDP Pusat',scope:'spreadsheets.readonly'});
    return redirect(res,'/oauth-setup?connected=1');
  }catch(e){console.error('[Google OAuth callback]',e);return redirect(res,'/oauth-setup?error='+encodeURIComponent(String(e.message||'callback')))}
};
