(function(){
'use strict';
if(window.ETOS_ADMIN_LAUNCHER_V36)return;window.ETOS_ADMIN_LAUNCHER_V36=true;
function role(){try{return String(state?.session?.kind==='pin'?'superadmin':state?.session?.role||state?.session?.profile?.role||state?.role||'public').toLowerCase()}catch{return'public'}}
function allowed(){return['operator','facilitator','admin','superadmin'].includes(role())}
function openHub(){if(!allowed()){window.openLogin?.();return}if(typeof window.openDataCenterHub==='function')return window.openDataCenterHub();window.goView?.('settings')}
function inject(){const nav=document.querySelector('#sidebar nav');if(!nav)return;let b=document.getElementById('data-center-nav');if(!b){b=document.createElement('button');b.id='data-center-nav';b.className='nav-btn';b.innerHTML='<i data-lucide="database" class="w-4 h-4"></i>Data Center<span class="nav-dot"></span>';b.onclick=openHub;const system=nav.querySelector('.nav-btn[data-view="system"]'),profile=nav.querySelector('.nav-btn[data-view="profile"]');if(system)nav.insertBefore(b,system);else if(profile)nav.insertBefore(b,profile);else nav.appendChild(b)}b.style.display=allowed()?'':'none';b.setAttribute('aria-hidden',allowed()?'false':'true');window.lucide?.createIcons?.()}
const previous=window.updateAuthUI;window.updateAuthUI=function(){const r=typeof previous==='function'?previous.apply(this,arguments):undefined;queueMicrotask(inject);return r};
inject();window.addEventListener('etos:enhancements-ready',inject,{once:true});
})();
