/* READMAP awardee-only preview. Never shows private data in demo. */
(()=>{'use strict';
const $=id=>document.getElementById(id),panel=$('readmap-personal');
const sb=window.supabase?.createClient('https://weklmapqizeldfdalbgs.supabase.co','sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'etos-readmap-auth-v1'}});
let current=0;
function clear(){current++;panel.hidden=true;$('personal-hello').textContent='Perjalananmu di ETOS';$('personal-articles').textContent='—';$('personal-ip').textContent='—';$('personal-achievements').textContent='—'}
async function refresh(){
 const run=++current;
 panel.hidden=true;
 if(!sb||$('workspace').hidden||!$('demo-banner').hidden)return;
 try{
  const user=await sb.auth.getUser();
  if(run!==current||!user.data?.user)return;
  const result=await sb.rpc('awardee_self_snapshot');
  if(run!==current||result.error||!result.data?.identity||$('workspace').hidden||!$('demo-banner').hidden)return;
  const data=result.data,semesters=Array.isArray(data.semesters)?data.semesters:[],last=semesters.at(-1),summary=data.academic_summary;
  const name=String(data.identity.name||'Awardee').trim();
  $('awardee-first-name').textContent=name.split(/\s+/)[0]||'Awardee';
  $('personal-hello').textContent='Halo, '+(name.split(/\s+/)[0]||'Awardee')+'!';
  $('personal-affiliation').textContent=[data.identity.major,data.identity.campus].filter(Boolean).join(' · ')||'Profil akademik dan karya pribadimu';
  $('personal-articles').textContent=Number(data.stats?.published_articles||0).toLocaleString('id-ID');
  const raw=last?.ip??summary?.value??null;
  $('personal-ip').textContent=raw!==null&&Number.isFinite(Number(raw))?Number(raw).toFixed(2).replace('.',','):'—';
  $('personal-ip-label').textContent=last?'IP Semester '+last.semester:summary?'IPK Rekap':'IP Akademik';
  $('personal-achievements').textContent=Number(data.stats?.achievements||0).toLocaleString('id-ID');
  panel.hidden=false;
 }catch(_){panel.hidden=true}
}
window.addEventListener('readmap:ready',refresh);
if(sb)sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')clear()});
})();