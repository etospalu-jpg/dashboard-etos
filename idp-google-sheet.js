const crypto=require('crypto');

const FILE_ID='1OzW2RfiXL5SmqLOJx-t4Grimy7usdnSqVvSQszZ8WvQ';
const SOURCE_GID='1973014346';
const SOURCE_NAME='IDP ETOS Palu — Google Sheet';
const CACHE_MS=60000;
let tokenCache={token:'',email:'',exp:0};
let metaCache={value:null,t:0};
const valueCache=new Map();

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
function serviceAccount(){
  const raw=String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON||'').trim();
  if(!raw)return null;
  let parsed;
  try{parsed=JSON.parse(raw)}
  catch(_){
    try{parsed=JSON.parse(Buffer.from(raw,'base64').toString('utf8'))}
    catch{throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON tidak valid.')}
  }
  if(!parsed?.client_email||!parsed?.private_key)throw new Error('Service account Google belum lengkap.');
  return parsed;
}
const b64=x=>Buffer.from(x).toString('base64url');
async function token(){
  const sa=serviceAccount();if(!sa)throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON belum tersedia di server.');
  const now=Math.floor(Date.now()/1000);
  if(tokenCache.token&&tokenCache.email===sa.client_email&&tokenCache.exp-now>120)return tokenCache;
  const payload={iss:sa.client_email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3500};
  const unsigned=b64(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+b64(JSON.stringify(payload));
  const signature=crypto.sign('RSA-SHA256',Buffer.from(unsigned),sa.private_key).toString('base64url');
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature})});
  const body=await r.json().catch(()=>({}));
  if(!r.ok||!body.access_token)throw new Error(body.error_description||body.error||'Token Google gagal dibuat.');
  tokenCache={token:body.access_token,email:sa.client_email,exp:now+Number(body.expires_in||3500)};
  return tokenCache;
}
async function sheets(path){
  const t=await token();
  const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+FILE_ID+path,{headers:{Authorization:`Bearer ${t.token}`}});
  const text=await r.text();let body={};
  try{body=text?JSON.parse(text):{}}catch{body={}}
  if(!r.ok){const e=new Error(body?.error?.message||`Google Sheets HTTP ${r.status}`);e.status=r.status;throw e}
  return body;
}
async function metadata(force=false){
  if(!force&&metaCache.value&&Date.now()-metaCache.t<CACHE_MS)return metaCache.value;
  const m=await sheets('?includeGridData=false&fields=properties.title,sheets.properties(sheetId,title,index,hidden,gridProperties)');
  const t=await token();
  const value={title:m?.properties?.title||SOURCE_NAME,sheets:(m?.sheets||[]).map(x=>x.properties).filter(Boolean),serviceAccountEmail:t.email};
  metaCache={value,t:Date.now()};return value;
}
function usable(meta){return(meta?.sheets||[]).filter(x=>!x.hidden&&!['definisi umum','nama etoser','template','petunjuk'].includes(norm(x.title)))}
function qrange(title){return `'${String(title).replace(/'/g,"''")}'!A1:AN400`}
async function valueRange(title,force=false){
  const key='sa:'+title,hit=valueCache.get(key);if(!force&&hit&&Date.now()-hit.t<CACHE_MS)return hit.value;
  const r=await sheets('/values/'+encodeURIComponent(qrange(title))+'?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE');
  const value=Array.isArray(r?.values)?r.values:[];valueCache.set(key,{t:Date.now(),value});return value;
}
async function batchValues(titles,force=false){
  const out=new Map(),missing=[];
  for(const title of titles){const hit=valueCache.get('sa:'+title);if(!force&&hit&&Date.now()-hit.t<CACHE_MS)out.set(title,hit.value);else missing.push(title)}
  if(missing.length){
    const qs=new URLSearchParams({majorDimension:'ROWS',valueRenderOption:'FORMATTED_VALUE'});missing.forEach(t=>qs.append('ranges',qrange(t)));
    const r=await sheets('/values:batchGet?'+qs.toString());
    (r?.valueRanges||[]).forEach((vr,i)=>{const title=missing[i],value=Array.isArray(vr?.values)?vr.values:[];valueCache.set('sa:'+title,{t:Date.now(),value});out.set(title,value)});
    missing.forEach(t=>{if(!out.has(t))out.set(t,[])});
  }
  return out;
}
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
async function fetchText(url,timeout=7000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(url,{headers:{'User-Agent':'ETOS-ID-Palu-IDP/36.4'},signal:controller.signal,redirect:'follow'}),text=await r.text();
    if(!r.ok){const e=new Error(`Google Sheet HTTP ${r.status}`);e.status=r.status;throw e}
    if(/<!doctype html|<html|accounts\.google\.com|servicelogin/i.test(text))throw new Error('Google Sheet IDP belum dapat dibaca secara publik.');
    return text;
  }finally{clearTimeout(timer)}
}
async function publicRows(key,url,force=false){
  const hit=valueCache.get(key);if(!force&&hit&&Date.now()-hit.t<CACHE_MS)return hit.value;
  const rows=parseCsv(await fetchText(url));if(!rows.length)throw new Error('Google Sheet IDP kosong atau tidak ditemukan.');valueCache.set(key,{t:Date.now(),value:rows});return rows;
}
async function publicByTitle(title,force=false){return publicRows('pub:'+title,`https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(title)}`,force)}
async function publicProbe(force=false){return publicRows('gid:'+SOURCE_GID,`https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&headers=1&gid=${encodeURIComponent(SOURCE_GID)}`,force)}
async function publicForAwardee(a,force=false){
  const cohort=String(a?.angkatan||'').trim(),candidates=[String(a?.name||a?.nama||'').trim(),cohort?`${a?.name||a?.nama} (${cohort})`:''].filter(Boolean);let last=null;
  for(const title of [...new Set(candidates)]){try{return{title,values:await publicByTitle(title,force)}}catch(e){last=e}}
  throw last||new Error('Tab IDP tidak ditemukan.');
}
async function overviewService(awardees,force=false){
  const meta=await metadata(force),tabs=usable(meta),idx=new Map();tabs.forEach(s=>{const k=norm(s.title);if(!idx.has(k))idx.set(k,[]);idx.get(k).push(s)});
  const matches=(awardees||[]).map(a=>{const ms=idx.get(norm(a.name||a.nama))||[];return{a,s:ms.length===1?ms[0]:null}});
  const needed=[...new Set(matches.filter(x=>x.s).map(x=>x.s.title))],values=await batchValues(needed,force);
  const items=matches.map(({a,s})=>({id:a.legacy_id||a.id,nama:a.name||a.nama,angkatan:a.angkatan,status:a.status,connected:!!s,sheetName:s?.title||'',...(s?stats(values.get(s.title)||[]):{filledRows:0,filledCells:0,lastRow:0,lastColumn:0,truncated:false})}));
  return{sourceName:meta.title||SOURCE_NAME,sourceId:FILE_ID,sourceGid:SOURCE_GID,sourceMode:'sheets-live-service-account',sourceUrlHint:'Google Sheet IDP Palu read-only',serviceAccountEmail:meta.serviceAccountEmail,stale:false,fallback:false,totalActive:items.length,connected:items.filter(x=>x.connected).length,missing:items.filter(x=>!x.connected).length,items};
}
async function overviewPublic(awardees,force=false){
  await publicProbe(force);
  const items=await Promise.all((awardees||[]).map(async a=>{try{const hit=await publicForAwardee(a,force);return{id:a.legacy_id||a.id,nama:a.name||a.nama,angkatan:a.angkatan,status:a.status,connected:true,sheetName:hit.title,...stats(hit.values)}}catch(e){return{id:a.legacy_id||a.id,nama:a.name||a.nama,angkatan:a.angkatan,status:a.status,connected:false,sheetName:'',filledRows:0,filledCells:0,lastRow:0,lastColumn:0,truncated:false,connectionError:e.message||String(e)}}}));
  return{sourceName:SOURCE_NAME,sourceId:FILE_ID,sourceGid:SOURCE_GID,sourceMode:'sheets-live-public-readonly',sourceUrlHint:'Google Sheet IDP Palu read-only',stale:false,fallback:false,totalActive:items.length,connected:items.filter(x=>x.connected).length,missing:items.filter(x=>!x.connected).length,items};
}
async function overview(awardees,force=false){if(serviceAccount())return overviewService(awardees,force);return overviewPublic(awardees,force)}
async function detailService(name,force=false){
  const meta=await metadata(force),matches=usable(meta).filter(s=>norm(s.title)===norm(name));if(matches.length!==1){const e=new Error(matches.length?'Nama tab IDP ambigu.':'Tab IDP tidak ditemukan.');e.status=404;throw e}
  const values=await valueRange(matches[0].title,force);return{nama:name,sheetName:matches[0].title,sourceName:meta.title||SOURCE_NAME,sourceId:FILE_ID,sourceGid:SOURCE_GID,sourceMode:'sheets-live-service-account',serviceAccountEmail:meta.serviceAccountEmail,stale:false,fallback:false,values,summary:stats(values)};
}
async function detailPublic(name,cohort='',force=false){const hit=await publicForAwardee({name,angkatan:cohort},force);return{nama:name,sheetName:hit.title,sourceName:SOURCE_NAME,sourceId:FILE_ID,sourceGid:SOURCE_GID,sourceMode:'sheets-live-public-readonly',stale:false,fallback:false,values:hit.values,summary:stats(hit.values)}}
async function detail(name,cohort='',force=false){if(serviceAccount())return detailService(name,force);return detailPublic(name,cohort,force)}
async function health(force=false){
  if(serviceAccount()){const meta=await metadata(force);return{edge:'healthy',source:'google-sheets-live',mode:'service-account',sourceId:FILE_ID,sourceGid:SOURCE_GID,title:meta.title||SOURCE_NAME,sheetCount:(meta.sheets||[]).length,serviceAccountEmail:meta.serviceAccountEmail,stale:false,fallback:false,refreshedAt:new Date().toISOString()}}
  const rows=await publicProbe(force);return{edge:'healthy',source:'google-sheets-live',mode:'public-readonly',sourceId:FILE_ID,sourceGid:SOURCE_GID,title:SOURCE_NAME,probeRows:rows.length,stale:false,fallback:false,refreshedAt:new Date().toISOString()};
}
module.exports={FILE_ID,SOURCE_GID,SOURCE_NAME,CACHE_MS,overview,detail,health,serviceAccountConfigured:()=>!!serviceAccount()};
