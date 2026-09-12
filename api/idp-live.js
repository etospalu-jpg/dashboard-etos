const session=require('../server-session');
const sheet=require('../idp-google-sheet');
const drive=require('../idp-drive-fallback');

function out(res,status,body){
  res.status(status).setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}
function serverCredential(){
  const key=session.secret(),kind=session.kind(key);
  if(!key||!['secret','legacy'].includes(kind))throw new Error('Koneksi database IDP belum tersedia.');
  return{server:true,key,kind};
}
async function awards(){
  const c=serverCredential();
  const r=await fetch(session.PROJECT_URL+'/rest/v1/awardees?status=neq.Lulus&select=legacy_id,name,angkatan,status&order=name.asc',{headers:session.dbHeaders(c)});
  const text=await r.text();let body=null;
  try{body=text?JSON.parse(text):null}catch{body=text}
  if(!r.ok)throw new Error(body?.message||body?.error||`Supabase ${r.status}`);
  return Array.isArray(body)?body:[];
}
function fallbackMeta(data,error){
  data.fallback=true;
  data.preferredSource={sourceName:sheet.SOURCE_NAME,sourceId:sheet.FILE_ID,sourceGid:sheet.SOURCE_GID};
  data.preferredSourceError=error?.message||String(error||'Google Sheet utama belum tersedia.');
  return data;
}
async function overview(force=false){
  const active=await awards();
  try{return await sheet.overview(active,force)}
  catch(error){return fallbackMeta(await drive.overview(active,force),error)}
}
async function detail(name,force=false){
  const active=await awards();
  const a=active.find(x=>String(x.name||'').trim().toLowerCase()===String(name||'').trim().toLowerCase())||{name,angkatan:''};
  try{return await sheet.detail(name,a.angkatan,force)}
  catch(error){return fallbackMeta(await drive.detail(name,a.angkatan,force),error)}
}
async function health(force=true){
  try{return await sheet.health(force)}
  catch(error){return fallbackMeta(await drive.health(force),error)}
}
module.exports=async function handler(req,res){
  try{
    if(req.method==='GET'&&String(req.query?.source_health||'')==='1'){
      const data=await health(true);
      return out(res,200,{success:true,data,warning:data.fallback?'Google Sheet utama belum dapat dibaca; sumber cadangan Drive masih aktif.':undefined});
    }
    if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
    const fn=String(req.body?.function||'getIDPOverview'),p=req.body?.params||{},force=!!p.forceRefresh;
    const accessRole=session.verify(req)?'superadmin':'public';
    if(fn==='getIDPDetail'){
      const name=String(p.nama||p.name||'').trim();
      if(!name)return out(res,400,{success:false,error:'Nama Awardee diperlukan.'});
      const data=await detail(name,force);data.accessRole=accessRole;
      return out(res,200,{success:true,data});
    }
    if(fn!=='getIDPOverview')return out(res,400,{success:false,error:'Fungsi IDP tidak valid.'});
    const data=await overview(force);data.accessRole=accessRole;
    return out(res,200,{success:true,data});
  }catch(e){
    console.error('[IDP live]',e);
    return out(res,500,{success:false,error:e.message||'Koneksi IDP pusat gagal.'});
  }
};
