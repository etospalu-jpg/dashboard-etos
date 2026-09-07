const crypto=require('crypto');
const session=require('./server-session');
const PIN_HASH='e811d29b1b60cc0f4ffc2e65ffc4b14c38415da9c7b1cc73f73a97c67725a490';
const attempts=new Map(),WINDOW=15*60*1000,MAX=5;
function out(res,status,body,extra={}){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Pragma','no-cache');for(const[k,v]of Object.entries(extra))res.setHeader(k,v);res.end(JSON.stringify(body))}
function ip(req){return String(req.headers['x-forwarded-for']||req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()}
function validPin(v){const h=crypto.createHash('sha256').update(String(v||'')).digest('hex');const a=Buffer.from(h,'hex'),b=Buffer.from(PIN_HASH,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b)}
module.exports=async function handler(req,res){try{
 if(req.method==='GET'){const s=session.verify(req);return out(res,200,{success:true,data:{session:s?{role:s.role,scope:s.scope,expires_at:s.exp}:null}})}
 if(req.method==='DELETE'){session.clearCookie(res);return out(res,200,{success:true,data:{session:null}})}
 if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
 const k=ip(req),now=Date.now();let r=attempts.get(k);if(!r||now-r.started>=WINDOW){r={started:now,count:0};attempts.set(k,r)}
 if(r.count>=MAX){const retry=Math.max(1,Math.ceil((WINDOW-(now-r.started))/1000));return out(res,429,{success:false,error:'Terlalu banyak percobaan. Coba lagi beberapa menit.'},{'Retry-After':String(retry)})}
 const pin=String(req.body?.pin||'').trim();if(!/^\d{6}$/.test(pin)||!validPin(pin)){r.count++;return out(res,401,{success:false,error:'PIN tidak sesuai.'})}
 attempts.delete(k);const token=session.setCookie(res);const s=session.verify({headers:{cookie:`etos_session=${encodeURIComponent(token)}`}});return out(res,200,{success:true,data:{session:{role:s?.role||'admin',scope:s?.scope||'etos-operational',expires_at:s?.exp||Math.floor(Date.now()/1000)+session.MAX_AGE}}})
 }catch(e){console.error('[PIN cookie fatal]',e);return out(res,500,{success:false,error:'Layanan PIN mengalami kesalahan internal.',code:'PIN_INTERNAL_ERROR'})}}
