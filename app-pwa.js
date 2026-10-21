(function(){
'use strict';
// Keep Chromium's native install indicator and browser-owned install prompt.
// Never call beforeinstallprompt.preventDefault(): this would suppress browser promotion.
let browserEligible=false;
window.addEventListener('beforeinstallprompt',()=>{browserEligible=true});
window.addEventListener('appinstalled',()=>{browserEligible=false});
function installed(){return !!(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true)}
async function register(){
 if(!('serviceWorker'in navigator)||!window.isSecureContext)return;
 try{const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
  registration.update().catch(()=>{});
 }catch(e){console.warn('[ETOS PWA] worker unavailable:',String(e.message||e).slice(0,140))}
}
if(document.readyState==='complete')register();
else window.addEventListener('load',register,{once:true});
window.ETOSPWA={version:'38.12',isStandalone:installed,isBrowserEligible:()=>browserEligible};
})();
