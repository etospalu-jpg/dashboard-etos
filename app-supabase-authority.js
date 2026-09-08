(function installSupabaseAuthority(){
  'use strict';
  if(window.__ETOS_SUPABASE_AUTHORITY)return;
  window.__ETOS_SUPABASE_AUTHORITY='v30';

  window.ETOS_AWARDEE_AUTHORITY={};
  window.ETOS_2023_AUTHORITY={};

  const PUBLIC=new Set([
    'getDashboardStats','getFeaturedAwardees','getAwardeeList','getAlumniList',
    'getAkademikList','getPrestasiList','getOrganisasiList','getAwardeeProfile','getDropdownOptions'
  ]);
  const REFLECTION=new Set([
    'getPublicKajianReflectionForm','verifyKajianReflectionParticipant','submitKajianReflection'
  ]);

  async function request(body){
    try{
      const r=await fetch('/api/public-attendance',{
        method:'POST',credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
      });
      const b=await r.json().catch(()=>({}));
      if(!r.ok||b?.success===false) return {success:false,error:b?.error||`Supabase gateway HTTP ${r.status}`};
      return b;
    }catch(e){
      return {success:false,error:e?.message||String(e)};
    }
  }

  async function publicCall(name,params){
    const r=await request({action:'public_data',function:name,params:params==null?null:params});
    if(r?.success!==false){
      try{window.dispatchEvent(new CustomEvent('etos:data-source',{detail:{source:'supabase'}}))}catch(_){}
    }
    return r;
  }

  async function reflectionCall(name,params){
    return request({action:'reflection_data',function:name,params:params==null?null:params});
  }

  if(window.etosAPI){
    const original=window.etosAPI.call?.bind(window.etosAPI);
    window.etosAPI.publicCall=publicCall;
    window.etosAPI.reflectionCall=reflectionCall;
    window.etosAPI.snapshotCall=async()=>({success:false,error:'Snapshot spreadsheet dinonaktifkan. Supabase adalah sumber data utama.'});
    window.etosAPI.call=async function(name,params){
      if(PUBLIC.has(name)) return publicCall(name,params);
      if(REFLECTION.has(name)) return reflectionCall(name,params);
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
      return {session:b.data.session,firstSetup:false};
    };
  }
})();
