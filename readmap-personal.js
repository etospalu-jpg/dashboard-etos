/* READMAP awardee-only preview. Never shows private data in demo. */
(()=>{'use strict';
const $=id=>document.getElementById(id),panel=$('readmap-personal');
const nicknamePanel=$('nickname-settings'),nicknameInput=$('nickname-input'),nicknameStatus=$('nickname-status');
let officialName='Awardee',nicknameSaved='',saving=false;
const displayName=()=>nicknameSaved||officialName.split(/\s+/)[0]||'Awardee';
function renderNickname(){
 $('awardee-first-name').textContent=displayName();
 $('personal-hello').textContent='Halo, '+displayName()+'!';
 nicknameInput.value=nicknameSaved;
 nicknamePanel.hidden=false;
}
async function updateNickname(value){
 if(saving||!sb||nicknamePanel.hidden||!$('demo-banner').hidden)return;
 const next=String(value||'').replace(/\s+/g,' ').trim();
 if(next&&(next.length<2||next.length>24||!/^[\p{L}\p{N} .'-]+$/u.test(next))){
  nicknameStatus.textContent='Gunakan 2–24 karakter berupa huruf, angka, spasi, titik, apostrof, atau tanda hubung.';return;
 }
 saving=true;const token=current;
 $('nickname-save').disabled=true;$('nickname-reset').disabled=true;
 nicknameStatus.textContent='Menyimpan nama panggilan…';
 try{
  const auth=await sb.auth.getUser();
  if(!auth.data?.user)throw new Error('Sesi telah berakhir. Silakan masuk kembali.');
  const {data,error}=await sb.rpc('readmap_set_nickname',{p_nickname:next});
  if(error)throw error;
  if(current!==token||!$('demo-banner').hidden)return;
  nicknameSaved=String(data||'');
  renderNickname();
  nicknameStatus.textContent=nicknameSaved?'Nama panggilan berhasil disimpan.':'Sapaan kembali menggunakan nama awal.';
 }catch(e){if(current===token)nicknameStatus.textContent='Belum berhasil menyimpan. Periksa koneksi lalu coba lagi.'}
 finally{saving=false;$('nickname-save').disabled=false;$('nickname-reset').disabled=false}
}
nicknamePanel.addEventListener('submit',e=>{e.preventDefault();updateNickname(nicknameInput.value)});
$('nickname-reset').addEventListener('click',()=>updateNickname(''));

const sb=window.supabase?.createClient('https://weklmapqizeldfdalbgs.supabase.co','sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'etos-readmap-auth-v1'}});
let current=0;
function clear(){current++;panel.hidden=true;nicknamePanel.hidden=true;officialName='Awardee';nicknameSaved='';nicknameInput.value='';nicknameStatus.textContent='';$('awardee-first-name').textContent='Awardee';$('personal-hello').textContent='Perjalananmu di ETOS';$('personal-articles').textContent='—';$('personal-ip').textContent='—';$('personal-achievements').textContent='—'}
async function refresh(){
 const run=++current;
 panel.hidden=true;nicknamePanel.hidden=true;
 if(!sb||$('workspace').hidden||!$('demo-banner').hidden)return;
 try{
  const user=await sb.auth.getUser();
  if(run!==current||!user.data?.user)return;
  const result=await sb.rpc('awardee_self_snapshot');
  if(run!==current||result.error||!result.data?.identity||$('workspace').hidden||!$('demo-banner').hidden)return;
  const data=result.data,semesters=Array.isArray(data.semesters)?data.semesters:[],last=semesters.at(-1),summary=data.academic_summary;
  const name=String(data.identity.name||'Awardee').trim();
  officialName=name;nicknameSaved=String(data.identity.nickname||'');
  renderNickname();
  $('personal-affiliation').textContent=[data.identity.major,data.identity.campus].filter(Boolean).join(' · ')||'Profil akademik dan karya pribadimu';
  $('personal-articles').textContent=Number(data.stats?.published_articles||0).toLocaleString('id-ID');
  const raw=last?.ip??summary?.value??null;
  $('personal-ip').textContent=raw!==null&&Number.isFinite(Number(raw))?Number(raw).toFixed(2).replace('.',','):'—';
  $('personal-ip-label').textContent=last?'IP Semester '+last.semester:summary?'IPK Rekap':'IP Akademik';
  $('personal-achievements').textContent=Number(data.stats?.achievements||0).toLocaleString('id-ID');
  panel.hidden=false;
  if(location.hash==='#nickname-settings')nicknamePanel.scrollIntoView({behavior:'smooth',block:'center'});
 }catch(_){panel.hidden=true;nicknamePanel.hidden=true}
}
window.addEventListener('readmap:ready',refresh);
window.addEventListener('hashchange',()=>{if(location.hash==='#nickname-settings'&&!nicknamePanel.hidden)nicknamePanel.scrollIntoView({behavior:'smooth',block:'center'})});
if(sb)sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')clear()});
})();