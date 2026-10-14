import {createClient} from 'npm:@supabase/supabase-js@2.115.0';

const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{
 auth:{persistSession:false,autoRefreshToken:false}
});
const choices=new Set(['Makharijul huruf','Panjang dan pendek bacaan','Hukum tajwid','Kelancaran dan tartil','Lainnya']);
const practice=new Set(['Belum sempat','1 kali','2–3 kali','4 kali atau lebih']);
const reviews=new Set(['Sudah terlaksana','Sebagian terlaksana','Belum terlaksana']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function send(body:unknown,status=200){
 return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
function failure(message:string):never{throw new Error(message)}
async function sessionFor(raw:unknown){
 const code=String(raw||'').trim();
 if(!(/^[0-9a-f]{12}$/i.test(code)||uuid.test(code)))failure('Tautan Tahsin tidak valid.');
 const key=uuid.test(code)?'id':'tahsin_public_code';
 const {data,error}=await sb.from('attendance_sessions')
  .select('id,activity_name,activity_date,tahsin_public_code,target_cohort').eq(key,code.toUpperCase()).limit(1).maybeSingle();
 if(error)throw error;
 if(!data||!/tahsin/i.test(data.activity_name))failure('Sesi Tahsin tidak ditemukan.');
 return data;
}
async function participants(sessionId:string){
 const {data,error}=await sb.from('attendance_records')
 .select('awardee_id,awardees!inner(id,legacy_id,name,angkatan,status)')
 .eq('session_id',sessionId).eq('status','Hadir');
 if(error)throw error;
 return (data||[]).map((r:any)=>Array.isArray(r.awardees)?r.awardees[0]:r.awardees)
 .filter((a:any)=>a&&String(a.status).toLowerCase()==='aktif')
 .sort((a:any,b:any)=>String(a.name).localeCompare(String(b.name),'id'));
}
async function identity(session:any,body:any){
 const name=String(body.awardeeId||'').trim().toUpperCase();
 const last4=String(body.waLast4||'').trim();
 if(!/^\\d{4}$/.test(last4)||!/^AWD-[A-Z0-9-]{3,30}$/.test(name))failure('Pilih nama dan masukkan tepat 4 digit terakhir WhatsApp.');
 const {data,error}=await sb.rpc('verify_tahsin_public_identity',{
  p_reference:session.tahsin_public_code||session.id,p_legacy_id:name,p_suffix:last4
 });
 if(error)throw error;
 if(!data)failure('Nama atau 4 digit WhatsApp tidak sesuai. Pastikan kamu tercatat Hadir; verifikasi dibatasi untuk keamanan.');
 const all=await participants(session.id);
 const participant=all.find((a:any)=>a.id===data);
 if(!participant)failure('Peserta tidak terdaftar sebagai Hadir.');
 return participant;
}
async function previousGoal(session:any,id:string){
 const {data,error}=await sb.from('tahsin_weekly_reflections')
  .select('improvement_goal,session_id,attendance_sessions!inner(activity_date)')
  .eq('awardee_id',id).limit(60);
 if(error)throw error;
 const earlier=(data||[]).filter((x:any)=>{
  const d=Array.isArray(x.attendance_sessions)?x.attendance_sessions[0]:x.attendance_sessions;
  return d?.activity_date<session.activity_date;
 }).sort((a:any,b:any)=>{
  const ad=Array.isArray(a.attendance_sessions)?a.attendance_sessions[0]:a.attendance_sessions;
  const bd=Array.isArray(b.attendance_sessions)?b.attendance_sessions[0]:b.attendance_sessions;
  return String(bd?.activity_date||'').localeCompare(String(ad?.activity_date||''));
 });
 return earlier[0]?.improvement_goal||null;
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return send({success:false,error:'Metode tidak didukung'},405);
 try{
  const len=Number(req.headers.get('content-length')||0);
  if(len>12000)return send({success:false,error:'Permintaan terlalu besar'},413);
  const body=await req.json().catch(()=>({}));
  const action=String(body?.action||'form');
  if(!['form','verify','submit'].includes(action))return send({success:false,error:'Aksi tidak didukung'},400);
  const session=await sessionFor(body.reference);
  if(action==='form'){
   const roster=await participants(session.id);
   return send({success:true,data:{title:session.activity_name,date:session.activity_date,
    participants:roster.map((a:any)=>({id:a.legacy_id,name:a.name,cohort:a.angkatan})),
    code:session.tahsin_public_code}});
  }
  const who=await identity(session,body);
  const prev=await previousGoal(session,who.id);
  if(action==='verify'){
   const {data,error}=await sb.from('tahsin_weekly_reflections')
    .select('lesson,challenges,confidence,practice_frequency,improvement_goal,previous_goal_review')
    .eq('session_id',session.id).eq('awardee_id',who.id).maybeSingle();
   if(error)throw error;
   return send({success:true,data:{
    participant:{name:who.name,cohort:who.angkatan},
    title:session.activity_name,date:session.activity_date,previousGoal:prev,existing:data||null
   }});
  }
  const lesson=String(body.lesson||'').trim(),goal=String(body.goal||'').trim();
  const diff=Array.isArray(body.challenges)?body.challenges:[];
  const confidence=Number(body.confidence),frequency=String(body.practice||'');
  const review=String(body.previousReview||'').trim();
  if(lesson.length<8||lesson.length>1200||goal.length<8||goal.length>900||
   !Number.isInteger(confidence)||confidence<1||confidence>5||
   !practice.has(frequency)||diff.length>5||diff.some((x:any)=>!choices.has(String(x)))||
   (prev&&!reviews.has(review))||(!prev&&!!review))failure('Lengkapi seluruh jawaban refleksi sesuai petunjuk.');
  const {error}=await sb.from('tahsin_weekly_reflections').upsert({
   session_id:session.id,awardee_id:who.id,lesson,challenges:diff,
   confidence,practice_frequency:frequency,improvement_goal:goal,
   previous_goal_review:prev?review:null,updated_at:new Date().toISOString()
  },{onConflict:'session_id,awardee_id'});
  if(error)throw error;
  return send({success:true,data:{saved:true,name:who.name}});
 }catch(e){
  const message=e instanceof Error?e.message:'Permintaan belum berhasil.';
  // Do not reveal database internals, contact values or participant identifiers.
  const publicMessage=/^(Tautan Tahsin|Sesi Tahsin|Pilih nama|Nama atau 4 digit|Peserta tidak|Lengkapi seluruh)/.test(message)?message:'Layanan refleksi belum bisa memproses permintaan. Coba lagi nanti.';
  return send({success:false,error:publicMessage},400);
 }
});