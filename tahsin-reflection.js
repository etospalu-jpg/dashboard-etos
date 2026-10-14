(()=>{'use strict';
const $=id=>document.getElementById(id);
const message=(str,bad=false)=>{const el=$('message');el.textContent=str;el.className=str?'status'+(bad?' error':''):'';el.hidden=!str};
const client=window.supabase?.createClient('https://weklmapqizeldfdalbgs.supabase.co','sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'etos-readmap-auth-v1'}});
const id=new URLSearchParams(location.search).get('session')||'';
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
let active=null;
function date(v){return v?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(new Date(v+'T12:00:00+08:00')):'Tanggal belum tersedia'}
async function showSession(){
 if(!client||!uuid.test(id)){message('Tautan refleksi Tahsin tidak valid.',true);return}
 message('Memeriksa kehadiran pertemuan…');
 const {data:user,error:userError}=await client.auth.getUser();
 if(userError||!user?.user){$('login-card').hidden=false;$('reflection-card').hidden=true;message('Masuk terlebih dahulu untuk memverifikasi kehadiran.');return}
 const {data,error}=await client.rpc('my_tahsin_sessions');
 if(error){message('Gagal memeriksa kehadiran: '+error.message,true);return}
 const row=(data||[]).find(x=>x.session_id===id);
 if(!row){$('reflection-card').hidden=true;$('complete-card').hidden=true;message('Refleksi hanya untuk Awardee yang tercatat Hadir pada pertemuan ini. Periksa kembali akun atau hubungi fasilitator.',true);return}
 $('login-card').hidden=true;message('');
 if(row.reflection_submitted){$('reflection-card').hidden=true;$('complete-card').hidden=false;return}
 active=row;
 $('session-title').textContent=row.activity_name||'Tahsin Al-Qur’an';
 $('session-date').textContent=date(row.activity_date);
 $('previous-wrap').hidden=!row.previous_goal;
 $('previous').required=!!row.previous_goal;
 if(row.previous_goal)$('previous-goal').textContent='Target pertemuan sebelumnya: '+row.previous_goal;
 $('reflection-card').hidden=false;
}
$('login-form').addEventListener('submit',async e=>{
 e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;
 try{
  const username=$('login-username').value.trim().toUpperCase(),pin=$('login-pin').value.trim();
  if(!/^ETOS26-[A-F0-9]{10}$/.test(username)||! /^\d{10}$/.test(pin))throw Error('Format username atau PIN belum sesuai.');
  const {error}=await client.auth.signInWithPassword({email:username.toLowerCase()+'@readmap.etosidpalu.com',password:pin});
  if(error)throw Error('Username atau PIN tidak sesuai.');
  $('login-pin').value='';await showSession();
 }catch(e){message(e.message,true)}finally{b.disabled=false}
});
$('reflection-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!active)return;
 const button=$('submit-reflection');button.disabled=true;
 try{
  const payload={p_session:id,p_lesson:$('lesson').value.trim(),p_challenges:[...document.querySelectorAll('input[name="challenge"]:checked')].map(x=>x.value),p_confidence:Number($('confidence').value),p_practice:$('practice').value,p_goal:$('goal').value.trim(),p_previous:active.previous_goal?$('previous').value:null};
  const {error}=await client.rpc('submit_my_tahsin_reflection',payload);if(error)throw error;
  $('reflection-card').hidden=true;$('complete-card').hidden=false;message('Refleksi Tahsin berhasil disimpan.');
  window.scrollTo({top:0,behavior:'smooth'});
 }catch(e){message('Refleksi belum berhasil disimpan: '+e.message,true)}finally{button.disabled=false}
});
if(!client)message('Koneksi login gagal dimuat. Periksa jaringan.',true);else showSession().catch(e=>message(e.message,true));
})();