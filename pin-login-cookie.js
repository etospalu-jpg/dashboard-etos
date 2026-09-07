const crypto=require('crypto');
const session=require('./server-session');
const PIN_HASH='e811d29b1b60cc0f4ffc2e65ffc4b14c38415da9c7b1cc73f73a97c67725a490';
const attempts=new Map(),WINDOW=15*60*1000,MAX=5;
function out(res,status,body,extra={}){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Pragma','no-cache');Object.entries(extra).forEach(([k,v])=>res.setHeader(k,v));return res.end(JSON.stringify(body))}
function ip(req){return String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()}
function validPin(v){const h=crypto.createHash('sha256').update(String(v||'')).digest('hex');const a=Buffer.from(h,'hex'),b=Buffer.from(PIN_HASH,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function bodyOf(req){if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string'){try{return JSON.parse(req.body)}catch{return{}}}return{}}
module.exports=async function handler(req,res){
 try{
  if(req.method==='GET'){const s=session.verify(req);return out(res,200,{success:true,data:{session:s?{role:s.role,scope:s.scope,expires_at:s.exp}:null}})}
  if(req.method==='DELETE'){session.clearCookie(res);return out(res,200,{success:true,data:{session:null}})}
  if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
  const k=ip(req),now=Date.now();let r=attempts.get(k);if(!r||now-r.started>=WINDOW){r={started:now,count:0};attempts.set(k,r)}
  if(r.count>=MAX){const retry=Math.max(1,Math.ceil((WINDOW-(now-r.started))/1000));return out(res,429,{success:false,error:'Terlalu banyak percobaan. Coba lagi beberapa menit.'},{'Retry-After':String(retry)})}
  const pin=String(bodyOf(req).pin||'').trim();
  if(!/^\d{6}$/.test(pin)||!validPin(pin)){r.count++;return out(res,401,{success:false,error:'PIN tidak sesuai.'})}
  attempts.delete(k);
  session.setCookie(res);
  const expiresAt=Math.floor(Date.now()/1000)+session.MAX_AGE;
  return out(res,200,{success:true,data:{session:{role:'admin',scope:'etos-operational',expires_at:expiresAt}},database_check:'deferred'});
 }catch(e){console.error('[PIN cookie fatal]',e&&e.stack?e.stack:e);return out(res,500,{success:false,error:'Layanan PIN mengalami gangguan server.',code:'PIN_SERVER_ERROR',detail:e?.message||String(e)})}
};
