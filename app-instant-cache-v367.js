(function(){
'use strict';
if(window.ETOS_PUBLIC_CACHE_V367)return;window.ETOS_PUBLIC_CACHE_V367=true;
if(!window.etosAPI?.call)return;
const rawCall=window.etosAPI.call.bind(window.etosAPI);
const CACHEABLE=new Set(['getDashboardStats','getFeaturedAwardees','getAwardeeList','getAlumniList','getAkademikList','getPrestasiList','getOrganisasiList','getAwardeeProfile','getDropdownOptions','getAbsensiList']);
const PREFIX='etos-public-v367:',LEGACY='etos-public-v364:',MAX_AGE=24*60*60*1000;
function key(prefix,name,params){return prefix+name+':'+JSON.stringify(params??null)}
function parse(raw){try{const x=JSON.parse(raw);if(!x?.t||Date.now()-x.t>MAX_AGE)return null;return x}catch(_){return null}}
function read(name,params){
  let x=parse(localStorage.getItem(key(PREFIX,name,params)));if(x)return x;
  x=parse(localStorage.getItem(key(LEGACY,name,params)));if(x){write(name,params,x.value,x.t);return x}
  return null;
}
function write(name,params,value,t=Date.now()){try{localStorage.setItem(key(PREFIX,name,params),JSON.stringify({t,value}))}catch(_){}}
function clear(name,params){try{localStorage.removeItem(key(PREFIX,name,params));localStorage.removeItem(key(LEGACY,name,params))}catch(_){}}
function update(name,params,cached){
  rawCall(name,params).then(live=>{
    if(live?.success===false||live?.data==null)return;
    let changed=true;try{changed=JSON.stringify(cached?.value)!==JSON.stringify(live)}catch(_){}
    write(name,params,live);
    if(changed)window.dispatchEvent(new CustomEvent('etos:cache-updated',{detail:{name,params}}));
  }).catch(()=>{});
}
window.etosAPI.liveCall=rawCall;
window.etosPublicCache={read:(n,p)=>read(n,p)?.value||null,write:(n,p,v)=>write(n,p,v),clear};
window.etosAPI.call=async function(name,params){
  if(!CACHEABLE.has(name))return rawCall(name,params);
  const cached=read(name,params);
  if(cached){update(name,params,cached);return cached.value}
  const live=await rawCall(name,params);
  if(live?.success!==false&&live?.data!=null)write(name,params,live);
  return live;
};
})();