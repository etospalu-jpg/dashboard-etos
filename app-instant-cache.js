(function(){
'use strict';
if(window.ETOS_PUBLIC_CACHE_V364)return;window.ETOS_PUBLIC_CACHE_V364=true;
if(!window.etosAPI?.call)return;
const base=window.etosAPI.call.bind(window.etosAPI);
const CACHEABLE=new Set([
  'getDashboardStats','getFeaturedAwardees','getAwardeeList','getAlumniList','getAkademikList',
  'getPrestasiList','getOrganisasiList','getAwardeeProfile','getDropdownOptions','getAbsensiList'
]);
const PREFIX='etos-public-v364:';
const MAX_AGE=24*60*60*1000;
const refreshing=new Set();
function key(name,params){return PREFIX+name+':'+JSON.stringify(params??null)}
function read(k){
  try{
    const raw=localStorage.getItem(k);if(!raw)return null;
    const x=JSON.parse(raw);if(!x||!x.t||Date.now()-x.t>MAX_AGE){localStorage.removeItem(k);return null}
    return x;
  }catch(_){return null}
}
function write(k,value){try{localStorage.setItem(k,JSON.stringify({t:Date.now(),value}))}catch(_){}}
function same(a,b){try{return JSON.stringify(a)===JSON.stringify(b)}catch(_){return false}}
function viewsFor(name){
  if(name==='getDashboardStats'||name==='getFeaturedAwardees')return['dashboard'];
  if(name==='getAwardeeList')return['dashboard','directory'];
  if(name==='getDropdownOptions'||name==='getAwardeeProfile')return['directory'];
  if(name==='getAlumniList')return['alumni'];
  if(name==='getAkademikList')return['dashboard','academic'];
  if(name==='getPrestasiList')return['achievements'];
  if(name==='getAbsensiList')return['attendance'];
  return[];
}
function refreshVisible(name){
  let active='';try{active=String(state?.view||'')}catch(_){}
  const view=viewsFor(name).includes(active)?active:'';
  if(!view||refreshing.has(view))return;
  refreshing.add(view);
  setTimeout(async()=>{
    try{
      if(typeof state!=='undefined')state.cache={};
      if(typeof window.loadView==='function')await window.loadView(view,false);
    }catch(_){}finally{refreshing.delete(view)}
  },40);
}
window.etosAPI.call=async function(name,params){
  if(!CACHEABLE.has(name))return base(name,params);
  const k=key(name,params),cached=read(k);
  if(cached){
    base(name,params).then(live=>{
      if(live?.success!==false&&live?.data!=null){
        const changed=!same(cached.value,live);write(k,live);if(changed)refreshVisible(name);
      }
    }).catch(()=>{});
    return cached.value;
  }
  const live=await base(name,params);
  if(live?.success!==false&&live?.data!=null)write(k,live);
  return live;
};
})();