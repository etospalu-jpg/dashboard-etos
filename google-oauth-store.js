const crypto=require('crypto');
const https=require('https');
const session=require('./server-session');
const PROVIDER='google_idp_oauth';

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
function directRequest(path,{method='GET',body=null,headers={}}={}){
  return new Promise((resolve,reject)=>{
    const key=session.secret(),kind=session.kind(key);
    if(!key||!['secret','legacy'].includes(kind))return reject(new Error('Supabase server credential tidak tersedia.'));
    const base=new URL(session.PROJECT_URL),payload=body==null?null:JSON.stringify(body);
    const h={apikey:key,Accept:'application/json','Content-Type':'application/json',...headers};
    if(kind==='legacy')h.Authorization='Bearer '+key;
    if(payload)h['Content-Length']=Buffer.byteLength(payload);
    const req=https.request({protocol:base.protocol,hostname:base.hostname,port:443,path,method,headers:h},res=>{
      const chunks=[];res.on('data',d=>chunks.push(d));res.on('end',()=>{
        const text=Buffer.concat(chunks).toString('utf8');let parsed=null;
        try{parsed=text?JSON.parse(text):null}catch{parsed=text}
        if(res.statusCode>=200&&res.statusCode<300)return resolve(parsed);
        reject(new Error(parsed?.message||parsed?.error||`Supabase HTTP ${res.statusCode}`));
      });
    });
    req.on('error',reject);if(payload)req.write(payload);req.end();
  });
}
async function getRow(){
  const rows=await directRequest('/rest/v1/integration_secrets?provider=eq.'+encodeURIComponent(PROVIDER)+'&select=provider,ciphertext,iv,auth_tag,metadata,updated_at&limit=1');
  return Array.isArray(rows)&&rows.length?rows[0]:null;
}
async function getConfig(){return decrypt(await getRow())}
async function saveConfig(config,metadata={}){
  const enc=encrypt(config),row={provider:PROVIDER,...enc,metadata,updated_at:new Date().toISOString()};
  const rows=await directRequest('/rest/v1/integration_secrets?on_conflict=provider',{method:'POST',body:row,headers:{Prefer:'resolution=merge-duplicates,return=representation'}});
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
