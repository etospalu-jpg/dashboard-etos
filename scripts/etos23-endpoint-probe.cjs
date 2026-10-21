'use strict';
const url='https://panpejzadufainlnoocw.supabase.co/functions/v1/etos23-report';
async function probe(method){
 try{
  const r=await fetch(url,{method,headers:{Accept:'application/json',...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify({})}:{}) ,signal:AbortSignal.timeout(12000)});
  const text=await r.text();let data=null;try{data=JSON.parse(text)}catch{}
  let shape={status:r.status,type:r.headers.get('content-type'),length:text.length};
  if(data&&typeof data==='object'){
    shape.keys=Object.keys(data).slice(0,30);
    shape.dataShape=Array.isArray(data)?'array':typeof data.data;
    for(const [k,v] of Object.entries(data)){
      if(Array.isArray(v)){shape[k]={length:v.length,firstKeys:v[0]&&typeof v[0]==='object'?Object.keys(v[0]).slice(0,25):[]};}
      else if(v&&typeof v==='object')shape[k]={keys:Object.keys(v).slice(0,18)};
      else if(k==='error'||k==='message')shape[k]=String(v).slice(0,220);
    }
  }else shape.nonJsonPrefix=text.slice(0,150);
  console.log('EDGE_'+method,JSON.stringify(shape));
 }catch(e){console.log('EDGE_'+method+'_ERROR',String(e.message).slice(0,200))}
}
async function formProbe(code){
 const url='https://weklmapqizeldfdalbgs.supabase.co/functions/v1/public-reflection';
 try{
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','apikey':'sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC'},body:JSON.stringify({action:'form',formToken:code}),signal:AbortSignal.timeout(12000)});
  const d=await r.json().catch(()=>({}));
  console.log('REFLECTION_API_'+code,JSON.stringify({status:r.status,success:d.success===true,keys:Object.keys(d||{}).slice(0,10),error:d.success===false?String(d.error||d.message).slice(0,130):undefined}));
 }catch(e){console.log('REFLECTION_API_'+code+'_ERROR',String(e.message).slice(0,180))}
}
async function reflection(code){
 const url='https://dashboard.etosidpalu.com/r/'+code;
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(12000)});const t=await r.text();console.log('REFLECTION_'+code,JSON.stringify({status:r.status,html:t.includes('bootReflection'),title:t.match(/<title>(.*?)<\/title>/)?.[1],len:t.length}));
 }catch(e){console.log('REFLECTION_'+code+'_ERROR',String(e.message).slice(0,180))}
}
(async()=>{await probe('GET');await probe('POST');for(const code of ['7DD1FACC','D1C33039','AD8E9E3D']){await reflection(code);await formProbe(code)}})()
