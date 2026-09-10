(function installSupabaseAuthority(){
  'use strict';
  if(window.__ETOS_SUPABASE_AUTHORITY)return;
  window.__ETOS_SUPABASE_AUTHORITY='v36-supabase-only';

  window.ETOS_AWARDEE_AUTHORITY={};
  window.ETOS_2023_AUTHORITY={};

  const PUBLIC=new Set([
    'getDashboardStats','getFeaturedAwardees','getAwardeeList','getAlumniList',
    'getAkademikList','getPrestasiList','getOrganisasiList','getAwardeeProfile','getDropdownOptions'
  ]);
  const REFLECTION=new Set([
    'getPublicKajianReflectionForm','verifyKajianReflectionParticipant','submitKajianReflection'
  ]);
  let publicQueue=[],publicFlushScheduled=false;

  async function request(body){
    try{
      const r=await fetch('/api/public-attendance',{
        method:'POST',credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
      });
      const b=await r.json().catch(()=>({}));
      if(!r.ok||b?.success===false)return{success:false,error:b?.error||`Supabase gateway HTTP ${r.status}`};
      return b;
    }catch(e){
      return{success:false,error:e?.message||String(e)};
    }
  }

  function signalSupabase(){try{window.dispatchEvent(new CustomEvent('etos:data-source',{detail:{source:'supabase'}}))}catch(_){}}
  async function flushPublicQueue(){
    publicFlushScheduled=false;
    const batch=publicQueue.splice(0);
    if(!batch.length)return;
    if(batch.length===1){
      const x=batch[0],r=await request({action:'public_data',function:x.name,params:x.params});
      if(r?.success!==false)signalSupabase();x.resolve(r);return;
    }
    const r=await request({action:'public_batch',calls:batch.map(x=>({function:x.name,params:x.params}))});
    if(r?.success===false||!Array.isArray(r?.data)){
      const error={success:false,error:r?.error||'Batch Supabase tidak dapat dibaca saat ini.'};
      batch.forEach(x=>x.resolve(error));return;
    }
    signalSupabase();
    batch.forEach((x,i)=>x.resolve(r.data[i]||{success:false,error:'Respons batch Supabase tidak lengkap.'}));
  }

  function publicCall(name,params){
    return new Promise(resolve=>{
      publicQueue.push({name,params:params==null?null:params,resolve});
      if(!publicFlushScheduled){publicFlushScheduled=true;queueMicrotask(flushPublicQueue)}
    });
  }

  async function reflectionCall(name,params){
    return request({action:'reflection_data',function:name,params:params==null?null:params});
  }

  if(window.etosAPI){
    const original=window.etosAPI.call?.bind(window.etosAPI);
    window.etosAPI.publicCall=publicCall;
    window.etosAPI.reflectionCall=reflectionCall;
    window.etosAPI.call=async function(name,params){
      if(PUBLIC.has(name))return publicCall(name,params);
      if(REFLECTION.has(name))return reflectionCall(name,params);
      return original?original(name,params):{success:false,error:'API ETOS tidak tersedia.'};
    };
  }

  if(window.etosAuth){
    window.etosAuth.signInPin=async function(pin){
      pin=String(pin||'').trim();
      if(!/^\d{6}$/.test(pin))throw new Error('PIN harus terdiri dari 6 digit.');
      const r=await fetch('/api/pin-login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});
      const b=await r.json().catch(()=>({}));
      if(!r.ok||!b||b.success===false||!b.data?.session){
        const e=new Error(b?.error||'PIN tidak sesuai.');
        e.code=b?.code;e.credential_type=b?.credential_type;e.http_status=r.status;
        throw e;
      }
      return{session:b.data.session,firstSetup:false};
    };
  }
})();
