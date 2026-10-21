'use strict';
/* Read-only ETOS23/MurojaAku integration. No URL input is accepted. */
const session=require('./server-session');
const UPSTREAM='https://panpejzadufainlnoocw.supabase.co/functions/v1/etos23-report';
function send(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store, max-age=0');res.end(JSON.stringify(body))}
function text(v,n=180){return String(v??'').slice(0,n)}
function safeNumber(v){const n=Number(v);return Number.isFinite(n)&&n>=0?Math.trunc(n):0}
function safeDate(v){return /^\d{4}-\d{2}-\d{2}/.test(String(v||''))?String(v).slice(0,10):''}
module.exports=async function etos23(req,res){
 if(req.method!=='POST')return send(res,405,{success:false,error:'Metode tidak didukung.'});
 if(!session.originAllowed(req))return send(res,403,{success:false,error:'Permintaan tidak diizinkan.'});
 const token=session.verify(req);
 if(!token||token.role!=='superadmin'||!session.credential(req)?.server)return send(res,401,{success:false,error:'Masuk memakai PIN Superadmin untuk melihat data ETOS23.'});
 try{
  const response=await session.directFetch(UPSTREAM,{method:'GET',headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000),redirect:'error'});
  if(!response.ok)throw Error('MurojaAku HTTP '+response.status);
  const body=await response.text();
  if(body.length>350000)throw Error('Respons terlalu besar.');
  let j;try{j=JSON.parse(body)}catch{throw Error('Format JSON tidak valid.')}
  if(!j||typeof j!=='object'||j.success===false||!Array.isArray(j.peserta))throw Error('Format laporan ETOS23 tidak sesuai.');
  const peserta=j.peserta.slice(0,100).map(x=>({
   id:text(x.id,80),nama:text(x.nama_peserta,150),
   target_surah:text(x.target_surah,120),
   target_ayat_awal:x.target_ayat_awal??null,target_ayat_akhir:x.target_ayat_akhir??null,
   total_ayat_lulus:safeNumber(x.total_ayat_lulus),
   ayat_lulus_json:x.ayat_lulus_json??null
  }));
  const setoran=Array.isArray(j.setoran)?j.setoran.slice(0,200).map(x=>({
   peserta_id:text(x.peserta_id,80),tanggal:safeDate(x.tanggal||x.tanggal_setoran||x.created_at),
   surah:text(x.surah||x.nama_surah,100),catatan:text(x.catatan||x.keterangan,400),
   nilai:text(x.nilai||x.status,90)
  })):[];
  const feedback=Array.isArray(j.feedback_umum)?j.feedback_umum.slice(0,20).map(x=>({tanggal:safeDate(x.tanggal),catatan:text(x.catatan,500)})):[];
  const kehadiran=Array.isArray(j.kehadiran)?j.kehadiran.slice(0,200).map(x=>({peserta_id:text(x.peserta_id,80),tanggal:safeDate(x.tanggal_kegiatan),status:text(x.status_kehadiran,80)})):[];
  return send(res,200,{success:true,data:{source:'MurojaAku · ETOS23',room:text(j.ruang?.nama_ruang,140),participant_count:peserta.length,peserta,setoran,feedback,kehadiran,read_only:true,fetched_at:new Date().toISOString()}});
 }catch(e){
  console.warn('[etos23-report]',String(e.message).slice(0,160));
  return send(res,502,{success:false,error:'Laporan MurojaAku sedang tidak dapat dibaca. Coba perbarui beberapa saat lagi.'});
 }
};
