const crypto=require('crypto');
const PROJECT_URL='https://weklmapqizeldfdalbgs.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const COOKIE='etos_session';
const AUTH_COOKIE='etos_auth_token';
const MAX_AGE=6*60*60;
function normalize(raw){let s=String(raw||'').trim().replace(/^\uFEFF/,'');const m=s.match(/^SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY)\s*=\s*(.+)$/i);if(m)s=m[1].trim();if((s[0]==='"'&&s.at(-1)==='"')||(s[0]==="'"&&s.at(-1)==="'"))s=s.slice(1,-1).trim();return s.replace(/\r?\n/g,'').trim()}
function secret(){return normalize(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'')}
function kind(k){return k.startsWith('sb_secret_')?'secret':k.startsWith('eyJ')?'legacy':k?'unknown':'missing'}
function b64(v){return Buffer.from(v).toString('base64url')}
function unb64(v){return Buffer.from(v,'base64url').toString('utf8')}
function signingKey(){const s=secret();return crypto.createHash('sha256').update('ETOS-PIN-SESSION|'+s+'|e811d29b1b60cc0f4ffc2e65ffc4b14c38415da9c7b1cc73f73a97c67725a490').digest()}
function sign(v){return crypto.createHmac('sha256',signingKey()).update(v).digest('base64url')}
function createToken(){const now=Math.floor(Date.now()/1000);const p=b64(JSON.stringify({iat:now,exp:now+MAX_AGE,role:'superadmin',scope:'etos-operational',n:crypto.randomBytes(12).toString('hex')}));return p+'.'+sign(p)}
function cookies(req){const out={};String(req.headers?.cookie||'').split(';').forEach(x=>{const i=x.indexOf('=');if(i>0){try{out[x.slice(0,i).trim()]=decodeURIComponent(x.slice(i+1).trim())}catch{}}});return out}
function verify(req){try{const token=cookies(req)[COOKIE];if(!token)return null;const[p,s]=token.split('.');if(!p||!s)return null;const expected=sign(p);if(s.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(expected)))return null;const data=JSON.parse(unb64(p));if(!data.exp||data.exp<Math.floor(Date.now()/1000)||data.scope!=='etos-operational')return null;return data}catch{return null}}
function requestHost(req){return String(req.headers?.['x-forwarded-host']||req.headers?.host||'').split(',')[0].trim().toLowerCase()}
function originAllowed(req){const site=String(req.headers?.['sec-fetch-site']||'').toLowerCase();if(site==='cross-site')return false;const origin=String(req.headers?.origin||'').trim();if(!origin)return true;try{const u=new URL(origin),host=requestHost(req);if(!host||u.host.toLowerCase()!==host)return false;if(u.protocol==='https:')return true;return u.protocol==='http:'&&['localhost','127.0.0.1','::1'].includes(u.hostname)}catch{return false}}
function appendCookie(res,value){const current=res.getHeader?.('Set-Cookie');if(!current)res.setHeader('Set-Cookie',value);else res.setHeader('Set-Cookie',Array.isArray(current)?[...current,value]:[current,value])}
function setCookie(res){const token=createToken();appendCookie(res,`${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);return token}
function clearCookie(res){appendCookie(res,`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)}
function setAuthCookie(res,token,maxAge=3600){const age=Math.max(60,Math.min(3600,Number(maxAge)||3600));appendCookie(res,`${AUTH_COOKIE}=${encodeURIComponent(String(token||''))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`)}
function clearAuthCookie(res){appendCookie(res,`${AUTH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)}
function dbHeaders(credential,extra={}){if(credential?.server){const k=credential.key;const h={apikey:k,'Content-Type':'application/json',...extra};if(credential.kind==='legacy')h.Authorization=`Bearer ${k}`;return h}return{apikey:PUBLISHABLE_KEY,Authorization:`Bearer ${credential?.token||''}`,'Content-Type':'application/json',...extra}}
function credential(req){const s=verify(req);if(s){if(!originAllowed(req))return null;const k=secret(),t=kind(k);if(t==='secret'||t==='legacy')return{server:true,key:k,kind:t,session:s}}const header=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'').trim();if(header)return{server:false,token:header};const authCookie=cookies(req)[AUTH_COOKIE];if(authCookie){if(!originAllowed(req))return null;return{server:false,token:authCookie,cookie:true}}return null}
async function testDatabase(){const k=secret(),t=kind(k);if(t!=='secret'&&t!=='legacy')return{ok:false,kind:t,status:401,error:'Environment variable bukan Supabase Secret Key.'};const h={apikey:k,'Content-Type':'application/json'};if(t==='legacy')h.Authorization=`Bearer ${k}`;try{const r=await fetch(PROJECT_URL+'/rest/v1/awardees?select=id&limit=1',{headers:h});const text=await r.text();return{ok:r.ok,kind:t,status:r.status,error:r.ok?null:text.slice(0,180)}}catch(e){return{ok:false,kind:t,status:503,error:e.message}}}
module.exports={PROJECT_URL,PUBLISHABLE_KEY,secret,kind,verify,setCookie,clearCookie,setAuthCookie,clearAuthCookie,credential,dbHeaders,testDatabase,originAllowed,MAX_AGE,AUTH_COOKIE};
