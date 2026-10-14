const PROJECT_URL='https://weklmapqizeldfdalbgs.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const ALLOWED=new Set(['form','verify','submit']);
module.exports=async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({success:false,error:'Metode tidak didukung.'});
 try{
  const p=req.body&&typeof req.body==='object'?req.body:{};
  const action=String(p.action||'form');
  if(!ALLOWED.has(action))return res.status(400).json({success:false,error:'Aksi tidak didukung.'});
  if(JSON.stringify(p).length>12000)return res.status(413).json({success:false,error:'Formulir terlalu panjang.'});
  const response=await fetch(PROJECT_URL+'/functions/v1/public-tahsin',{
   method:'POST',
   headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},
   body:JSON.stringify(p)
  });
  const parsed=await response.json().catch(()=>({success:false,error:'Respons layanan tidak valid.'}));
  if(!response.ok||parsed?.success===false){
   return res.status(400).json({success:false,error:String(parsed?.error||'Permintaan tidak berhasil.').slice(0,240)});
  }
  return res.status(200).json(parsed);
 }catch{
  return res.status(503).json({success:false,error:'Layanan refleksi sedang tidak tersedia. Coba beberapa saat lagi.'});
 }
};