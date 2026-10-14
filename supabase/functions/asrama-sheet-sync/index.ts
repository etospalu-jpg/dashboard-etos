import {createClient} from 'npm:@supabase/supabase-js@2.115.0';

const project=Deno.env.get('SUPABASE_URL')||'';
const adminKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(project,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
const SHEET='1GlzHEfjY0QDZNs7lntoUEjoANqiRN5JYRVlG-Em0aVA';
function response(status:number,content:Record<string,unknown>){
 return new Response(JSON.stringify(content),{status,headers:{
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
 }});
}
async function sha256(text:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
function equal(a:string,b:string){
 if(a.length!==b.length)return false;
 let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
 return mismatch===0;
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return response(405,{success:false,error:'Metode tidak didukung'});
 try{
  const length=Number(req.headers.get('content-length')||'0');
  if(length>72000)return response(413,{success:false,error:'Payload absensi terlalu besar'});
  const raw=req.headers.get('x-etos-asrama-key')||'';
  if(!/^[a-f0-9]{64}$/.test(raw))return response(401,{success:false,error:'Akses sinkronisasi tidak valid'});
  const {data:config,error:configError}=await db.from('asrama_sync_settings')
    .select('key_hash,spreadsheet_id').eq('integration_id','asrama_2026').single();
  if(configError||!config?.key_hash)return response(503,{success:false,error:'Integrasi belum diaktifkan Superadmin'});
  if(!equal(await sha256(raw),config.key_hash))return response(401,{success:false,error:'Kunci sinkronisasi tidak sesuai'});
  const data=await req.json().catch(()=>null);
  if(!data||data.sourceSpreadsheetId!==SHEET||config.spreadsheet_id!==SHEET||!Array.isArray(data.events)||data.events.length<60||data.events.length>100){
   return response(400,{success:false,error:'Snapshot dari sumber spreadsheet tidak lengkap'});
  }
  const {data:result,error}=await db.rpc('apply_asrama_sheet_snapshot',{p_sheet:SHEET,p_events:data.events});
  if(error){console.error('asrama-sync rejected:',error.code);return response(422,{success:false,error:'Data spreadsheet belum sesuai format. Periksa ID agenda, nama, tanggal, atau status.'})}
  await db.from('asrama_sync_settings').update({last_connector_at:new Date().toISOString()})
   .eq('integration_id','asrama_2026');
  return response(200,{success:true,data:result});
 }catch(error){
  console.error('asrama-sync request failed:',error instanceof Error?error.message:'unknown');
  return response(500,{success:false,error:'Sinkronisasi belum berhasil. Coba kembali.'});
 }
});