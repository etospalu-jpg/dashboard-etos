'use strict';
// READMAP private account provisioning. Requires the existing ETOS superadmin PIN session.
const crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const session=require('../server-session');
function respond(res,status,data){
 res.statusCode=status;
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store, no-cache, max-age=0');
 res.setHeader('Pragma','no-cache');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.end(JSON.stringify(data));
}
function admin(){
 const key=session.secret();
 if(!['secret','legacy'].includes(session.kind(key)))throw Error('Kunci server Supabase tidak siap.');
 return createClient(session.PROJECT_URL,key,{auth:{autoRefreshToken:false,persistSession:false},global:{fetch:session.proxyFetch}});
}
function check(result){if(result.error)throw result.error;return result.data}
function randUsername(){return 'ETOS26-'+crypto.randomBytes(5).toString('hex').toUpperCase()}
function randPin(){return String(crypto.randomInt(1000000000,10000000000))}
function authEmail(name){return name.toLowerCase()+'@readmap.etosidpalu.com'}
async function roster(db){
 const awardees=check(await db.from('awardees').select('id,name,angkatan,status').ilike('status','aktif').order('name'));
 const members=check(await db.from('readmap_memberships').select('user_id,awardee_id,username'));
 const mapped=new Map((members||[]).map(x=>[x.awardee_id,x]));
 return {awardees:awardees||[],members:members||[],mapped,activeCount:(awardees||[]).filter(x=>mapped.has(x.id)).length};
}
async function createAccount(db,a){
 for(let retries=0;retries<4;retries++){
  const username=randUsername(),pin=randPin();
  const {data,error}=await db.auth.admin.createUser({
   email:authEmail(username),password:pin,email_confirm:true,
   app_metadata:{readmap_member:true},
   user_metadata:{full_name:a.name}
  });
  if(error){if(/already registered|already exists/i.test(error.message||''))continue;throw error}
  if(!data?.user?.id)throw Error('Supabase tidak mengembalikan ID pengguna.');
  try{
   check(await db.from('readmap_memberships').insert({user_id:data.user.id,awardee_id:a.id,username}));
   return {name:a.name,angkatan:a.angkatan||'',username,pin};
  }catch(err){
   await db.auth.admin.deleteUser(data.user.id).catch(()=>{});
   throw err;
  }
 }
 throw Error('Gagal menghasilkan username unik.');
}
module.exports=async function handler(req,res){
 if(req.method!=='POST')return respond(res,405,{error:'Metode tidak tersedia'});
 if(!session.verify(req)||!session.originAllowed(req))return respond(res,401,{error:'Akses Superadmin diperlukan'});
 // Initialize the existing verified PIN cookie request-context. All Supabase
 // admin calls must travel through the established server-data-proxy, never
 // directly with the Vercel key (Supabase returns HTTP 401 on direct access).
 const credential=session.credential(req);
 if(!credential?.server)return respond(res,401,{error:'Sesi Superadmin tidak valid.'});
 try{
  const db=admin(),data=await roster(db);
  if(String(req.body?.params?.action||'')==='list'){
   return respond(res,200,{total:data.awardees.length,active:data.activeCount,
    members:data.awardees.map(a=>({name:a.name,angkatan:a.angkatan||'',username:data.mapped.get(a.id)?.username||null,provisioned:data.mapped.has(a.id)}))});
  }
  const action=String(req.body?.params?.action||'');
  if(action==='overview'){
   const [br,rr,vr]=await Promise.all([
    db.from('readmap_books').select('awardee_id,id,category,status'),
    db.from('readmap_reading_entries').select('awardee_id,week_start,pages_read,book_id'),
    db.from('readmap_videos').select('awardee_id,status,duration_seconds,watched_intervals')
   ]);
   const books=check(br)||[],entries=check(rr)||[],videos=check(vr)||[];
   const categories={};const map=new Map(books.map(x=>[x.id,x]));
   const weekly={},perAwardee={};
   function row(id){return perAwardee[id]||(perAwardee[id]={pages:0,booksFinished:0,videosFinished:0,reportedWeeks:new Set(),lastWeek:null})}
   for(const book of books){if(book.status==='Selesai')row(book.awardee_id).booksFinished++;}
   for(const entry of entries){
    const x=row(entry.awardee_id);x.pages+=Number(entry.pages_read||0);
    x.reportedWeeks.add(entry.week_start);if(!x.lastWeek||entry.week_start>x.lastWeek)x.lastWeek=entry.week_start;
    weekly[entry.week_start]=(weekly[entry.week_start]||0)+Number(entry.pages_read||0);
    const category=map.get(entry.book_id)?.category||'Lainnya';
    categories[category]=(categories[category]||0)+Number(entry.pages_read||0);
   }
   for(const video of videos){if(video.status==='Selesai')row(video.awardee_id).videosFinished++;}
   const members=data.awardees.map(a=>{const x=row(a.id);return {name:a.name,angkatan:a.angkatan||'',username:data.mapped.get(a.id)?.username||'',pages:x.pages,booksFinished:x.booksFinished,videosFinished:x.videosFinished,weeks:x.reportedWeeks.size,lastWeek:x.lastWeek}});
   return respond(res,200,{totals:{awardees:data.awardees.length,members:data.activeCount,books:books.length,booksFinished:books.filter(b=>b.status==='Selesai').length,pages:entries.reduce((n,e)=>n+Number(e.pages_read||0),0),readingReports:entries.length,videos:videos.length,videosFinished:videos.filter(v=>v.status==='Selesai').length},weekly,categories,members});
  }
  if(action==='provision'){
   const pending=data.awardees.filter(a=>!data.mapped.has(a.id)).slice(0,5);
   const issued=[],errors=[];
   for(const a of pending){
    try{issued.push(await createAccount(db,a))}
    catch(e){errors.push({name:a.name,message:'Gagal membuat akun. Periksa log server tanpa mencatat PIN.'});}
   }
   return respond(res,200,{issued,errors,remaining:Math.max(0,data.awardees.length-data.activeCount-issued.length)});
  }
  if(action==='reset'){
   const username=String(req.body?.params?.username||'').toUpperCase();
   if(!/^ETOS26-[A-F0-9]{10}$/.test(username))return respond(res,400,{error:'Username tidak valid.'});
   const m=data.members.find(x=>x.username===username);
   if(!m)return respond(res,404,{error:'Akun tidak ditemukan.'});
   const a=data.awardees.find(x=>x.id===m.awardee_id);
   if(!a)return respond(res,403,{error:'Akun bukan milik awardee aktif.'});
   const pin=randPin();check(await db.auth.admin.updateUserById(m.user_id,{password:pin}));
   return respond(res,200,{name:a.name,angkatan:a.angkatan||'',username,pin});
  }
  return respond(res,400,{error:'Aksi tidak dikenal.'});
 }catch(e){console.error('[READMAP admin]',{code:String(e?.code||'unknown').slice(0,60),status:Number(e?.status||0),name:String(e?.name||'Error').slice(0,60)});return respond(res,500,{error:'Pengelolaan akun belum siap. Pastikan migration dan Supabase Auth tersedia.'});}
};
