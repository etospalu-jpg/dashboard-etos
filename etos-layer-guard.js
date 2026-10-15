/* ETOS ID PALU | Shared foreground interaction and scroll isolation
   Only the top visible modal/drawer may receive scroll or keyboard focus.
   No changes to auth, form state, validation, or backend. */
(()=>{'use strict';
 if(window.ETOSLayerGuard)return;
 const selectors='.modal.open,.drawer.open,.service-dialog:not([hidden]),.login-panel:not([hidden]),[role="dialog"][aria-modal="true"],dialog[open],[data-etos-overlay].open';
 const scrollArea='.modal-card,.drawer-panel,.service-dialog-inner,.login-panel,dialog[open],[data-etos-scroll]';
 let active=[],locked=false,scrollY=0,previousStyles=null,previousHtml=null,restoreFocus=null,tick=0;
 const isVisible=el=>{
  if(!el?.isConnected||el.closest('[hidden],[inert]'))return false;
  const cs=getComputedStyle(el);
  return cs.display!=='none'&&cs.visibility!=='hidden'&&el.getClientRects().length>0;
 };
 const overlay=el=>{
  if(el.matches('.modal,.drawer,.service-dialog,dialog[open],[data-etos-overlay]'))return el;
  return el.closest('.modal,.drawer,.service-dialog,[data-etos-overlay]')||el;
 };
 function scan(){
  const seen=new Set(),opened=[];
  document.querySelectorAll(selectors).forEach(el=>{
   const outer=overlay(el);
   if(!isVisible(outer)||seen.has(outer))return;
   seen.add(outer);opened.push(outer);
  });
  return opened;
 }
 const topmost=()=>active[active.length-1]||null;
 const focusables=root=>[...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>isVisible(el)&&!el.closest('[aria-hidden="true"]'));
 function focusTop(root){
  if(!root||root.contains(document.activeElement))return;
  const target=focusables(root)[0]||root;
  if(target===root&&!root.hasAttribute('tabindex'))root.setAttribute('tabindex','-1');
  try{target.focus({preventScroll:true})}catch(_){}
 }
 function lock(){
  if(locked)return;locked=true;
  scrollY=window.scrollY||document.documentElement.scrollTop||0;
  restoreFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const b=document.body,h=document.documentElement;
  const keys=['position','top','left','right','width','overflow','overscrollBehavior'];
  previousStyles=Object.fromEntries(keys.map(k=>[k,b.style[k]]));
  previousHtml={overflow:h.style.overflow,overscrollBehavior:h.style.overscrollBehavior};
  h.classList.add('etos-layer-locked');b.classList.add('etos-layer-locked');
  h.style.overflow='hidden';h.style.overscrollBehavior='none';
  b.style.position='fixed';b.style.top=-scrollY+'px';b.style.left='0';b.style.right='0';b.style.width='100%';b.style.overflow='hidden';b.style.overscrollBehavior='none';
 }
 function unlock(){
  if(!locked)return;locked=false;
  const b=document.body,h=document.documentElement;
  h.classList.remove('etos-layer-locked');b.classList.remove('etos-layer-locked');
  for(const [k,v] of Object.entries(previousStyles||{}))b.style[k]=v;
  h.style.overflow=previousHtml?.overflow||'';
  h.style.overscrollBehavior=previousHtml?.overscrollBehavior||'';
  window.scrollTo(0,scrollY);
  if(restoreFocus?.isConnected)try{restoreFocus.focus({preventScroll:true})}catch(_){}
  previousStyles=previousHtml=restoreFocus=null;
 }
 function update(){
  tick=0;const next=scan(),wasTop=topmost();
  // Preserve activation order for nested dialogs rather than assuming DOM order.
  const newlyOpened=next.filter(el=>!active.includes(el));
  active=active.filter(el=>next.includes(el)).concat(newlyOpened);
  const newest=topmost();
  if(newest){
   if(!locked)lock();
   if(wasTop!==newest)focusTop(newest);
  }else unlock();
 }
 function schedule(){if(!tick)tick=requestAnimationFrame(update)}
 const observer=new MutationObserver(records=>{
  if(records.some(r=>r.target!==document.body&&r.target!==document.documentElement))schedule();
 });
 observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','open','aria-modal']});
 document.addEventListener('focusin',e=>{
  const t=topmost();if(t&&!t.contains(e.target))focusTop(t);
 },true);
 document.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const top=topmost();if(!top)return;
  const items=focusables(top);
  if(!items.length){e.preventDefault();focusTop(top);return}
  const first=items[0],last=items[items.length-1];
  if(e.shiftKey&&(document.activeElement===first||!top.contains(document.activeElement))){e.preventDefault();last.focus({preventScroll:true})}
  else if(!e.shiftKey&&(document.activeElement===last||!top.contains(document.activeElement))){e.preventDefault();first.focus({preventScroll:true})}
 },true);
 // Wheel/touch over a backdrop must not scroll the obscured document.
 const allowed=target=>{
  const t=topmost();
  if(!t||!t.contains(target))return false;
  return !!target.closest(scrollArea)||t.matches(scrollArea);
 };
 document.addEventListener('wheel',e=>{if(locked&&!allowed(e.target))e.preventDefault()},{capture:true,passive:false});
 document.addEventListener('touchmove',e=>{if(locked&&!allowed(e.target))e.preventDefault()},{capture:true,passive:false});
 window.addEventListener('pageshow',schedule);
 window.ETOSLayerGuard={refresh:schedule,get locked(){return locked},get count(){return active.length}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();