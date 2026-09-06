const PROJECT_URL='https://weklmapqizeldfdalbgs.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const INTERNAL_AUTH_EMAIL='shadiqalfatih2@gmail.com';

const buckets=new Map();
const WINDOW_MS=15*60*1000;
const MAX_ATTEMPTS=5;

function reply(res,status,body,extra={}){
  res.status(status);
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Pragma','no-cache');
  Object.entries(extra).forEach(([k,v])=>res.setHeader(k,v));
  res.end(JSON.stringify(body));
}
function clientKey(req){
  const f=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  return f||String(req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown');
}
function rateState(key){
  const now=Date.now();
  let x=buckets.get(key);
  if(!x||now-x.startedAt>=WINDOW_MS){x={startedAt:now,count:0};buckets.set(key,x)}
  return x;
}
function clearRate(key){buckets.delete(key)}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return reply(res,405,{success:false,error:'Method not allowed'});
  const key=clientKey(req),rate=rateState(key),now=Date.now();
  if(rate.count>=MAX_ATTEMPTS){
    const retry=Math.max(1,Math.ceil((WINDOW_MS-(now-rate.startedAt))/1000));
    return reply(res,429,{success:false,error:'Terlalu banyak percobaan PIN. Coba lagi beberapa menit.'},{'Retry-After':String(retry)});
  }
  const pin=String(req.body?.pin||'').trim();
  if(!/^\d{6}$/.test(pin)){
    rate.count++;
    return reply(res,400,{success:false,error:'PIN harus terdiri dari 6 digit.'});
  }
  try{
    const r=await fetch(`${PROJECT_URL}/auth/v1/token?grant_type=password`,{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:PUBLISHABLE_KEY},
      body:JSON.stringify({email:INTERNAL_AUTH_EMAIL,password:pin})
    });
    const text=await r.text();
    let body={};
    try{body=text?JSON.parse(text):{}}catch{}
    if(!r.ok||!body?.access_token||!body?.refresh_token){
      rate.count++;
      return reply(res,401,{success:false,error:'PIN tidak sesuai atau akun operasional belum diaktifkan.'});
    }
    clearRate(key);
    return reply(res,200,{
      success:true,
      data:{
        access_token:body.access_token,
        refresh_token:body.refresh_token,
        expires_in:body.expires_in,
        token_type:body.token_type||'bearer'
      }
    });
  }catch(e){
    console.error('[PIN login]',e);
    return reply(res,503,{success:false,error:'Layanan login sedang tidak tersedia. Silakan coba lagi.'});
  }
};
