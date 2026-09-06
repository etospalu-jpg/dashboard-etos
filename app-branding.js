(function(){
'use strict';
function applyBranding(){
  document.title='ETOS ID Palu — Awardee Intelligence';
  let icon=document.querySelector('link[rel~="icon"]');if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.appendChild(icon)}icon.type='image/svg+xml';icon.href='/favicon.svg?v=2';
  const side=document.getElementById('sidebar');
  if(side&&side.firstElementChild&&!side.firstElementChild.classList.contains('brand-head')){
    const head=side.firstElementChild;head.className='brand-head';head.innerHTML=`<div class="brand-lockup"><div class="brand-logo-card"><img src="/brand-etos.svg?v=2" alt="ETOS ID"></div><div class="brand-caption"><b>Palu</b><span>Awardee Intelligence</span></div><button class="mobile-only absolute right-2 top-2 w-9 h-9 rounded-xl bg-[#0b1b15]/5 text-[#0b1b15] items-center justify-center" onclick="toggleSidebar(false)"><i data-lucide="x" class="w-4 h-4"></i></button></div>`;
  }
  const top=document.querySelector('.topbar > .flex.items-center.gap-3');
  if(top&&!top.querySelector('.topbar-brandmark')){const mark=document.createElement('div');mark.className='topbar-brandmark';mark.innerHTML='<img src="/favicon.svg?v=2" alt="ETOS">';top.insertBefore(mark,top.firstChild)}
  if(typeof lucide!=='undefined')lucide.createIcons();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBranding);else applyBranding();
})();
