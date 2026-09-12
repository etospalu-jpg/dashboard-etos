const session=require('../server-session');
const drive=require('../idp-drive-fallback');
function out(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
function serverCredential(){
  const key=session.secret(),kind=session.kind(key);
  if(!key||!['secret','legacy'].includes(kind))throw new Error('Koneksi database IDP belum tersedia.');
  return{server:true,key,kind};
}
async function awards(){
  const c=serverCredential();
  const r=await fetch(session.PROJECT_URL+'/rest/v1/awardees?status=neq.Lulus&select=legacy_id,name,angkatan,status&order=name.asc',{headers:session.dbHeaders(c)});
  const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
  if(!r.ok)throw new Error(body?.message||body?.error||`Supabase ${r.status}`);
  return Array.isArray(body)?body:[];
}
module.exports=async function handler(req,res){
  try{
    if(req.method==='GET'&&String(req.query?.source_health||'')==='1'){
      const data=await drive.health(true);
      return out(res,200,{success:true,data});
    }
    if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
    const fn=String(req.body?.function||'getIDPOverview'),p=req.body?.params||{},force=!!p.forceRefresh,role=session.verify(req)?'superadmin':'public';
    if(fn==='getIDPDetail'){
      const name=String(p.nama||p.name||'').trim();if(!name)return out(res,400,{success:false,error:'Nama Awardee diperlukan.'});
      const aw=await awards(),a=aw.find(x=>String(x.name||'').trim().toLowerCase()===name.toLowerCase())||{name,angkatan:''};
      const data=await drive.detail(name,a.angkatan,force);data.accessRole=role;return out(res,200,{success:true,data});
    }
    if(fn!=='getIDPOverview')return out(res,400,{success:false,error:'Fungsi IDP tidak valid.'});
    const data=await drive.overview(await awards(),force);data.accessRole=role;return out(res,200,{success:true,data});
  }catch(e){console.error('[IDP live Drive]',e);return out(res,500,{success:false,error:e.message||'Koneksi IDP pusat gagal.'})}
};
