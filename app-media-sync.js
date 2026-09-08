(function(){'use strict';
const KEY='etos-audited-media-sync-v1';
const ASSESSMENT_EDGE='https://weklmapqizeldfdalbgs.supabase.co/functions/v1/awardee-assessment';
const PUBLISHABLE_KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
function installAssessmentEdgeBridge(){
 if(window.__ETOS_ASSESSMENT_EDGE_BRIDGE)return;window.__ETOS_ASSESSMENT_EDGE_BRIDGE=true;
 const previous=window.fetch.bind(window);
 window.fetch=async function(input,init){
  try{
   const url=typeof input==='string'?input:String(input?.url||'');
   if(/\/api\/public-attendance(?:\?|$)/.test(url)&&String(init?.method||'GET').toUpperCase()==='POST'&&init?.body){
    const body=JSON.parse(String(init.body));
    const map={assessment_hub:'hub',assessment_verify:'verify',assessment_save:'save'};
    if(map[body?.action]){
     const payload={...body,action:map[body.action]};
     return previous(ASSESSMENT_EDGE,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify(payload)});
    }
   }
  }catch(e){console.warn('[ETOS assessment bridge]',e?.message||e)}
  return previous(input,init);
 };
}
async function sync(force=false){try{if(!window.etosAuth)return;if(!force&&sessionStorage.getItem(KEY)==='ok')return;const x=await etosAuth.getSession();const session=x?.data?.session;if(!session?.access_token)return;const r=await fetch('/api/media-sync',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({action:'sync-audited'})});const b=await r.json().catch(()=>({}));if(r.ok&&b.success&&Number(b?.data?.failed||0)===0){sessionStorage.setItem(KEY,'ok');if(typeof toast==='function')toast(`Media terverifikasi tersinkron: ${b.data?.uploaded||0} file.`)}else if(r.ok&&b.success){console.warn('[ETOS audited media sync]',b.data);if(typeof toast==='function')toast(`${b.data?.failed||0} media masih gagal disinkron.`,'warn')}else{console.warn('[ETOS audited media sync]',b.error||r.status)}}catch(e){console.warn('[ETOS audited media sync]',e)}}
window.etosMigrateMedia=()=>sync(true);
function init(){installAssessmentEdgeBridge();if(window.etosAuth?.onChange)etosAuth.onChange((_event,session)=>{if(session?.access_token)setTimeout(()=>sync(true),700)});setTimeout(()=>sync(false),2200)}
installAssessmentEdgeBridge();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();