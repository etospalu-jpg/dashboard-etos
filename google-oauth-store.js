const crypto=require('crypto');
const session=require('./server-session');
const PROVIDER='google_idp_oauth';
const SESSION_SALT='e811d29b1b60cc0f4ffc2e65ffc4b14c38415da9c7b1cc73f73a97c67725a490';

function secretKey(){
  const raw=session.secret();
  if(!raw)throw new Error('Supabase server secret belum tersedia.');
  return crypto.createHash('sha256').update('ETOS-GOOGLE-OAUTH|'+raw+'|v36.4').digest();
}
function encrypt(value){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',secretKey(),iv);
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return{ciphertext:ciphertext.toString('base64'),iv:iv.toString('base64'),auth_tag:cipher.getAuthTag().toString('base64')};
}
function decrypt(row){
  if(!row)return null;
  const decipher=crypto.createDecipheriv('aes-256-gcm',secretKey(),Buffer.from(row.iv,'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag,'base64'));
  const plain=Buffer.concat([decipher.update(Buffer.from(row.ciphertext,'base64')),decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}
function internalSessionCookie(){
  const serverSecret=session.secret();if(!serverSecret)throw new Error('Supabase server secret belum tersedia.');
  const signingKey=crypto.createHash('sha256').update('ETOS-PIN-SESSION|'+serverSecret+'|'+SESSION_SALT).digest();
  const now=Math.floor(Date.now()/1000),payload=Buffer.from(JSON.stringify({iat:now,exp:now+300,role:'superadmin',scope:'etos-operational',n:crypto.randomBytes(12).toString('hex')})).toString('base64url');
  const sig=crypto.createHmac('sha256',signingKey).update(payload).digest('base64url');
  return `etos_session=${encodeURIComponent(payload+'.'+sig)}`;
}
async function proxyRequest(path,{method='GET',body=null,headers={}}={}){
  const cookie=internalSessionCookie();
  const response=await fetch(session.EDGE_PROXY,{method:'POST',headers:{apikey:session.PUBLISHABLE_KEY,'Content-Type':'application/json','x-etos-session-cookie':Buffer.from(cookie).toString('base64url')},body:JSON.stringify({action:'proxy',path,method,headers:{accept:'application/json','content-type':'application/json',...headers},body:body==null?null:JSON.stringify(body)})});
  const text=await response.text();let parsed=null;try{parsed=text?JSON.parse(text):null}catch{parsed=text}
  if(!response.ok)throw new Error(parsed?.error||parsed?.message||`Supabase proxy HTTP ${response.status}`);
  return parsed;
}
async function getRow(){
  const rows=await proxyRequest('/rest/v1/integration_secrets?provider=eq.'+encodeURIComponent(PROVIDER)+'&select=provider,ciphertext,iv,auth_tag,metadata,updated_at&limit=1');
  return Array.isArray(rows)&&rows.length?rows[0]:null;
}
async function getConfig(){return decrypt(await getRow())}
async function saveConfig(config,metadata={}){
  const enc=encrypt(config),row={provider:PROVIDER,...enc,metadata,updated_at:new Date().toISOString()};
  const rows=await proxyRequest('/rest/v1/integration_secrets?on_conflict=provider',{method:'POST',body:row,headers:{prefer:'resolution=merge-duplicates,return=representation'}});
  return Array.isArray(rows)?rows[0]:rows;
}
async function status(){
  const row=await getRow();if(!row)return{configured:false,connected:false};
  let cfg=null;try{cfg=decrypt(row)}catch{return{configured:true,connected:false,error:'Credential terenkripsi tidak dapat dibaca.'}}
  return{configured:!!(cfg?.clientId&&cfg?.clientSecret),connected:!!cfg?.refreshToken,connectedAt:row.metadata?.connectedAt||null,account:row.metadata?.account||null,updatedAt:row.updated_at||null};
}
function stateToken(){return crypto.randomBytes(24).toString('base64url')}
function safeEqual(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
module.exports={PROVIDER,getConfig,saveConfig,status,stateToken,safeEqual};
