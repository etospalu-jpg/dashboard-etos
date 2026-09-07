const session=require('../server-session');
function out(res,status,body){res.status(status);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
async function q(path,c,options={}){const r=await fetch(session.PROJECT_URL+path,{...options,headers:{...session.dbHeaders(c),...(options.headers||{})}});const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!r.ok){const e=new Error(body?.message||body?.error_description||body?.error||`Supabase ${r.status}`);e.status=r.status;throw e}return body}
function serverCred(){const key=session.secret(),kind=session.kind(key);return(kind==='secret'||kind==='legacy')?{server:true,key,kind}:null}
module.exports=async function handler(req,res){try{
 if(!session.originAllowed(req))return out(res,403,{success:false,error:'Origin request tidak diizinkan.'});
 if(req.method==='DELETE'){session.clearAuthCookie(res);return out(res,200,{success:true,data:{session:null}})}
 if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
 const token=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'').trim();if(!token)return out(res,401,{success:false,error:'Access token Supabase diperlukan.'});
 const c={server:false,token},user=await q('/auth/v1/user',c);if(!user?.id)return out(res,401,{success:false,error:'Session Auth tidak valid.'});
 const rows=await q(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,email,role,is_active,last_login_at`,c),profile=rows?.[0];
 if(!profile?.is_active)return out(res,403,{success:false,error:'Akun ETOS belum diaktifkan oleh administrator.'});
 const allowed=new Set(['superadmin','admin','facilitator','operator','viewer']);if(!allowed.has(String(profile.role||'').toLowerCase()))return out(res,403,{success:false,error:'Role akun tidak valid.'});
 const last=profile.last_login_at?new Date(profile.last_login_at).getTime():0;if(!last||Date.now()-last>5*60*1000){const sc=serverCred();if(sc){const now=new Date().toISOString();await q(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,sc,{method:'PATCH',body:JSON.stringify({last_login_at:now})}).catch(()=>{});profile.last_login_at=now}}
 let maxAge=3600;try{const p=JSON.parse(Buffer.from(token.split('.')[1]||'','base64url').toString('utf8'));if(p.exp)maxAge=Math.max(60,Math.min(3600,p.exp-Math.floor(Date.now()/1000)))}catch{}
 session.setAuthCookie(res,token,maxAge);
 return out(res,200,{success:true,data:{session:{kind:'user',user:{id:user.id,email:user.email||profile.email||null},profile,expires_in:maxAge}}});
 }catch(e){console.error('[auth-bridge]',e);return out(res,e.status||500,{success:false,error:e.message||String(e)})}}
