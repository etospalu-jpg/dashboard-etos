const crypto=require('crypto');
const session=require('./server-session');
const driveFallback=require('./idp-drive-fallback');

const FILE_ID='1OzW2RfiXL5SmqLOJx-t4Grimy7usdnSqVvSQszZ8WvQ';
const SOURCE_NAME='IDP ETOS Palu — Google Sheet';
const SOURCE_GID='1973014346';
let cache={meta:null,t:0};
const publicCache=new Map();

function out(res,status,body){
  res.status(status).setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}
function bad(message,status=403){const e=new Error(message);e.status=status;throw e}
async function q(path,c){
  const r=await fetch(session.PROJECT_URL+path,{headers:session.dbHeaders(c)});
  const text=await r.text();let body=null;
  try{body=text?JSON.parse(text):null}catch{body=text}
  if(!r.ok){const e=new Error(body?.message||body?.error_description||body?.error||`Supabase ${r.status}`);e.status=r.status;throw e}
  return body;
}
async function authorize(req){
  const c=session.credential(req);
  if(!c)bad('Akses autentikasi diperlukan.',401);
  if(c.server)return{c,role:'superadmin'};
  const user=await q('/auth/v1/user',c);
  const rows=await q(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,is_active`,c);
  const p=rows?.[0];
  if(!p?.is_active)bad('Akun belum aktif.',403);
  const role=String(p.role||'').toLowerCase();
  if(!['superadmin','admin','facilitator'].includes(role))bad(`Role ${role||'tidak dikenal'} tidak memiliki akses ke IDP pusat.`,403);
  return{c,role};
}
async function awards(c){return q('/rest/v1/awardees?status=neq.Lulus&select=legacy_id,name,angkatan,status&order=name.asc',c)}
function norm(v){return String(v||'').toLowerCase().replace(/\(\s*20\d{2}\s*\)/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
function stats(vals){
  let filledRows=0,filledCells=0,lastRow=0,lastColumn=0;
  for(let i=0;i<(vals||[]).length;i++){
    const row=vals[i]||[];let used=false;
    for(let c=0;c<row.length;c++)if(String(row[c]??'').trim()){used=true;filledCells++;lastColumn=Math.max(lastColumn,c+1)}
    if(used){filledRows++;lastRow=i+1}
  }
  return{filledRows,filledCells,lastRow,lastColumn,truncated:(vals||[]).length>=400||lastColumn>=40};
}

const b64=x=>Buffer.from(x).toString('base64url');
function serviceAccountConfigured(){return !!String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON||'').trim()}
async function googleToken(){
  const raw=String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON||'').trim();
  if(!raw)throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON belum tersedia di server.');
  let sa;
  try{sa=JSON.parse(raw)}catch{try{sa=JSON.parse(Buffer.from(raw,'base64').toString('utf8'))}catch{throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON tidak valid.')}}
  if(!sa?.client_email||!sa?.private_key)throw new Error('Service account Google Drive tidak lengkap.');
  const now=Math.floor(Date.now()/1000);
  const payload={iss:sa.client_email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3500};
  const head={alg:'RS256',typ:'JWT'};
  const unsigned=b64(JSON.stringify(head))+'.'+b64(JSON.stringify(payload));
  const sig=crypto.sign('RSA-SHA256',Buffer.from(unsigned),sa.private_key).toString('base64url');
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth-type:jwt-bearer',assertion:unsigned+'.'+sig})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.access_token)throw new Error(j.error_description||'Token Google gagal dibuat.');
  return{token:j.access_token,email:sa.client_email};
}
async function google(path,token){
  const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+FILE_ID+path,{headers:{Authorization:`Bearer ${token}`}});
  const text=await r.text();let b={};try{b=text?JSON.parse(text):{}}catch{b={}}
  if(!r.ok){const e=new Error(b?.error?.message||`Google Sheets HTTP ${r.status}`);e.status=r.status;throw e}
  return b;
}
async function metadata(force=false){
  if(!force&&cache.meta&&Date.now()-cache.t<300000)return cache.meta;
  const g=await googleToken();
  const m=await google('?includeGridData=false&fields=properties.title,sheets.properties(sheetId,title,index,hidden,gridProperties)',g.token);
  const meta={title:m?.properties?.title||SOURCE_NAME,sheets:(m?.sheets||[]).map(x=>x.properties).filter(Boolean),serviceAccount:g.email};
  cache={meta,t:Date.now()};return meta;
}
function qrange(title){return encodeURIComponent(`'${String(title).replace(/'/g,"''")}'!A1:AN400`)}
async function valuesService(title){const g=await googleToken(),r=await google(`/values/${qrange(title)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,g.token);return Array.isArray(r?.values)?r.values:[]}

function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(quoted){if(ch==='"'&&next==='"'){cell+='"';i++}else if(ch==='"')quoted=false;else cell+=ch}
    else if(ch==='"')quoted=true;
    else if(ch===','){row.push(cell);cell=''}
    else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}
    else cell+=ch;
  }
  if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}
  return rows;
}
async function fetchText(url,timeout=6500){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(url,{headers:{'User-Agent':'ETOS-ID-Palu-IDP/36.1'},signal:controller.signal,redirect:'follow'}),text=await r.text();
    if(!r.ok){const e=new Error(`Google Sheet HTTP ${r.status}`);e.status=r.status;throw e}
    if(/<!doctype html|<html|accounts\.google\.com|servicelogin/i.test(text))throw new Error('Google Sheet IDP belum dapat dibaca oleh server.');
    return text;
  }finally{clearTimeout(timer)}
}
async function publicRows(key,url,force=false){
  const hit=publicCache.get(key);if(!force&&hit&&Date.now()-hit.t<300000)return hit.v;
  const rows=parseCsv(await fetchText(url));if(!rows.length)throw new Error('Google Sheet IDP kosong atau tidak ditemukan.');
  publicCache.set(key,{t:Date.now(),v:rows});return rows;
}
async function valuesPublicTitle(title,force=false){return publicRows('sheet:'+title,`https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(title)}`,force)}
async function valuesPublicGid(force=false){return publicRows('gid:'+SOURCE_GID,`https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&headers=1&gid=${encodeURIComponent(SOURCE_GID)}`,force)}
function usableSheets(meta){return(meta.sheets||[]).filter(x=>!x.hidden&&!['definisi umum','nama etoser','template','petunjuk'].includes(norm(x.title)))}

async function liveOverviewService(c,force=false){
  const meta=await metadata(force),aw=await awards(c),usable=usableSheets(meta),idx=new Map();
  for(const s of usable){const k=norm(s.title);if(!idx.has(k))idx.set(k,[]);idx.get(k).push(s)}
  const items=[];
  for(const a of aw){const ms=idx.get(norm(a.name))||[],s=ms.length===1?ms[0]:null;let sm={filledRows:0,filledCells:0,lastRow:0,lastColumn:0,truncated:false};if(s){try{sm=stats(await valuesService(s.title))}catch{}}items.push({id:a.legacy_id,nama:a.name,angkatan:a.angkatan,status:a.status,connected:!!s,sheetName:s?.title||'',...sm})}
  return{sourceName:meta.title||SOURCE_NAME,sourceId:FILE_ID,sourceGid:SOURCE_GID,sourceMode:'sheets-live-service-account',sourceUrlHint:'Google Sheet IDP Palu read-only',stale:false,totalActive:items.length,connected:items.filter(x=>x.connected).length,missing:items.filter(x=>!x.connected).length,items};
}
async function publicValuesForAwardee(a,force=false){
  const cohort=String(a.angkatan||'').trim(),candidates=[String(a.name||'').trim(),cohort?`${a.name} (${cohort})`:''].filter(Boolean);let last=null;
  for(const title of [...new Set(candidates)]){try{return{title,values:await valuesPublicTitle(title,force)}}catch(e){last=e}}
  throw last||new Error('Tab IDP tidak ditemukan.');
}
async function liveOverviewPublic(c,force=false){
  await valuesPublicGid(force);
  const aw=await awards(c);
  const items=await Promise.all(aw.map(async a=>{try{const hit=await publicValuesForAwardee(a,force);return{id:a.legacy_id,nama:a.name,angkatan:a.angkatan,status:a.status,connected:true,sheetName:hit.title,...stats(hit.values)}}catch(e){return{id:a.legacy_id,nama:a.name,angkatan:a.angkatan,status:a.status,connected:false,sheetName:'',filledRows:0,filledCells:0,lastRow:0,lastColumn:0,truncated:false,connectionError:e.message||String(e)}}}));
  return{sourceName:SOURCE_NAME,sourceId:FILE_ID,sourceGid:SOURCE_GID,sourceMode:'sheets-live-public-readonly',sourceUrlHint:'Google Sheet IDP Palu via read-only link',stale:false,totalActive:items.length,connected:items.filter(x=>x.connected).length,missing:items.filter(x=>!x.connected).length,items};
}
async function overview(c,force=false){
  try{return serviceAccountConfigured()?await liveOverviewService(c,force):await liveOverviewPublic(c,force)}
  catch(e){const d=await driveFallback.overview(await awards(c),force);d.liveError=e.message||String(e);d.preferredSource={sourceName:SOURCE_NAME,sourceId:FILE_ID,sourceGid:SOURCE_GID};return d}
}
async function detailService(name,force=false){
  const meta=await metadata(force),matches=usableSheets(meta).filter(s=>norm(s.title)===norm(name));
  if(matches.length!==1)bad(matches.length?'Nama tab IDP ambigu.':'Tab IDP tidak ditemukan.',404);
  const vals=await valuesService(matches[0].title);
  return{nama:name,sheetName:matches[0].title,sourceName:meta.title||SOURCE_NAME,sourceId:FILE_ID,sourceGid:SOURCE_GID,sourceMode:'sheets-live-service-account',stale:false,values:vals,summary:stats(vals)};
}
async function detailPublic(c,name,force=false){
  const aw=await awards(c),a=(aw||[]).find(x=>norm(x.name)===norm(name))||{name,angkatan:''},hit=await publicValuesForAwardee(a,force);
  return{nama:name,sheetName:hit.title,sourceName:SOURCE_NAME,sourceId:FILE_ID,sourceGid:SOURCE_GID,sourceMode:'sheets-live-public-readonly',stale:false,values:hit.values,summary:stats(hit.values)};
}
async function detail(c,name,force=false){
  try{return serviceAccountConfigured()?await detailService(name,force):await detailPublic(c,name,force)}
  catch(e){const aw=await awards(c),a=(aw||[]).find(x=>norm(x.name)===norm(name))||{name,angkatan:''},d=await driveFallback.detail(name,a.angkatan,force);d.liveError=e.message||String(e);d.preferredSource={sourceName:SOURCE_NAME,sourceId:FILE_ID,sourceGid:SOURCE_GID};return d}
}
async function health(res){
  try{
    if(serviceAccountConfigured()){
      const m=await metadata(true);
      return out(res,200,{success:true,data:{edge:'healthy',source:'google-sheets-live',mode:'service-account',sourceId:FILE_ID,sourceGid:SOURCE_GID,title:m.title||SOURCE_NAME,sheetCount:(m.sheets||[]).length,stale:false}});
    }
    const rows=await valuesPublicGid(true);
    return out(res,200,{success:true,data:{edge:'healthy',source:'google-sheets-live',mode:'public-readonly',sourceId:FILE_ID,sourceGid:SOURCE_GID,title:SOURCE_NAME,probeRows:rows.length,stale:false}});
  }catch(e){
    try{
      const d=await driveFallback.health(true);
      d.liveError=e.message||String(e);
      d.preferredSource={sourceId:FILE_ID,sourceGid:SOURCE_GID,title:SOURCE_NAME};
      return out(res,200,{success:true,data:d,warning:'Live Google Sheet belum dapat diakses; IDP berjalan memakai workbook fallback terverifikasi.'});
    }catch(f){
      return out(res,502,{success:false,error:f.message||String(f),data:{source:'google-sheets',sourceId:FILE_ID,sourceGid:SOURCE_GID,liveError:e.message||String(e)}});
    }
  }
}
module.exports=async function handler(req,res){
  if(req.method==='GET'&&String(req.query?.source_health||'')==='1')return health(res);
  if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
  try{
    const{c,role}=await authorize(req),fn=String(req.body?.function||'getIDPOverview'),p=req.body?.params||{},force=!!p.forceRefresh;
    if(fn==='getIDPDetail'){const d=await detail(c,String(p.nama||p.name||''),force);d.accessRole=role;return out(res,200,{success:true,data:d})}
    const d=await overview(c,force);d.accessRole=role;return out(res,200,{success:true,data:d});
  }catch(e){console.error('[IDP live]',e);return out(res,e.status||500,{success:false,error:e.message||'Koneksi IDP pusat gagal.'})}
};
