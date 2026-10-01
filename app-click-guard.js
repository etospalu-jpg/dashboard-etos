(function installInteractionGuard(){
  'use strict';
  if(window.__ETOS_CLICK_GUARD)return;
  window.__ETOS_CLICK_GUARD='v30';

  const NativeMO=window.MutationObserver;
  if(NativeMO&&!window.__ETOS_SAFE_MUTATION_OBSERVER){
    window.__ETOS_SAFE_MUTATION_OBSERVER=true;
    window.MutationObserver=class SafeMutationObserver extends NativeMO{
      constructor(cb){
        let queued=false,lastRecords=[];
        super((records,observer)=>{
          lastRecords=records;
          if(queued)return;
          queued=true;
          setTimeout(()=>{
            queued=false;
            try{cb(lastRecords,observer)}catch(e){console.warn('[ETOS mutation observer]',e?.message||e)}
          },120);
        });
      }
    };
  }

  window.etosButtonBusy=function(btn,on,label){
    if(!btn)return;
    if(on){
      if(btn.dataset.etosBusy==='1')return false;
      btn.dataset.etosBusy='1';btn.dataset.etosHtml=btn.innerHTML;btn.disabled=true;btn.setAttribute('aria-busy','true');btn.classList.add('etos-busy');
      btn.innerHTML='<span class="etos-btn-spinner" aria-hidden="true"></span><span>'+String(label||'Memproses')+'…</span>';
    }else{
      btn.dataset.etosBusy='0';btn.disabled=false;btn.removeAttribute('aria-busy');btn.classList.remove('etos-busy');if(btn.dataset.etosHtml){btn.innerHTML=btn.dataset.etosHtml;delete btn.dataset.etosHtml}window.lucide?.createIcons?.();
    }
    return true;
  };

  const style=document.createElement('style');
  style.id='etos-click-guard-style';
  style.textContent=`
    .modal:not(.open),.drawer:not(.open),.backdrop:not(.open),#mobile-backdrop:not(.open){display:none!important;pointer-events:none!important}
    .modal.open,.drawer.open,.backdrop.open,#mobile-backdrop.open{pointer-events:auto!important}
    #main-app,.main,.sidebar,.topbar,.content-pad,.view.active{pointer-events:auto!important}
    button,a,input,select,textarea,[onclick],.nav-btn,[data-drawer-close]{pointer-events:auto!important}
    #awardee-drawer.open .drawer-panel{position:relative;z-index:2;pointer-events:auto!important}
    #awardee-drawer-close{position:relative;z-index:30;pointer-events:auto!important;touch-action:manipulation}
    [inert]{pointer-events:auto!important}
    .btn,.nav-btn,[role="button"]{touch-action:manipulation}
    .btn.etos-tap,.nav-btn.etos-tap{transform:scale(.965)!important;filter:brightness(.98)}
    .btn.etos-busy{cursor:wait;opacity:.88;pointer-events:none}
    .etos-btn-spinner{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:999px;display:inline-block;animation:etosBtnSpin .65s linear infinite}
    @keyframes etosBtnSpin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(style);

  function unlock(){
    document.querySelectorAll('[inert]').forEach(el=>el.removeAttribute('inert'));
    const app=document.getElementById('main-app');
    if(app){
      app.style.pointerEvents='auto';
      if(!document.body.classList.contains('etos-booting')){
        app.style.visibility='visible';
        app.style.opacity='1';
      }
    }
    document.querySelectorAll('.modal:not(.open),.drawer:not(.open),.backdrop:not(.open)').forEach(el=>{el.style.pointerEvents='none'});
  }

  document.addEventListener('pointerdown',e=>{const b=e.target?.closest?.('.btn,.nav-btn,[role="button"]');if(!b||b.disabled)return;b.classList.add('etos-tap');setTimeout(()=>b.classList.remove('etos-tap'),170)},{passive:true});
  document.addEventListener('pointerup',e=>e.target?.closest?.('.btn,.nav-btn,[role="button"]')?.classList.remove('etos-tap'),{passive:true});
  document.addEventListener('pointercancel',e=>e.target?.closest?.('.btn,.nav-btn,[role="button"]')?.classList.remove('etos-tap'),{passive:true});

  document.addEventListener('click',e=>{
    const nav=e.target?.closest?.('.nav-btn[data-view]');
    if(!nav)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const view=nav.dataset.view;
    if(typeof window.goView==='function'){
      Promise.resolve(window.goView(view)).catch(err=>console.warn('[ETOS nav]',err?.message||err));
    }
  },true);

  function closeAwardeeDrawer(){
    const d=document.getElementById('awardee-drawer');
    if(d)d.classList.remove('open');
    document.documentElement.classList.remove('drawer-open');
    document.body.classList.remove('drawer-open');
  }
  window.closeAwardeeDrawer=closeAwardeeDrawer;
  window.closeDrawer=closeAwardeeDrawer;
  document.addEventListener('click',e=>{
    const close=e.target?.closest?.('[data-drawer-close]');
    if(!close)return;
    e.preventDefault();
    e.stopPropagation();
    closeAwardeeDrawer();
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('awardee-drawer')?.classList.contains('open'))closeAwardeeDrawer()});

  window.etosUnlockUI=unlock;
  setInterval(unlock,1500);
})();
