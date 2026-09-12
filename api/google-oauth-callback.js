const store=require('../google-oauth-store');
const session=require('../server-session');
const REDIRECT_URI='https://etosidpalu.vercel.app/api/google-oauth-callback';
const EXPECTED_EMAIL='etospalu@gmail.com';
const MIRROR_ID='1lMb6sTh54JHYskVLQflrJKbB0SYbi488k-i02Iw_HXE';
function redirect(res,path){res.statusCode=302;res.setHeader('Cache-Control','no-store');res.setHeader('Location',path);res.end()}
async function userEmail(access){const r=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+access}});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error_description||b?.error||'Email akun Google tidak dapat diverifikasi.');return String(b?.email||'').toLowerCase().trim()}
async function mirrorCheck(access){const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${MIRROR_ID}?includeGridData=false&fields=properties.title,sheets.properties(title)`,{headers:{Authorization:'Bearer '+access,'Cache-Control':'no-store'}});const b=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(b?.error?.message||`Google Sheets HTTP ${r.status}`);e.status=r.status;throw e}return{title:b?.properties?.title||'ETOS Palu - IDP Live Mirror',sheets:(b?.sheets||[]).map(x=>x?.properties?.title).filter(Boolean)}}
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
    const email=await userEmail(body.access_token);
    if(email!==EXPECTED_EMAIL)throw new Error(`Akun OAuth yang dipilih ${email||'(tidak diketahui)'}, bukan ${EXPECTED_EMAIL}.`);
    const refreshToken=String(body.refresh_token||cfg.refreshToken||'').trim();
    if(!refreshToken)throw new Error('Google tidak mengirim refresh token. Ulangi koneksi dengan prompt consent.');
    const mirror=await mirrorCheck(body.access_token);
    await store.saveConfig({clientId:cfg.clientId,clientSecret:cfg.clientSecret,refreshToken,pendingState:''},{connectedAt:new Date().toISOString(),account:email,sheetTitle:mirror.title,scope:'spreadsheets.readonly',mode:'oauth-mirror-readonly',mirrorId:MIRROR_ID,mirrorSheets:mirror.sheets});
    return redirect(res,'/oauth-setup?connected=1&mirror=1');
  }catch(e){console.error('[Google OAuth callback]',e);return redirect(res,'/oauth-setup?error='+encodeURIComponent(String(e.message||'callback')))}
};
