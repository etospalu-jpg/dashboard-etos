const store=require('../google-oauth-store');
const session=require('../server-session');
const REDIRECT_URI='https://etosidpalu.vercel.app/api/google-oauth-callback';
const EXPECTED_EMAIL='etospalu@gmail.com';
const FILE_ID='1OzW2RfiXL5SmqLOJx-t4Grimy7usdnSqVvSQszZ8WvQ';
const SOURCE_GID='1973014346';
const XLSX='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function redirect(res,path){res.statusCode=302;res.setHeader('Cache-Control','no-store');res.setHeader('Location',path);res.end()}
async function userEmail(access){const r=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+access}});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error_description||b?.error||'Email akun Google tidak dapat diverifikasi.');return String(b?.email||'').toLowerCase().trim()}
async function sheetsCheck(access){const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${FILE_ID}?includeGridData=false&fields=properties.title`,{headers:{Authorization:'Bearer '+access}});const b=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(b?.error?.message||`Google Sheets HTTP ${r.status}`);e.status=r.status;throw e}return{mode:'oauth-sheets-readonly',title:b?.properties?.title||'IDP Pusat'}}
async function gvizCheck(access){const url=`https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&headers=1&gid=${encodeURIComponent(SOURCE_GID)}`;const r=await fetch(url,{headers:{Authorization:'Bearer '+access,'Cache-Control':'no-store'},redirect:'follow'});const text=await r.text();if(!r.ok||/<!doctype html|<html|accounts\.google\.com|servicelogin/i.test(text)||!text.trim()){const e=new Error(`Google Visualization HTTP ${r.status}`);e.status=r.status;throw e}return{mode:'oauth-gviz-readonly',title:'IDP Pusat'}}
async function driveCheck(access){
  const mr=await fetch(`https://www.googleapis.com/drive/v3/files/${FILE_ID}?fields=id,name,mimeType,modifiedTime,resourceKey&supportsAllDrives=true`,{headers:{Authorization:'Bearer '+access,'Cache-Control':'no-store'}});
  const meta=await mr.json().catch(()=>({}));
  if(!mr.ok){const e=new Error(meta?.error?.message||`Google Drive HTTP ${mr.status}`);e.status=mr.status;throw e}
  const googleSheet=meta?.mimeType==='application/vnd.google-apps.spreadsheet';
  const url=googleSheet?`https://www.googleapis.com/drive/v3/files/${FILE_ID}/export?mimeType=${encodeURIComponent(XLSX)}`:`https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media&supportsAllDrives=true`;
  const rr=await fetch(url,{headers:{Authorization:'Bearer '+access,'Cache-Control':'no-store'}});
  const buf=Buffer.from(await rr.arrayBuffer());
  if(!rr.ok||buf.length<4||buf[0]!==0x50||buf[1]!==0x4b){let msg=`Google Drive content HTTP ${rr.status}`;try{const j=JSON.parse(buf.toString('utf8'));msg=j?.error?.message||msg}catch{}const e=new Error(msg);e.status=rr.status;throw e}
  return{mode:googleSheet?'oauth-drive-export-readonly':'oauth-drive-download-readonly',title:meta?.name||'IDP Pusat',mimeType:meta?.mimeType||'',modifiedTime:meta?.modifiedTime||null}
}
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
    let source=null,sheetsError=null,gvizError=null;
    try{source=await sheetsCheck(body.access_token)}catch(e){sheetsError=e}
    if(!source){try{source=await gvizCheck(body.access_token)}catch(e){gvizError=e}}
    if(!source){try{source=await driveCheck(body.access_token)}catch(e){throw new Error(`OAuth ${email} berhasil, tetapi IDP pusat menolak semua jalur baca. Sheets: ${sheetsError?.message||'gagal'}; Visualization: ${gvizError?.message||'gagal'}; Drive: ${e.message||'gagal'}`)}}
    await store.saveConfig({clientId:cfg.clientId,clientSecret:cfg.clientSecret,refreshToken,pendingState:''},{connectedAt:new Date().toISOString(),account:email,sheetTitle:source.title,scope:'spreadsheets.readonly drive.readonly',mode:source.mode,mimeType:source.mimeType||null,sourceModifiedAt:source.modifiedTime||null});
    return redirect(res,'/oauth-setup?connected=1');
  }catch(e){console.error('[Google OAuth callback]',e);return redirect(res,'/oauth-setup?error='+encodeURIComponent(String(e.message||'callback')))}
};
