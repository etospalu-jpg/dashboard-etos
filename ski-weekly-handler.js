'use strict';
const {createClient}=require('@supabase/supabase-js');
const session=require('./server-session');
const SOURCE='https://datastudio.google.com/u/0/reporting/978106c1-dc1a-4edc-9a78-219fe6f4ae73/page/p_93dsqdpx7d';
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.status(405).end(JSON.stringify({ok:false,error:'Method not allowed'}));return}
 const expected=String(process.env.CRON_SECRET||''),auth=String(req.headers.authorization||'');
 if(!expected||auth!=='Bearer '+expected){res.status(401).end(JSON.stringify({ok:false,error:'Not authorized'}));return}
 let status=null,state='blocked',summary='Sumber belum bisa dibaca sebagai data prestasi terstruktur.';
 try{
   const response=await fetch(SOURCE,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(8500),headers:{Accept:'text/html,application/xhtml+xml'}});
   status=response.status;
   if(status>=300&&status<400)summary='Looker Studio mengalihkan permintaan. Data prestasi membutuhkan pemeriksaan akses atau login.';
   else if(response.ok){state='source_unverified';summary='Halaman Looker Studio merespons, tetapi tidak tersedia dataset/API prestasi resmi yang bisa disinkronisasi. Tidak ada angka yang diimpor.'}
   else summary='Looker Studio menolak atau tidak melayani akses otomatis (HTTP '+status+'). Tidak ada data prestasi yang diimpor.';
 }catch(e){summary='Sumber Looker Studio tidak dapat dijangkau: '+String(e?.name||'koneksi terputus')+'. Tidak ada data yang diimpor.'}
 try{
   // A Vercel Cron request is authenticated by CRON_SECRET above.
   // Create an ephemeral, locally signed operational context so that the existing
   // ETOS Edge proxy performs its normal session check before server-side writes.
   const ephemeral=session.setCookie({getHeader:()=>null,setHeader:()=>{}});
   const credential=session.credential({headers:{cookie:'etos_session='+encodeURIComponent(ephemeral)}});
   if(!credential?.server)throw new Error('Cron session failed');
   const supabase=createClient(session.PROJECT_URL,session.PUBLISHABLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:session.proxyFetch,headers:{'x-etos-proxy':'1'}}
   });
   const result=await supabase.from('ski_weekly_checks').insert({source_url:SOURCE,access_state:state,http_status:status,summary}).select('id').single();
   if(result.error)throw result.error;
   res.status(200).end(JSON.stringify({ok:true,checked:true,access_state:state,source_verified:false,achievements_imported:0}));
 }catch(e){console.error('[ski-weekly-check]',e?.message||e);res.status(503).end(JSON.stringify({ok:false,error:'Pengecekan selesai tetapi catatan gagal disimpan.'}))}
};