const session=require('./server-session');
const drive=require('./idp-drive-fallback');
const SOURCE_NAME='Palu-IDP KI.xlsx';
const CACHE_MS=60000;
let cache={row:null,book:null,t:0};
function norm(v){return String(v||'').toLowerCase().replace(/\(\s*20\d{2}\s*\)/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
function statsEmpty(){return{filledRows:0,filledCells:0,lastRow:0,lastColumn:0,truncated:false}}
function usable(book){return(book||[]).filter(s=>!['definisi umum','nama etoser','template','petunjuk'].includes(norm(s.title)))}
async function uploaded(force=false){
  if(!force&&cache.row&&cache.book&&Date.now()-cache.t<CACHE_MS)return cache;
  const url=session.PROJECT_URL+'/rest/v1/idp_workbook_store?id=eq.active&select=filename,file_b64,file_size,sha256,uploaded_at&limit=1';
  const r=await fetch(url,{headers:{apikey:session.PUBLISHABLE_KEY,Authorization:'Bearer '+session.PUBLISHABLE_KEY,'Content-Type':'application/json'}});
  const text=await r.text();let body=[];try{body=text?JSON.parse(text):[]}catch{}
  if(!r.ok)throw new Error(body?.message||body?.error||`IDP store ${r.status}`);
  const row=Array.isArray(body)?body[0]:null;
  if(!row?.file_b64)return null;
  const buf=Buffer.from(String(row.file_b64),'base64');
  const book=drive.parseBook(buf);
  cache={row,book,t:Date.now()};
  return cache;
}
function meta(row){return{sourceName:row?.filename||SOURCE_NAME,sourceId:'palu-upload-active',sourceMode:'uploaded-palu-xlsx',sourceModifiedAt:row?.uploaded_at||null,uploadedAt:row?.uploaded_at||null,fileSize:Number(row?.file_size||0),sha256:row?.sha256||'',sourceUrlHint:'Workbook IDP Palu aktif',stale:false,fallback:false,refreshedAt:new Date().toISOString()}}
function overviewBook(book,row,awardees){const tabs=usable(book),idx=new Map();for(const s of tabs){const k=norm(s.title);if(!idx.has(k))idx.set(k,[]);idx.get(k).push(s)}const items=(awardees||[]).map(a=>{const ms=idx.get(norm(a.name||a.nama))||[],s=ms.length===1?ms[0]:null;return{id:a.legacy_id||a.id,nama:a.name||a.nama,angkatan:a.angkatan,status:a.status,connected:!!s,sheetName:s?.title||'',...(s?.summary||statsEmpty())}});return{...meta(row),totalActive:items.length,connected:items.filter(x=>x.connected).length,missing:items.filter(x=>!x.connected).length,items}}
function detailBook(book,row,name,cohort=''){const tabs=usable(book),candidates=[norm(name),norm(`${name} (${cohort})`)].filter(Boolean),matches=tabs.filter(s=>candidates.includes(norm(s.title)));if(matches.length!==1)throw new Error(matches.length?'Nama tab IDP Palu ambigu.':'Tab IDP Palu tidak ditemukan.');const s=matches[0];return{nama:name,sheetName:s.title,...meta(row),values:s.values,summary:s.summary}}
async function overview(awardees,force=false){const u=await uploaded(force);if(u)return overviewBook(u.book,u.row,awardees);const data=await drive.overview(awardees,force);data.fallback=false;data.sourceMode='drive-live-readonly';return data}
async function detail(name,cohort='',force=false){const u=await uploaded(force);if(u)return detailBook(u.book,u.row,name,cohort);const data=await drive.detail(name,cohort,force);data.fallback=false;data.sourceMode='drive-live-readonly';return data}
async function health(force=false){const u=await uploaded(force);if(u)return{edge:'healthy',source:'palu-idp',mode:'uploaded-palu-xlsx',sourceId:'palu-upload-active',title:u.row.filename||SOURCE_NAME,sourceModifiedAt:u.row.uploaded_at||null,uploadedAt:u.row.uploaded_at||null,fileSize:Number(u.row.file_size||0),sheetCount:usable(u.book).length,stale:false,fallback:false,refreshedAt:new Date().toISOString()};const d=await drive.health(force);return{...d,source:'palu-idp',fallback:false}}
module.exports={SOURCE_NAME,overview,detail,health};
