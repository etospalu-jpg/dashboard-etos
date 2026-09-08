const crypto=require('crypto');
const {AsyncLocalStorage}=require('async_hooks');
const PROJECT_URL='https://weklmapqizeldfdalbgs.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const EDGE_PROXY=PROJECT_URL+'/functions/v1/server-data-proxy';
const COOKIE='etos_session';
const AUTH_COOKIE='etos_auth_token';
const MAX_AGE=6*60*60;
const requestContext=new AsyncLocalStorage();
const nativeFetch=globalThis.fetch.bind(globalThis);
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
function remember(req){const authHeader=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'').trim();const authCookie=cookies(req)[AUTH_COOKIE]||'';requestContext.enterWith({cookieHeader:String(req.headers?.cookie||''),userToken:authHeader||authCookie||''})}
function contextAuth(){return requestContext.getStore()||{cookieHeader:'',userToken:''}}
function dbHeaders(credential,extra={}){if(credential?.server)return{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json','x-etos-proxy':'1',...extra};return{apikey:PUBLISHABLE_KEY,Authorization:`Bearer ${credential?.token||''}`,'Content-Type':'application/json',...extra}}
function credential(req){remember(req);const s=verify(req);if(s){if(!originAllowed(req))return null;const k=secret(),t=kind(k);return{server:true,key:k,kind:t,session:s}}const header=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'').trim();if(header)return{server:false,token:header};const authCookie=cookies(req)[AUTH_COOKIE];if(authCookie){if(!originAllowed(req))return null;return{server:false,token:authCookie,cookie:true}}return null}
function requestUrl(input){if(typeof input==='string')return input;if(input instanceof URL)return input.href;return input?.url?String(input.url):String(input||'')}
function mergedHeaders(input,init){try{return new Headers(init?.headers||input?.headers||{})}catch{return new Headers(init?.headers||{})}}
function copyProxyHeaders(h){const out={};for(const name of ['accept','prefer','range','content-type','x-client-info']){const v=h.get(name);if(v)out[name]=v}return out}
function shouldProxy(url,h){if(!url.startsWith(PROJECT_URL)||url.startsWith(EDGE_PROXY))return false;const marker=h.get('x-etos-proxy')==='1';const k=secret(),api=String(h.get('apikey')||'').trim();return marker||!!(k&&api&&api===k)}
async function proxyFetch(input,init={}){const url=requestUrl(input),h=mergedHeaders(input,init);if(!shouldProxy(url,h))return nativeFetch(input,init);const ctx=contextAuth();if(!ctx.cookieHeader){return nativeFetch(input,init)}const method=String(init?.method||input?.method||'GET').toUpperCase();let body=init?.body??null;if(body!=null&&typeof body!=='string'){if(body instanceof URLSearchParams)body=body.toString();else if(Buffer.isBuffer(body)||body instanceof Uint8Array)body=Buffer.from(body).toString('base64');else body=String(body)}const headers={'Content-Type':'application/json','apikey':PUBLISHABLE_KEY,'x-etos-session-cookie':Buffer.from(ctx.cookieHeader).toString('base64url')};return nativeFetch(EDGE_PROXY,{method:'POST',headers,body:JSON.stringify({action:'proxy',path:url.slice(PROJECT_URL.length),method,headers:copyProxyHeaders(h),body})})}
if(!globalThis.__ETOS_SERVER_PROXY_FETCH){globalThis.__ETOS_SERVER_PROXY_FETCH=true;globalThis.fetch=proxyFetch}
async function testDatabase(){const k=secret(),t=kind(k);if(t!=='secret'&&t!=='legacy')return{ok:false,kind:t,status:401,error:'Environment variable bukan Supabase Secret Key.'};try{const r=await globalThis.fetch(PROJECT_URL+'/rest/v1/awardees?select=id&limit=1',{headers:dbHeaders({server:true,key:k,kind:t})});const text=await r.text();return{ok:r.ok,kind:t,status:r.status,error:r.ok?null:text.slice(0,180)}}catch(e){return{ok:false,kind:t,status:503,error:e.message}}}
module.exports={PROJECT_URL,PUBLISHABLE_KEY,EDGE_PROXY,secret,kind,verify,setCookie,clearCookie,setAuthCookie,clearAuthCookie,credential,dbHeaders,testDatabase,originAllowed,MAX_AGE,AUTH_COOKIE,proxyFetch};
