/* ETOS Living Motion: one delegated cursor engine across official dashboard surfaces.
   Decorative only; native pointer, keyboard, forms and touch remain untouched. */
(()=>{'use strict';
 if(window.ETOSLivingMotion)return;
 const fine=matchMedia('(hover: hover) and (pointer: fine)');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const blocked='input,textarea,select,[contenteditable="true"],iframe,video,.modal,.drawer,.service-dialog,.login-panel,dialog,[data-etos-no-cursor]';
 const pathname=location.pathname||'/';
 const page=document.body.dataset.etosSurface||(
  pathname==='/'||pathname==='/index.html'||pathname.startsWith('/r/')?'dashboard':
  pathname==='/readmap.html'?'readmap':
  pathname==='/gagasan.html'?'gagasan':
  pathname==='/profil-awardee.html'?'profile':
  document.getElementById('main-app')?'dashboard':'profile');
 document.body.dataset.etosSurface=page;
 const candidate={
  dashboard:'#view-dashboard .card:not(.table-wrap),.view.active .card:not(.table-wrap),.view.active .card-flat:not(.overflow-auto),.view.active .metric',
  readmap:'.readmap-app #stats .metric,.readmap-app .service-card,.readmap-app .item,.readmap-app .gagasan-launch,.readmap-app .video-card',
  gagasan:'.editorial-feed .article-card,.editorial-feed .featured-card,.mine-item,.category-pill',
  profile:'.profile-wrap .metric,.profile-wrap .academic-card,.profile-wrap .journey-card,.profile-wrap .recent-panel'
 }[page]||'.card';
 const hero={
  dashboard:'#view-dashboard .hero',
  readmap:'.readmap-app #readmap-hero',
  gagasan:'.editorial-masthead,.editorial-feed .featured-card',
  profile:'.identity-panel'
 }[page];
 const isActive=()=>fine.matches&&!reduced.matches&&!document.body.classList.contains('etos-layer-locked');
 const layer=document.createElement('div');
 layer.className='etos-cursor-layer';layer.setAttribute('aria-hidden','true');
 layer.innerHTML='<span class="etos-cursor-orbit"></span><span class="etos-cursor-point"></span>';
 document.body.appendChild(layer);
 const orbit=layer.firstElementChild,dot=layer.lastElementChild;
 let x=-100,y=-100,ox=-100,oy=-100,dx=-100,dy=-100,raf=0,visible=false;
 let lastCard=null,scanRaf=0;
 function stop(){
  visible=false;layer.classList.remove('is-visible','is-interactive');
  if(raf){cancelAnimationFrame(raf);raf=0}
  if(lastCard)lastCard.classList.remove('etos-motion-hover');lastCard=null;
 }
 function frame(){
  if(!visible||!isActive()){raf=0;return}
  ox+=(x-ox)*.17;oy+=(y-oy)*.17;dx+=(x-dx)*.48;dy+=(y-dy)*.48;
  orbit.style.transform='translate3d('+ox+'px,'+oy+'px,0) translate(-50%,-50%)';
  dot.style.transform='translate3d('+dx+'px,'+dy+'px,0) translate(-50%,-50%)';
  raf=requestAnimationFrame(frame);
 }
 function mark(scope=document){
  if(!scope.querySelectorAll)return;
  scope.querySelectorAll(candidate).forEach(el=>{
   if(el.closest('.modal,.drawer,.service-dialog,.login-panel,[data-etos-no-motion]'))return;
   el.classList.add('etos-motion-card');
   const blueCard=(page==='dashboard'&&el.matches('#view-dashboard .metric'))||
      (page==='readmap'&&el.matches('#stats .metric,.service-card,.gagasan-launch'))||
      (page==='profile'&&el.matches('.profile-wrap .metric'));
   el.dataset.etosMotionMode=blueCard?'fill':'glow';
  });
  scope.querySelectorAll(hero).forEach(el=>el.classList.add('etos-motion-hero'));
 }
 function scheduleScan(){if(scanRaf)return;scanRaf=requestAnimationFrame(()=>{scanRaf=0;mark()})}
 function onMove(e){
  if(e.pointerType!=='mouse'||!isActive()){stop();return}
  if(!(e.target instanceof Element)||e.target.closest(blocked)){stop();return}
  x=e.clientX;y=e.clientY;
  if(!visible){ox=x;oy=y;dx=x;dy=y;visible=true;layer.classList.add('is-visible')}
  const el=e.target.closest('.etos-motion-card,.etos-motion-hero');
  const clickable=!!e.target.closest('a,button,[role="button"]');
  layer.classList.toggle('is-interactive',clickable||!!el);
  if(lastCard!==el){lastCard?.classList.remove('etos-motion-hover');lastCard=el;if(el)el.classList.add('etos-motion-hover')}
  if(el){
   const bounds=el.getBoundingClientRect();
   if(bounds.width&&bounds.height){
    const rx=Math.max(0,Math.min(100,(x-bounds.left)/bounds.width*100));
    const ry=Math.max(0,Math.min(100,(y-bounds.top)/bounds.height*100));
    el.style.setProperty('--etos-pointer-x',rx.toFixed(1)+'%');
    el.style.setProperty('--etos-pointer-y',ry.toFixed(1)+'%');
   }
  }
  if(!raf)raf=requestAnimationFrame(frame);
 }
 function onLeave(e){if(e.relatedTarget===null)stop()}
 document.addEventListener('pointermove',onMove,{passive:true});
 document.addEventListener('pointerout',onLeave,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
 window.addEventListener('blur',stop);
 fine.addEventListener?.('change',stop);reduced.addEventListener?.('change',stop);
 const observer=new MutationObserver(items=>{
  if(items.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&n!==layer)))scheduleScan();
 });
 observer.observe(document.body,{childList:true,subtree:true});
 mark();
 window.ETOSLivingMotion={refresh:scheduleScan,stop,surface:page};
})();