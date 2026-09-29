const crypto=require('crypto');
const session=require('../server-session');

function out(res,status,body){
  res.status(status).setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}
async function rawBody(req){
  const chunks=[];for await(const chunk of req)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
function adminHeaders(){
  const key=session.secret();if(!key)throw new Error('Supabase server key unavailable.');
  return{apikey:key,'Content-Type':'application/json'};
}
async function db(path,options={}){
  const r=await fetch(session.PROJECT_URL+path,{...options,headers:{...adminHeaders(),...(options.headers||{})}});
  const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
  if(!r.ok)throw new Error(body?.message||body?.error||body?.hint||'Supabase '+r.status);
  return body;
}
async function webhookSecret(){
  const v=await db('/rest/v1/rpc/get_email_webhook_secret',{method:'POST',body:'{}'});
  if(typeof v==='string')return v.trim();
  if(Array.isArray(v)&&typeof v[0]==='string')return String(v[0]).trim();
  return'';
}
function verify(secret,payload,id,timestamp,signature){
  if(!secret||!id||!timestamp||!signature)return false;
  const ts=Number(timestamp);if(!Number.isFinite(ts)||Math.abs(Date.now()/1000-ts)>300)return false;
  const raw=secret.startsWith('whsec_')?secret.slice(6):secret;
  let key;try{key=Buffer.from(raw,'base64')}catch{return false}
  const expected=crypto.createHmac('sha256',key).update(id+'.'+timestamp+'.'+payload).digest('base64');
  const candidates=String(signature).split(' ').flatMap(x=>x.split(',')).filter(x=>x&&x!=='v1');
  return candidates.some(sig=>{
    try{
      const a=Buffer.from(sig),b=Buffer.from(expected);
      return a.length===b.length&&crypto.timingSafeEqual(a,b);
    }catch{return false}
  });
}
function statusFor(type){
  const m={
    'email.sent':'sent','email.scheduled':'scheduled','email.delivered':'delivered','email.delivery_delayed':'delayed',
    'email.bounced':'bounced','email.complained':'complained','email.opened':'opened','email.clicked':'clicked',
    'email.failed':'failed','email.suppressed':'suppressed'
  };
  return m[type]||type.replace(/^email\./,'');
}
async function handler(req,res){
  if(req.method!=='POST')return out(res,405,{ok:false});
  try{
    const payload=await rawBody(req),id=String(req.headers['svix-id']||''),timestamp=String(req.headers['svix-timestamp']||''),signature=String(req.headers['svix-signature']||''),secret=await webhookSecret();
    if(!verify(secret,payload,id,timestamp,signature))return out(res,400,{ok:false,error:'Invalid signature'});
    const event=JSON.parse(payload),type=String(event?.type||''),emailId=String(event?.data?.email_id||event?.data?.id||'');
    const existing=await db('/rest/v1/email_webhook_events?id=eq.'+encodeURIComponent(id)+'&select=id&limit=1');
    if(existing?.length)return out(res,200,{ok:true,deduplicated:true});
    await db('/rest/v1/email_webhook_events',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{id,event_type:type,provider_email_id:emailId||null,payload:event}])});
    if(emailId){
      const status=statusFor(type),at=event?.created_at||new Date().toISOString();
      await db('/rest/v1/email_deliveries?provider_email_id=eq.'+encodeURIComponent(emailId),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,last_event:status,last_event_at:at})});
    }
    return out(res,200,{ok:true});
  }catch(e){
    console.error('[resend-webhook]',e);
    return out(res,500,{ok:false});
  }
}
handler.config={api:{bodyParser:false}};
module.exports=handler;
