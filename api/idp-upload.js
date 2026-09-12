const crypto=require('crypto');
const session=require('../server-session');
const drive=require('../idp-drive-fallback');

function out(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
function cleanBase64(v){return String(v||'').replace(/^data:[^,]+,/,'').replace(/\s+/g,'')}
module.exports=async function handler(req,res){
  try{
    if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
    if(!session.originAllowed(req))return out(res,403,{success:false,error:'Origin request tidak diizinkan.'});
    if(!session.verify(req))return out(res,401,{success:false,error:'PIN Superadmin diperlukan untuk memperbarui IDP.'});
    session.credential(req);
    const filename=String(req.body?.filename||'').trim();
    if(!/\.xlsx$/i.test(filename))return out(res,400,{success:false,error:'Gunakan file Excel .xlsx.'});
    const b64=cleanBase64(req.body?.dataBase64);
    if(!b64)return out(res,400,{success:false,error:'File IDP belum dipilih.'});
    const buf=Buffer.from(b64,'base64');
    if(!buf.length||buf.length>3*1024*1024)return out(res,400,{success:false,error:'Ukuran file IDP maksimal 3 MB.'});
    if(buf[0]!==0x50||buf[1]!==0x4b)return out(res,400,{success:false,error:'File bukan workbook XLSX yang valid.'});
    const book=drive.parseBook(buf);
    if(!Array.isArray(book)||!book.length)return out(res,400,{success:false,error:'Workbook tidak memiliki sheet yang dapat dibaca.'});
    const sha256=crypto.createHash('sha256').update(buf).digest('hex');
    const key=session.secret(),kind=session.kind(key);
    if(!key||!['secret','legacy'].includes(kind))throw new Error('Koneksi database server belum tersedia.');
    const row={id:'active',filename,file_b64:b64,file_size:buf.length,sha256,uploaded_at:new Date().toISOString()};
    const r=await fetch(session.PROJECT_URL+'/rest/v1/idp_workbook_store?on_conflict=id',{method:'POST',headers:session.dbHeaders({server:true,key,kind},{Prefer:'resolution=merge-duplicates,return=representation'}),body:JSON.stringify(row)});
    const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
    if(!r.ok)throw new Error(body?.message||body?.error||`Penyimpanan IDP ${r.status}`);
    return out(res,200,{success:true,data:{filename,fileSize:buf.length,sha256,sheetCount:book.length,uploadedAt:row.uploaded_at,replacedPrevious:true}});
  }catch(e){console.error('[IDP upload]',e);return out(res,500,{success:false,error:e.message||'Upload IDP gagal.'})}
};
