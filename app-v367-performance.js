(function(){
'use strict';
if(window.ETOS_V367_PERFORMANCE)return;window.ETOS_V367_PERFORMANCE=true;

const IDP_PREFIX='etos-idp-v367:';
const IDP_MAX_AGE=7*24*60*60*1000;
const pending=new Map();
let commandPromise=null;

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function photoUrl(v){
  const s=String(v||'').trim(); if(!s)return'';
  const m=s.match(/\/file\/d\/([A-Za-z0-9_-]+)/)||s.match(/[?&]id=([A-Za-z0-9_-]+)/)||s.match(/googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/);
  return m?`https://lh3.googleusercontent.com/d/${m[1]}`:s;
}
function avatarHtml(x,eager=false){
  const name=String(x?.nama||x?.name||'Awardee'),u=photoUrl(x?.photo_url||x?.foto||x?.foto_url);
  if(!u)return esc(name.charAt(0)||'A');
  return `<img data-etos-photo="1" src="${esc(u)}" alt="${esc(name)}" loading="${eager?'eager':'lazy'}" decoding="async"${eager?' fetchpriority="high"':''} referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.remove()">`;
}
function canDev(){try{return !!window.ETOSRestore?.canDev?.()}catch(_){return false}}
function dashboardActive(){return document.getElementById('view-dashboard')?.classList.contains('active')}
function idpKey(name,params){
  const p=Object.assign({},params||{});delete p.forceRefresh;
  return IDP_PREFIX+name+':'+JSON.stringify(p);
}
function idpRead(k){
  try{const raw=localStorage.getItem(k);if(!raw)return null;const x=JSON.parse(raw);if(!x?.t||Date.now()-x.t>IDP_MAX_AGE){localStorage.removeItem(k);return null}return x.data}catch(_){return null}
}
function idpWrite(k,data){try{localStorage.setItem(k,JSON.stringify({t:Date.now(),data}))}catch(_){}}
async function idpNetwork(name,params){
  const r=await fetch('/api/idp-live',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({function:name,params:params||null})});
  const b=await r.json().catch(()=>({}));
  if(!r.ok||b.success===false)throw new Error(b.error||'IDP Palu belum dapat dibaca.');
  return b.data;
}
async function idpData(name,params,force=false){
  const k=idpKey(name,params),cached=idpRead(k),hard=!!force||!!params?.forceRefresh;
  if(cached&&!hard){
    idpNetwork(name,params).then(d=>idpWrite(k,d)).catch(()=>{});
    return cached;
  }
  try{const d=await idpNetwork(name,params);idpWrite(k,d);return d}
  catch(err){
    if(cached)return cached;
    await new Promise(r=>setTimeout(r,180));
    try{const d=await idpNetwork(name,params);idpWrite(k,d);return d}catch(_){throw err}
  }
}

const baseApi=window.api;
if(typeof baseApi==='function'){
  window.api=async function(name,params,force=false){
    if(name==='getIDPOverview'||name==='getIDPDetail')return idpData(name,params,force);
    const k=name+JSON.stringify(params||null)+(force?'!force':'');
    if(!force&&pending.has(k))return pending.get(k);
    let job;
    if(force&&window.etosAPI?.liveCall){
      job=(async()=>{
        const r=await window.etosAPI.liveCall(name,params);
        if(!r||r.success===false)throw new Error(r?.error||'Permintaan gagal');
        window.etosPublicCache?.write?.(name,params,r);
        try{if(typeof cacheSet==='function')cacheSet(name+JSON.stringify(params||null),r.data)}catch(_){}
        return r.data;
      })();
    }else job=Promise.resolve(baseApi(name,params,force));
    if(!force)pending.set(k,job);
    try{return await job}finally{if(!force)pending.delete(k)}
  };
}

const R=window.ETOSRestore;
if(R){
  const baseRApi=R.api;
  R.photoUrl=photoUrl;
  R.api=async function(name,params){
    if(name==='getIDPOverview'||name==='getIDPDetail')return idpData(name,params,!!params?.forceRefresh);
    return baseRApi(name,params);
  };
}

function setDirectoryFilters(){
  const s=document.getElementById('directory-cohort');if(!s)return;
  const current=s.value,cohorts=[...new Set((state.directory||[]).map(x=>String(x.angkatan||'').replace(/\.0$/,'')).filter(Boolean))].sort();
  s.innerHTML='<option value="">Semua angkatan</option>'+cohorts.map(c=>`<option>${esc(c)}</option>`).join('');
  if(cohorts.includes(current))s.value=current;
}
window.renderFeatured=function(items){
  const h=document.getElementById('featured-grid');if(!h)return;
  if(!items?.length){h.innerHTML='<div class="empty col-span-2">Belum ada spotlight awardee.</div>';return}
  h.innerHTML=items.slice(0,4).map(x=>`<button onclick="openAwardee('${esc(x.id||x.ID_Awardee||x.legacy_id)}')" class="text-left card-flat p-4 hover:border-[#b9cbc1] transition"><div class="flex items-center gap-3"><div class="avatar">${avatarHtml(x,true)}</div><div class="min-w-0"><div class="text-[12px] font-extrabold truncate">${esc(x.nama||x.name||'Awardee')}</div><div class="text-[10px] text-[#849189] mt-1 truncate">${esc(x.jurusan||x.kampus||'ETOS ID Palu')}</div></div><i data-lucide="arrow-up-right" class="w-4 h-4 ml-auto text-[#97a39c]"></i></div></button>`).join('');
  window.lucide?.createIcons?.();
};
window.renderDirectory=function(){
  const q=String(document.getElementById('directory-search')?.value||'').toLowerCase(),st=String(document.getElementById('directory-status')?.value||'').toLowerCase(),co=String(document.getElementById('directory-cohort')?.value||'');
  const rows=(state.directory||[]).filter(x=>{const text=[x.nama,x.name,x.kampus,x.jurusan,x.angkatan].join(' ').toLowerCase();return(!q||text.includes(q))&&(!st||String(x.status||'').toLowerCase()===st)&&(!co||String(x.angkatan||'').replace(/\.0$/,'')===co)});
  const body=document.getElementById('directory-body');if(!body)return;
  body.innerHTML=rows.length?rows.map(x=>`<tr><td><div class="flex items-center gap-3"><div class="avatar">${avatarHtml(x,false)}</div><div><div class="font-bold text-[#223028]">${esc(x.nama||x.name)}</div><div class="text-[10px] text-[#8a968f] mt-1">${esc(x.id||x.legacy_id||'')}</div></div></div></td><td><div class="font-semibold">${esc(x.kampus||'—')}</div><div class="text-[10px] text-[#849189] mt-1">${esc(x.jurusan||'Belum diisi')}</div></td><td>${esc(String(x.angkatan||'—').replace(/\.0$/,''))}</td><td><span class="pill ${String(x.status).toLowerCase()==='aktif'?'pill-green':'pill-gray'}">${esc(x.status||'—')}</span></td><td class="text-right"><button class="btn btn-ghost" onclick="openAwardee('${esc(x.id||x.legacy_id)}')">360°<i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">Data tidak ditemukan.</td></tr>';
  window.lucide?.createIcons?.();
};
window.loadDirectory=async function(force=false){
  if(state.directory?.length&&!force){setDirectoryFilters();window.renderDirectory();return}
  const data=await window.api('getAwardeeList',null,force);state.directory=Array.isArray(data)?data:(data?.items||[]);
  setDirectoryFilters();window.renderDirectory();
};
function renderAlumniFast(rows){
  const g=document.getElementById('alumni-grid');if(!g)return;
  g.innerHTML=rows.length?rows.map(x=>`<div class="card p-5"><div class="flex items-start gap-3"><div class="avatar">${avatarHtml(x,false)}</div><div class="min-w-0"><div class="font-extrabold text-[13px]">${esc(x.nama||x.name)}</div><div class="text-[10px] text-[#849189] mt-1">${esc(x.jurusan||x.kampus||'')}</div></div><span class="pill pill-gray ml-auto">Alumni</span></div><div class="mt-5 pt-4 border-t border-[#edf1ef] flex justify-between text-[11px]"><span class="text-[#849189]">Angkatan</span><b>${esc(String(x.angkatan||'—').replace(/\.0$/,''))}</b></div></div>`).join(''):'<div class="empty col-span-3">Belum ada data alumni.</div>';
}
window.loadAlumni=async function(force=false){
  if(!state.directory?.length||force){const data=await window.api('getAwardeeList',null,force);state.directory=Array.isArray(data)?data:(data?.items||[])}
  state.alumni=(state.directory||[]).filter(x=>String(x.status||'').toLowerCase()==='lulus');
  renderAlumniFast(state.alumni);
};
window.loadAcademic=async function(force=false){
  const jobs=[window.api('getAkademikList',null,force)];
  if(!state.directory?.length||force)jobs.push(window.api('getAwardeeList',null,force));
  const out=await Promise.all(jobs);state.academic=Array.isArray(out[0])?out[0]:(out[0]?.items||[]);
  if(out[1])state.directory=Array.isArray(out[1])?out[1]:(out[1]?.items||[]);
  const cohorts=[...new Set((state.directory||[]).map(x=>String(x.angkatan||'').replace(/\.0$/,'')).filter(Boolean))].sort(),s=document.getElementById('academic-cohort');
  if(s)s.innerHTML='<option value="">Semua angkatan</option>'+cohorts.map(c=>`<option>${esc(c)}</option>`).join('');
  window.renderAcademic?.();
};

async function ensureCommand(){
  if(!canDev()){document.getElementById('rest-command-center')?.remove();return}
  if(!dashboardActive())return;
  if(typeof window.loadRestoredCommandCenter!=='function'){
    if(!commandPromise)commandPromise=window.etosLoadModule?.('app-restore-command').finally(()=>{commandPromise=null});
    await commandPromise;
  }
  await window.loadRestoredCommandCenter?.(false);
}

window.loadDashboard=async function(force=false){
  if(!canDev())document.getElementById('rest-command-center')?.remove();
  const listP=window.api('getAwardeeList',null,force),academicP=window.api('getAkademikList',null,force).catch(()=>[]),featuredP=window.api('getFeaturedAwardees',null,force).catch(()=>[]);
  const list=await listP,arr=Array.isArray(list)?list:(list?.items||[]);
  state.directory=arr;
  const alumni=arr.filter(x=>String(x.status||'').toLowerCase()==='lulus'),active=arr.filter(x=>String(x.status||'').toLowerCase()!=='lulus');
  state.activeAwardees=active;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('stat-total',arr.length);set('stat-active',active.length);set('stat-alumni',alumni.length);
  Promise.all([academicP,featuredP]).then(([academic,featured])=>{
    const ac=Array.isArray(academic)?academic:(academic?.items||[]);state.academic=ac;
    const vals=ac.map(x=>Number(x.ipk)).filter(v=>Number.isFinite(v)&&v>0),avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
    set('stat-ipk',avg?avg.toFixed(2):'—');
    window.renderFeatured?.(Array.isArray(featured)?featured:(featured?.items||[]));
    window.renderDashboardCharts?.(arr,ac);
  }).catch(()=>{});
  Promise.resolve(ensureCommand()).catch(()=>{});
};

function patchIDPModule(){
  if(!window.ETOSRestore)return;
  if(typeof window.loadIDPCenter==='function'&&!window.loadIDPCenter.__v367){
    const base=window.loadIDPCenter;
    const wrapped=async function(force=false){
      try{return await base.apply(this,arguments)}
      catch(err){
        const c=idpRead(idpKey('getIDPOverview',{}));
        if(c){try{
          const body=document.getElementById('rest-idp-body'),mode=document.getElementById('rest-idp-mode'),note=document.getElementById('rest-idp-note');
          if(mode){mode.textContent='IDP Palu Tersimpan';mode.className='pill pill-green'}
          if(note)note.textContent='Menampilkan salinan terakhir yang tersimpan; sinkronisasi server akan dicoba kembali.';
          if(body&&Array.isArray(c.items))body.innerHTML=c.items.map(x=>`<tr><td class="font-semibold">${esc(x.nama||'—')}</td><td>${esc(x.angkatan||'—')}</td><td><span class="pill ${x.connected?'pill-green':'pill-gold'}">${x.connected?'Terhubung':'Belum terhubung'}</span></td><td>${x.sheetName?esc(x.sheetName):'—'}</td><td></td></tr>`).join('');
        }catch(_){}}
        if(!c)throw err;
      }
    };wrapped.__v367=true;window.loadIDPCenter=wrapped;
  }
}

function prefetch(){
  const run=()=>{
    window.api?.('getAwardeeList',null,false).catch(()=>{});
    window.api?.('getAkademikList',null,false).catch(()=>{});
    idpData('getIDPOverview',{},false).catch(()=>{});
  };
  if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:1200});else setTimeout(run,350);
}
window.addEventListener('etos:enhancements-ready',()=>{patchIDPModule();if(!canDev())document.getElementById('rest-command-center')?.remove()});
window.addEventListener('etos:cache-updated',e=>{
  const n=e?.detail?.name,view=String(state?.view||'');
  if(n==='getAwardeeList'&&view==='directory')window.loadDirectory(false);
  if(n==='getAwardeeList'&&view==='alumni')window.loadAlumni(false);
});
patchIDPModule();prefetch();
})();