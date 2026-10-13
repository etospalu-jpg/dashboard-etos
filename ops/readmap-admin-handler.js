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
 return createClient(session.PROJECT_URL,key,{auth:{autoRefreshToken:false,persistSession:false}});
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
 try{
  const db=admin(),data=await roster(db);
  if(String(req.body?.params?.action||'')==='list'){
   return respond(res,200,{total:data.awardees.length,active:data.activeCount,
    members:data.awardees.map(a=>({name:a.name,angkatan:a.angkatan||'',username:data.mapped.get(a.id)?.username||null,provisioned:data.mapped.has(a.id)}))});
  }
  const action=String(req.body?.params?.action||'');
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
 }catch(e){console.error('[READMAP provision]',e?.code||e?.name||'error');return respond(res,500,{error:'Pengelolaan akun belum siap. Pastikan migration dan Supabase Auth tersedia.'});}
};
