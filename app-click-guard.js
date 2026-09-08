(function installInteractionGuard(){
  'use strict';
  if(window.__ETOS_CLICK_GUARD)return;
  window.__ETOS_CLICK_GUARD='v29';

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

  const style=document.createElement('style');
  style.id='etos-click-guard-style';
  style.textContent=`
    .modal:not(.open),.drawer:not(.open),.backdrop:not(.open),#mobile-backdrop:not(.open){display:none!important;pointer-events:none!important}
    .modal.open,.drawer.open,.backdrop.open,#mobile-backdrop.open{pointer-events:auto!important}
    #main-app,.main,.sidebar,.topbar,.content-pad,.view.active{pointer-events:auto!important}
    button,a,input,select,textarea,[onclick],.nav-btn{pointer-events:auto!important}
    [inert]{pointer-events:auto!important}
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

  window.etosUnlockUI=unlock;
  setInterval(unlock,1500);
})();
