const zlib=require('zlib');
const session=require('./server-session');
const SOURCE_NAME='Palu-IDP KI.xlsx';
const CACHE_MS=60000;
let cache={row:null,book:null,t:0};
function norm(v){return String(v||'').toLowerCase().replace(/\(\s*20\d{2}\s*\)/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
function cleanName(v){return String(v||'').replace(/\s*\(\s*20\d{2}\s*\)\s*$/,'').trim()}
function cohortFromTitle(v){const m=String(v||'').match(/\((20\d{2})\)/);return m?m[1]:''}
function statsEmpty(){return{filledRows:0,filledCells:0,lastRow:0,lastColumn:0,truncated:false}}
function usable(book){return(book||[]).filter(s=>!['definisi umum','nama etoser','template','petunjuk'].includes(norm(s.title)))}
function decodeBook(v){const raw=Buffer.from(String(v||''),'base64');if(!raw.length)return null;return JSON.parse(zlib.gunzipSync(raw).toString('utf8'))}
async function uploaded(force=false){
  if(!force&&cache.row&&cache.book&&Date.now()-cache.t<CACHE_MS)return cache;
  const key=session.secret(),kind=session.kind(key);
  if(!key||!['secret','legacy'].includes(kind))throw new Error('Koneksi server IDP belum tersedia.');
  const url=session.PROJECT_URL+'/rest/v1/rpc/get_active_idp_book';
  const r=await fetch(url,{method:'POST',headers:session.dbHeaders({server:true,key,kind}),body:'{}'});
  const text=await r.text();let body=[];try{body=text?JSON.parse(text):[]}catch{}
  if(!r.ok)throw new Error(body?.message||body?.error||`IDP store ${r.status}`);
  const row=Array.isArray(body)?body[0]:null;
  if(!row?.book_gzip_b64)return null;
  const book=decodeBook(row.book_gzip_b64);
  if(!Array.isArray(book)||!book.length)return null;
  cache={row,book,t:Date.now()};return cache;
}
function clearCache(){cache={row:null,book:null,t:0}}
function meta(row){return{sourceName:row?.filename||SOURCE_NAME,sourceId:'palu-upload-active',sourceMode:'uploaded-palu-xlsx',sourceModifiedAt:row?.uploaded_at||null,uploadedAt:row?.uploaded_at||null,fileSize:Number(row?.file_size||0),sha256:row?.sha256||'',sourceUrlHint:'Workbook IDP Palu aktif',stale:false,fallback:false,refreshedAt:new Date().toISOString()}}
function derivedItems(tabs){return tabs.map((s,i)=>({id:'idp-'+(i+1),nama:cleanName(s.title)||s.title,angkatan:cohortFromTitle(s.title),status:'Aktif',connected:true,sheetName:s.title,...(s.summary||statsEmpty())}))}
function overviewBook(book,row,awardees){const tabs=usable(book),idx=new Map();for(const s of tabs){const k=norm(s.title);if(!idx.has(k))idx.set(k,[]);idx.get(k).push(s)}let items;if(Array.isArray(awardees)&&awardees.length){items=awardees.map(a=>{const ms=idx.get(norm(a.name||a.nama))||[],s=ms.length===1?ms[0]:null;return{id:a.legacy_id||a.id,nama:a.name||a.nama,angkatan:a.angkatan,status:a.status,connected:!!s,sheetName:s?.title||'',...(s?.summary||statsEmpty())}})}else items=derivedItems(tabs);return{...meta(row),totalActive:items.length,connected:items.filter(x=>x.connected).length,missing:items.filter(x=>!x.connected).length,items}}
function detailBook(book,row,name,cohort=''){const tabs=usable(book),candidates=[norm(name),norm(`${name} (${cohort})`)].filter(Boolean),matches=tabs.filter(s=>candidates.includes(norm(s.title)));if(matches.length!==1)throw new Error(matches.length?'Nama tab IDP Palu ambigu.':'Tab IDP Palu tidak ditemukan.');const s=matches[0];return{nama:name,sheetName:s.title,...meta(row),values:s.values,summary:s.summary}}
async function overview(awardees=[],force=false){
  const u=await uploaded(force);
  if(u)return overviewBook(u.book,u.row,awardees);
  const items=Array.isArray(awardees)?awardees.map(a=>({id:a.legacy_id||a.id,nama:a.name||a.nama,angkatan:a.angkatan,status:a.status,connected:false,sheetName:'',...statsEmpty()})):[];
  return{sourceName:SOURCE_NAME,sourceId:'palu-upload-active',sourceMode:'uploaded-required',sourceUrlHint:'Upload workbook IDP melalui Pengaturan',stale:false,fallback:false,totalActive:items.length,connected:0,missing:items.length,items};
}
async function detail(name,cohort='',force=false){
  const u=await uploaded(force);
  if(!u)throw new Error('Workbook IDP aktif belum diunggah.');
  return detailBook(u.book,u.row,name,cohort);
}
async function health(force=false){
  const u=await uploaded(force);
  if(u)return{edge:'healthy',source:'palu-idp',mode:'uploaded-palu-xlsx',sourceId:'palu-upload-active',title:u.row.filename||SOURCE_NAME,sourceModifiedAt:u.row.uploaded_at||null,uploadedAt:u.row.uploaded_at||null,fileSize:Number(u.row.file_size||0),sheetCount:usable(u.book).length,stale:false,fallback:false,refreshedAt:new Date().toISOString()};
  return{edge:'healthy',source:'palu-idp',mode:'uploaded-required',sourceId:'palu-upload-active',title:SOURCE_NAME,sheetCount:0,stale:false,fallback:false,refreshedAt:new Date().toISOString()};
}
module.exports={SOURCE_NAME,overview,detail,health,clearCache};
