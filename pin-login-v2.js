const crypto=require('crypto');
const session=require('./server-session');
const PIN_HASH='e811d29b1b60cc0f4ffc2e65ffc4b14c38415da9c7b1cc73f73a97c67725a490';
const attempts=new Map(),WINDOW=15*60*1000,MAX=5;
function out(res,status,body,extra={}){res.status(status);res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');Object.entries(extra).forEach(([k,v])=>res.setHeader(k,v));res.end(JSON.stringify(body))}
function ip(req){return String(req.headers['x-forwarded-for']||req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()}
function goodPin(v){const h=crypto.createHash('sha256').update(String(v||'')).digest('hex');return crypto.timingSafeEqual(Buffer.from(h,'hex'),Buffer.from(PIN_HASH,'hex'))}
module.exports=async function(req,res){
 if(req.method==='GET'){const s=session.verify(req);return out(res,200,{success:true,data:{session:s?{role:s.role,expires_at:s.exp}:null}})}
 if(req.method==='DELETE'){session.clearCookie(res);return out(res,200,{success:true})}
 if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
 const k=ip(req),now=Date.now();let a=attempts.get(k);if(!a||now-a.started>=WINDOW){a={started:now,count:0};attempts.set(k,a)}if(a.count>=MAX)return out(res,429,{success:false,error:'Terlalu banyak percobaan. Coba lagi beberapa menit.'},{'Retry-After':String(Math.ceil((WINDOW-(now-a.started))/1000))});const pin=String(req.body?.pin||'').trim();if(!/^\d{6}$/.test(pin)||!goodPin(pin)){a.count++;return out(res,401,{success:false,error:'PIN tidak sesuai.'})}
 const db=await session.testDatabase();if(!db.ok){console.error('[PIN session] database credential failed',db.kind,db.status,db.error);return out(res,503,{success:false,error:'Supabase Secret Key belum dapat mengakses database ETOS.',credential_type:db.kind,http_status:db.status})}
 session.setCookie(res);attempts.delete(k);return out(res,200,{success:true,data:{session:{role:'admin',expires_in:session.MAX_AGE}},credential_type:db.kind})
};
