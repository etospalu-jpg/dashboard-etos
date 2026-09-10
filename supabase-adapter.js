(function(){
'use strict';
const PROJECT_URL='https://weklmapqizeldfdalbgs.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const PUBLIC_API=PROJECT_URL+'/functions/v1/public-api';
const REFLECTION_API=PROJECT_URL+'/functions/v1/public-reflection';
const sb=window.supabase?.createClient?window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null;
window.etosSupabase=sb;
let realtimeChannel=null,realtimeTimer=null;
function signalSource(source){try{window.dispatchEvent(new CustomEvent('etos:data-source',{detail:{source}}))}catch(_){}}
function realtimeEvent(type,detail){try{window.dispatchEvent(new CustomEvent(type,{detail:detail||{}}))}catch(_){}}
function friendlyError(error){const m=String(error?.message||error||'');if(error?.name==='AbortError'||error?.name==='TimeoutError'||/aborted|abort|timeout/i.test(m))return'Koneksi data melewati batas waktu. Silakan coba lagi.';return m||'Permintaan data gagal.'}
function startRealtimeSignals(){
 if(!sb||realtimeChannel)return realtimeChannel;
 try{
  realtimeChannel=sb.channel('etos-realtime-signals')
   .on('postgres_changes',{event:'*',schema:'public',table:'realtime_signals'},payload=>{
    const row=payload?.new||payload?.old||{},entity=String(row.entity||'').trim();
    realtimeEvent('etos:realtime-change',{entity,revision:Number(row.revision)||0,changedAt:row.changed_at||null,eventType:payload?.eventType||''});
    clearTimeout(realtimeTimer);
    realtimeTimer=setTimeout(()=>{
     try{
      const active=String(document.querySelector('.view.active')?.id||'').replace(/^view-/,'');
      const safe=new Set(['dashboard','directory','alumni','academic','achievements']);
      const modalOpen=!!document.querySelector('.modal.open');
      if(!modalOpen&&safe.has(active)&&typeof window.refreshCurrent==='function')window.refreshCurrent();
     }catch(_){}
    },650);
   })
   .subscribe(status=>realtimeEvent('etos:realtime-status',{status:String(status||'')}));
 }catch(e){console.warn('[ETOS realtime]',friendlyError(e));realtimeEvent('etos:realtime-status',{status:'ERROR',error:friendlyError(e)})}
 return realtimeChannel;
}
async function fetchJson(url,options){
 try{
  options=options||{};
  options.credentials=options.credentials||'include';
  options.headers=Object.assign({'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},options.headers||{});
  const response=await fetch(url,options);let body={};
  try{body=await response.json()}catch(_){}
  if(!response.ok&&!body.error)body.error='HTTP '+response.status;
  return body;
 }catch(error){return{success:false,error:friendlyError(error)}}
}
function authorityId(x){return String(x?.legacy_id||x?.id_awardee||x?.awardee_id||x?.id||'').toUpperCase()}
function patchAwardee(x){if(!x||typeof x!=='object')return x;const A=window.ETOS_AWARDEE_AUTHORITY||{};const c=A[authorityId(x)];if(!c)return x;x.name=c.name||x.name;x.nama=c.name||x.nama;if(c.jurusan)x.jurusan=c.jurusan;const vision=Object.prototype.hasOwnProperty.call(c,'vision')?c.vision:c.motto;if(vision===null){x.motto=null;x.vision=null}else if(String(vision||'').trim()){x.motto=vision;x.vision=vision}x.profile_source=c.source||x.profile_source;return x}
function sanitizePayload(v){if(Array.isArray(v)){v.forEach(sanitizePayload);return v}if(!v||typeof v!=='object')return v;if(v.awardee)patchAwardee(v.awardee);patchAwardee(v);for(const k of ['awards','awardees','items','data'])if(v[k]&&v[k]!==v)sanitizePayload(v[k]);return v}
function sanitizeResult(r){if(r&&r.data!=null)sanitizePayload(r.data);return r}
async function publicCall(name,params){
 const live=await fetchJson(PUBLIC_API,{method:'POST',body:JSON.stringify({function:name,params:params==null?null:params})});
 if(live?.success!==false&&live?.data!=null){signalSource('supabase');return sanitizeResult(live)}
 return{success:false,error:live?.error||'Data Supabase tidak dapat dibaca saat ini.',source:'supabase'};
}
function reflectionCall(name,params){const action=name==='getPublicKajianReflectionForm'?'form':name==='verifyKajianReflectionParticipant'?'verify':'submit';const payload=Object.assign({},params||{},{action});if(name==='getPublicKajianReflectionForm')payload.formToken=params;return fetchJson(REFLECTION_API,{method:'POST',body:JSON.stringify(payload)})}
async function secureCall(name,params){const endpoint=name==='getAwardee360'?'/api/awardee360':'/api/secure';return sanitizeResult(await fetchJson(endpoint,{method:'POST',body:JSON.stringify({function:name,params:params==null?null:params})}))}
const PUBLIC_FUNCTIONS=new Set(['getDashboardStats','getFeaturedAwardees','getAwardeeList','getAlumniList','getAkademikList','getPrestasiList','getOrganisasiList','getAwardeeProfile','getDropdownOptions']);
const REFLECTION_FUNCTIONS=new Set(['getPublicKajianReflectionForm','verifyKajianReflectionParticipant','submitKajianReflection']);
async function call(name,params){if(REFLECTION_FUNCTIONS.has(name))return reflectionCall(name,params);if(PUBLIC_FUNCTIONS.has(name))return publicCall(name,params);if(name==='logoutAbsensiAdmin'||name==='logoutFacilitatorAccess')return{success:true};return secureCall(name,params)}
async function signInPin(pin){pin=String(pin||'').trim();if(!/^\d{6}$/.test(pin))throw new Error('PIN harus terdiri dari 6 digit.');const body=await fetchJson('/api/pin-login',{method:'POST',body:JSON.stringify({pin})});if(!body||body.success===false||!body.data?.session){const e=new Error(body?.error||'PIN tidak sesuai.');e.code=body?.code;e.credential_type=body?.credential_type;e.http_status=body?.http_status;throw e}return{session:body.data.session,firstSetup:false}}
async function getSession(){const body=await fetchJson('/api/pin-login',{method:'GET'});return{data:{session:body?.data?.session||null}}}
async function signOut(){await fetchJson('/api/pin-login',{method:'DELETE'});return{error:null}}
function createRunner(){let successHandler=null,failureHandler=null;const target={withSuccessHandler(handler){successHandler=handler;return proxy},withFailureHandler(handler){failureHandler=handler;return proxy}};const proxy=new Proxy(target,{get(obj,prop){if(prop in obj)return obj[prop];return function(){const args=Array.prototype.slice.call(arguments);call(String(prop),args.length?args[0]:null).then(result=>{if(successHandler)successHandler(result)}).catch(error=>{if(failureHandler)failureHandler(error);else console.error('[ETOS Supabase Adapter]',prop,error)});return proxy}}});return proxy}
window.google=window.google||{};window.google.script=window.google.script||{};Object.defineProperty(window.google.script,'run',{configurable:true,get(){return createRunner()}});
window.etosAPI={call,publicCall,secureCall,reflectionCall};
window.etosAuth={signInPin,bootstrapAdmin:async()=>null,getSession,signOut,onChange(){return null}};
if(!/^\/r\//i.test(location.pathname))startRealtimeSignals();
})();
