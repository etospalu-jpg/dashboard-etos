(function(){
'use strict';
if(window.ETOS_ACCESS_POLICY_V36)return;window.ETOS_ACCESS_POLICY_V36=true;
async function currentSession(){try{return(await window.etosAuth?.getSession?.())?.data?.session||null}catch{return null}}
function wrapApi(){
 if(!window.etosAPI||window.etosAPI.__accessV36)return;
 const original=window.etosAPI.call.bind(window.etosAPI);
 window.etosAPI.call=async function(name,params){
  if(name==='getIDPOverview'||name==='getIDPDetail'){
   const s=await currentSession();
   if(!s)return{success:false,error:'Akses operasional diperlukan untuk IDP live.'};
   try{
    const r=await fetch('/api/idp-live',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({function:name,params:params||null})});
    const b=await r.json().catch(()=>({}));
    if(!r.ok||b?.success===false)return{success:false,error:b?.error||'IDP live tidak tersedia.'};
    return b;
   }catch(e){return{success:false,error:e?.message||'IDP live tidak tersedia.'}}
  }
  return original(name,params);
 };
 window.etosAPI.__accessV36=true;
}
function protectAttendance(){
 const original=window.openAttendanceEntry;
 if(typeof original!=='function'||original.__etosProtectedV36)return;
 const fn=function(){const args=arguments,ctx=this;return window.requireAuth?window.requireAuth(()=>original.apply(ctx,args)):(window.state?.auth?original.apply(ctx,args):window.openLogin?.())};
 fn.__etosProtectedV36=true;window.openAttendanceEntry=fn;
}
function init(){wrapApi();protectAttendance();setTimeout(()=>{wrapApi();protectAttendance()},500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
