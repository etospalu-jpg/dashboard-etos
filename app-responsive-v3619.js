(function(){
'use strict';
if(window.ETOS_RESPONSIVE_V3619)return;window.ETOS_RESPONSIVE_V3619=true;

/* Delayed, reference-counted global loader: quick requests never flash a blocking overlay. */
(function(){
  const loader=document.getElementById('loader');
  let count=0,timer=null,visible=false;
  window.showLoader=function(on){
    if(!loader)return;
    if(on){
      count++;
      if(visible||timer)return;
      timer=setTimeout(()=>{timer=null;if(count>0){visible=true;loader.classList.add('show')}},220);
    }else{
      count=Math.max(0,count-1);
      if(count===0){
        if(timer){clearTimeout(timer);timer=null}
        if(visible){visible=false;loader.classList.remove('show')}
      }
    }
  };
})();

/* Coalesce identical read requests that happen during the same render cycle. */
(function(){
  const api=window.etosAPI;
  if(!api?.call||api.__etosDedupe)return;
  const base=api.call.bind(api),inflight=new Map();
  api.call=function(name,params){
    const n=String(name||'');
    const read=/^(get|list|load|fetch)/i.test(n)&&!/^getPublicKajianReflectionForm$/i.test(n);
    if(!read)return base(name,params);
    const key=n+'|'+JSON.stringify(params??null);
    if(inflight.has(key))return inflight.get(key);
    const job=Promise.resolve(base(name,params)).finally(()=>setTimeout(()=>inflight.delete(key),80));
    inflight.set(key,job);
    return job;
  };
  api.__etosDedupe=true;
})();

function css(){
  if(document.getElementById('etos-responsive-v3619-style'))return;
  const s=document.createElement('style');s.id='etos-responsive-v3619-style';s.textContent=`
  .btn{transition:transform .14s ease,opacity .14s ease,background-color .14s ease,border-color .14s ease}
  .btn:active:not(:disabled){transform:translateY(1px) scale(.99)}
  .btn:disabled{opacity:.58!important;cursor:wait!important;pointer-events:none!important}
  .etos-busy{position:relative;pointer-events:none!important;opacity:.68!important}
  .etos-busy:after{content:"";width:13px;height:13px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;display:inline-block;margin-left:8px;vertical-align:-2px;animation:etosSpin .7s linear infinite}
  @keyframes etosSpin{to{transform:rotate(360deg)}}
  .modal-card{max-width:min(94vw,980px);max-height:min(92dvh,920px)}
  .modal-card form{overscroll-behavior:contain}
  #dc-records,#settings-data-workspace{min-width:0}
  #dc-catalog{scrollbar-width:none}
  #dc-catalog::-webkit-scrollbar{display:none}
  .table-wrap{overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
  @media(max-width:1023px){
    #dc-workspace>.grid{display:block!important;min-height:0!important}
    #dc-workspace aside{border-right:0!important;border-bottom:1px solid #e8eeea!important;padding:10px!important;overflow:hidden}
    #dc-catalog{display:flex!important;gap:7px!important;overflow-x:auto!important;padding-bottom:2px!important}
    #dc-catalog>button{width:auto!important;min-width:max-content!important;white-space:nowrap!important}
    #dc-records{padding:14px!important}
    #settings-backoffice-hub .bo-hero{border-radius:20px!important}
  }
  @media(max-width:640px){
    .content-pad{padding-left:12px!important;padding-right:12px!important}
    .card,.card-flat{border-radius:16px}
    .modal{padding:10px!important}
    .modal-card{width:100%!important;max-width:100%!important;max-height:94dvh!important;border-radius:18px!important}
    .modal-card>form,.modal-card .p-5,.modal-card .p-6{padding-left:16px!important;padding-right:16px!important}
    input.input,select.input,textarea.input{font-size:16px!important}
    .btn{min-height:42px}
    #view-settings .grid.sm\\:grid-cols-2,#view-settings .grid.xl\\:grid-cols-3{grid-template-columns:1fr!important}
    #settings-backoffice-hub .bo-item{min-height:0!important}
    #settings-backoffice-hub .bo-item .flex.gap-2{flex-wrap:wrap}
    #settings-backoffice-hub .bo-item .btn{flex:1 1 auto}
    #dc-table-head{padding:12px 14px!important}
    #dc-records .grid.lg\\:grid-cols-2{grid-template-columns:1fr!important}
    #dc-records .card-flat{padding:14px!important}
    #attendance-entry-list .attendance-status{width:108px!important;min-width:108px!important}
    #attendance-entry-list>div{padding-left:12px!important;padding-right:12px!important}
    #access-control-users .grid{grid-template-columns:1fr!important}
    #access-control-users .btn{width:100%}
  }`;
  document.head.appendChild(s);
}
css();

window.etosButtonBusy=function(btn,on,label){
  if(!btn)return;
  if(on){
    if(btn.dataset.etosBusy==='1')return;
    btn.dataset.etosBusy='1';btn.dataset.etosHtml=btn.innerHTML;btn.disabled=true;btn.classList.add('etos-busy');
    if(label)btn.textContent=label;
  }else{
    if(btn.dataset.etosBusy!=='1')return;
    btn.disabled=false;btn.classList.remove('etos-busy');
    if(btn.dataset.etosHtml)btn.innerHTML=btn.dataset.etosHtml;
    delete btn.dataset.etosBusy;delete btn.dataset.etosHtml;
    window.lucide?.createIcons?.();
  }
};

/* Prevent accidental double submits globally without blocking normal navigation. */
document.addEventListener('submit',ev=>{
  const form=ev.target;if(!(form instanceof HTMLFormElement))return;
  const btn=form.querySelector('button[type="submit"]');
  if(btn&&btn.dataset.etosSubmitting==='1'){ev.preventDefault();ev.stopImmediatePropagation()}
},{capture:true});

window.lucide?.createIcons?.();
})();