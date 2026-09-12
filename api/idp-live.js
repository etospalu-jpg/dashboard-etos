const crypto=require('crypto');
const zlib=require('zlib');
const session=require('../server-session');
const palu=require('../idp-palu-source');
const drive=require('../idp-drive-fallback');

function out(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
function serverCredential(){const key=session.secret(),kind=session.kind(key);if(!key||!['secret','legacy'].includes(kind))throw new Error('Koneksi database IDP belum tersedia.');return{server:true,key,kind}}
async function overview(force=false){return palu.overview([],force)}
async function detail(name,force=false){return palu.detail(name,'',force)}
async function health(force=true){return palu.health(force)}
function cleanBase64(v){return String(v||'').replace(/^data:[^,]+,/,'').replace(/\s+/g,'')}
async function replaceWorkbook(req,p){
  if(!session.originAllowed(req))throw Object.assign(new Error('Origin request tidak diizinkan.'),{status:403});
  if(!session.verify(req))throw Object.assign(new Error('PIN Superadmin diperlukan untuk memperbarui IDP.'),{status:401});
  session.credential(req);
  const filename=String(p?.filename||'').trim();if(!/\.xlsx$/i.test(filename))throw Object.assign(new Error('Gunakan file Excel .xlsx.'),{status:400});
  const b64=cleanBase64(p?.dataBase64);if(!b64)throw Object.assign(new Error('File IDP belum dipilih.'),{status:400});
  const buf=Buffer.from(b64,'base64');if(!buf.length||buf.length>3*1024*1024)throw Object.assign(new Error('Ukuran file IDP maksimal 3 MB.'),{status:400});
  if(buf[0]!==0x50||buf[1]!==0x4b)throw Object.assign(new Error('File bukan workbook XLSX yang valid.'),{status:400});
  const book=drive.parseBook(buf);if(!Array.isArray(book)||!book.length)throw Object.assign(new Error('Workbook tidak memiliki sheet yang dapat dibaca.'),{status:400});
  const packed=zlib.gzipSync(Buffer.from(JSON.stringify(book)),{level:9});
  if(packed.length>2*1024*1024)throw Object.assign(new Error('Data IDP setelah diproses masih terlalu besar. Kurangi isi workbook lalu coba lagi.'),{status:400});
  const sha256=crypto.createHash('sha256').update(buf).digest('hex'),c=serverCredential(),uploadedAt=new Date().toISOString();
  const row={id:'active',filename,file_b64:null,book_gzip_b64:packed.toString('base64'),file_size:buf.length,sha256,uploaded_at:uploadedAt};
  const r=await fetch(session.PROJECT_URL+'/rest/v1/idp_workbook_store?on_conflict=id',{method:'POST',headers:session.dbHeaders(c,{Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(row)});const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!r.ok)throw new Error(body?.message||body?.error||`Penyimpanan IDP ${r.status}`);
  palu.clearCache?.();
  return{filename,fileSize:buf.length,storedSize:packed.length,sha256,sheetCount:book.length,uploadedAt,replacedPrevious:true};
}
module.exports=async function handler(req,res){
  try{
    if(req.method==='GET'&&String(req.query?.source_health||'')==='1')return out(res,200,{success:true,data:await health(true)});
    if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
    const fn=String(req.body?.function||'getIDPOverview'),p=req.body?.params||{},force=!!p.forceRefresh;
    if(fn==='uploadIDPWorkbook')return out(res,200,{success:true,data:await replaceWorkbook(req,p)});
    const accessRole=session.verify(req)?'superadmin':'public';
    if(fn==='getIDPDetail'){const name=String(p.nama||p.name||'').trim();if(!name)return out(res,400,{success:false,error:'Nama Awardee diperlukan.'});const data=await detail(name,force);data.accessRole=accessRole;return out(res,200,{success:true,data})}
    if(fn!=='getIDPOverview')return out(res,400,{success:false,error:'Fungsi IDP tidak valid.'});
    const data=await overview(force);data.accessRole=accessRole;return out(res,200,{success:true,data});
  }catch(e){console.error('[IDP Palu]',e);return out(res,e.status||500,{success:false,error:e.message||'Sumber IDP Palu gagal diproses.'})}
};
