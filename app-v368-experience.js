(function(){
'use strict';
if(window.ETOS_V368_EXPERIENCE)return;window.ETOS_V368_EXPERIENCE=true;

const REDUCED=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let achievementsPromise=null;

function installMotion(){
  if(document.getElementById('etos-v368-motion'))return;
  const s=document.createElement('style');s.id='etos-v368-motion';s.textContent=`
  :root{--etos-ease:cubic-bezier(.22,.82,.2,1);--etos-fast:160ms;--etos-med:300ms}
  html{scroll-behavior:smooth}
  .view.active{animation:etosViewIn var(--etos-med) var(--etos-ease) both;transform-origin:50% 0}
  .nav-btn,.btn,.card,.card-flat,.pill,.input{transition:transform var(--etos-fast) var(--etos-ease),box-shadow var(--etos-med) var(--etos-ease),border-color var(--etos-fast) ease,background-color var(--etos-fast) ease,opacity var(--etos-fast) ease}
  .nav-btn{position:relative;will-change:transform}
  .nav-btn:hover{transform:translateX(3px)}
  .nav-btn:active,.btn:active{transform:scale(.965)}
  .nav-btn.active{box-shadow:inset 0 0 0 1px rgba(115,213,165,.08),0 7px 20px rgba(0,0,0,.08)}
  .btn:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 9px 24px rgba(8,39,28,.10)}
  @media(hover:hover) and (pointer:fine){.card:hover,.card-flat:hover{transform:translateY(-2px);box-shadow:0 16px 34px rgba(16,53,40,.07)}}
  .view.active tbody tr{animation:etosRowIn .28s var(--etos-ease) both}
  .view.active tbody tr:nth-child(2){animation-delay:18ms}.view.active tbody tr:nth-child(3){animation-delay:36ms}.view.active tbody tr:nth-child(4){animation-delay:54ms}.view.active tbody tr:nth-child(5){animation-delay:72ms}.view.active tbody tr:nth-child(n+6){animation-delay:90ms}
  .modal{transition:opacity .22s ease,visibility .22s ease}.modal .modal-card{transform:translateY(14px) scale(.985);opacity:0;transition:transform .3s var(--etos-ease),opacity .22s ease}.modal.open .modal-card{transform:none;opacity:1}
  #awardee-drawer,.drawer{transition:opacity .22s ease,visibility .22s ease}.drawer-panel,#awardee-drawer>div{transition:transform .34s var(--etos-ease),opacity .22s ease}
  .etos-nav-progress{position:fixed;z-index:9996;top:0;left:0;height:2px;width:100%;pointer-events:none;opacity:0;transition:opacity .14s ease}.etos-nav-progress:after{content:"";display:block;width:34%;height:100%;background:#2bb673;box-shadow:0 0 18px rgba(43,182,115,.55);transform:translateX(-110%)}
  html.etos-navigating .etos-nav-progress{opacity:1}html.etos-navigating .etos-nav-progress:after{animation:etosNavRun .7s var(--etos-ease) infinite}
  .metric-number{transition:opacity .18s ease,transform .24s var(--etos-ease)}
  .etos-data-ready{animation:etosDataReady .28s var(--etos-ease) both}
  @keyframes etosViewIn{from{opacity:0;transform:translateY(8px) scale(.997)}to{opacity:1;transform:none}}
  @keyframes etosRowIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
  @keyframes etosNavRun{0%{transform:translateX(-110%)}100%{transform:translateX(330%)}}
  @keyframes etosDataReady{from{opacity:.45;transform:translateY(3px)}to{opacity:1;transform:none}}
  @media(max-width:640px){.nav-btn:hover{transform:none}.view.active{animation-duration:.24s}.card:hover,.card-flat:hover{transform:none}}
  @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.view.active,.view.active tbody tr,.etos-data-ready{animation:none!important}.nav-btn,.btn,.card,.card-flat,.modal,.modal .modal-card,.drawer-panel{transition:none!important;transform:none!important}.etos-nav-progress{display:none}}
  `;document.head.appendChild(s);
  const p=document.createElement('div');p.className='etos-nav-progress';p.setAttribute('aria-hidden','true');document.body.appendChild(p);
}

function warmScript(name){
  if(document.querySelector(`link[data-etos-prefetch="${name}"]`))return;
  const l=document.createElement('link');l.rel='prefetch';l.as='script';l.href=`/${name}.js?v=${window.ETOS_VERSION||'36.8'}`;l.dataset.etosPrefetch=name;document.head.appendChild(l);
}
function warmModules(){['app-restore-idp','app-idp-upload-v365','app-restore-attendance','app-mentoring-journal','app-mentoring-cases','app-system','app-data-center','app-admin','app-access-control'].forEach(warmScript)}

function markReady(node){if(!node)return;node.classList.remove('etos-data-ready');void node.offsetWidth;node.classList.add('etos-data-ready')}
function rowsOf(v){return Array.isArray(v)?v:(v?.items||[])}
function cachedPublic(name){
  try{const r=window.etosPublicCache?.read?.(name,null);return r?.data!=null?r.data:null}catch(_){return null}
}
function renderAchievementsFast(rows){
  state.achievements=Array.isArray(rows)?rows:[];
  const q=String(document.getElementById('achievement-search')?.value||'').toLowerCase();
  const filtered=state.achievements.filter(x=>[x.nama,x.name,x.prestasi,x.achievement_name,x.tingkat].join(' ').toLowerCase().includes(q));
  const body=document.getElementById('achievement-body');if(!body)return;
  body.innerHTML=filtered.length?filtered.map(x=>`<tr><td class="font-semibold">${esc(x.nama||x.name||'—')}</td><td>${esc(x.prestasi||x.achievement_name||'—')}</td><td>${esc(x.thn||x.tahun||x.year||'—')}</td><td><span class="pill pill-gray">${esc(x.tingkat||x.level||'—')}</span></td></tr>`).join(''):'<tr><td colspan="4" class="empty">Belum ada data prestasi.</td></tr>';
  markReady(body);
}
window.renderAchievements=function(){renderAchievementsFast(state.achievements||[])};

function prefetchAchievements(){
  if(achievementsPromise)return achievementsPromise;
  const c=cachedPublic('getPrestasiList');if(c){renderAchievementsFast(rowsOf(c))}
  achievementsPromise=Promise.resolve(window.api?.('getPrestasiList',null,false)).then(data=>{const rows=rowsOf(data);state.achievements=rows;window.etosPublicCache?.write?.('getPrestasiList',null,{success:true,data:rows});return rows}).catch(()=>state.achievements||[]).finally(()=>{setTimeout(()=>{achievementsPromise=null},1200)});
  return achievementsPromise;
}
window.loadAchievements=async function(force=false){
  if(!force&&state.achievements?.length){renderAchievementsFast(state.achievements);prefetchAchievements();return}
  const c=!force?cachedPublic('getPrestasiList'):null;
  if(c){renderAchievementsFast(rowsOf(c));prefetchAchievements();return}
  if(force&&window.etosAPI?.liveCall){
    try{const r=await window.etosAPI.liveCall('getPrestasiList',null);if(!r||r.success===false)throw new Error(r?.error||'Prestasi gagal dimuat');const rows=rowsOf(r.data);window.etosPublicCache?.write?.('getPrestasiList',null,r);renderAchievementsFast(rows);return}catch(_){/* use normal path */}
  }
  const rows=await prefetchAchievements();renderAchievementsFast(rows);
};

const baseGo=window.goView;
if(typeof baseGo==='function'&&!baseGo.__v368){
  const wrapped=async function(view,force=false){
    const v=String(view||'');
    document.documentElement.classList.add('etos-navigating');
    const btn=document.querySelector(`.nav-btn[data-view="${CSS.escape(v)}"]`);btn?.classList.add('is-pending');
    const t=performance.now();
    try{return await baseGo.call(this,view,force)}finally{
      const wait=Math.max(0,150-(performance.now()-t));setTimeout(()=>{document.documentElement.classList.remove('etos-navigating');btn?.classList.remove('is-pending')},wait);
    }
  };wrapped.__v368=true;window.goView=wrapped;
}

document.querySelectorAll('.nav-btn[data-view]').forEach(btn=>{
  btn.addEventListener('pointerdown',()=>{if(!REDUCED)btn.animate?.([{transform:'scale(1)'},{transform:'scale(.975)'},{transform:'scale(1)'}],{duration:180,easing:'cubic-bezier(.22,.82,.2,1)'})},{passive:true});
});

function warmData(){
  prefetchAchievements();
  setTimeout(()=>window.api?.('getAbsensiList',null,false).catch(()=>{}),180);
  setTimeout(()=>window.api?.('getCoachingList',null,false).catch(()=>{}),360);
}
installMotion();warmModules();
if('requestIdleCallback'in window)requestIdleCallback(warmData,{timeout:650});else setTimeout(warmData,120);

window.addEventListener('etos:cache-updated',e=>{
  if(e?.detail?.name==='getPrestasiList'&&String(state?.view||'')==='achievements'){
    const c=cachedPublic('getPrestasiList');if(c)renderAchievementsFast(rowsOf(c));
  }
});
})();