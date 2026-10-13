/* ETOS READMAP - awardee-owned reading and video progress. */
(()=>{'use strict';
const URL='https://weklmapqizeldfdalbgs.supabase.co';
const KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const $=id=>document.getElementById(id);
const sb=window.supabase?.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const state={user:null,awardee:null,books:[],entries:[],videos:[],player:null,activeVideo:null,intervals:[],lastTime:null,lastSample:0,saveAt:0,saving:false};
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notice=s=>{$('notice').textContent=s||''};
const on=(id,event,fn)=>$(id).addEventListener(event,fn);
const err=e=>notice(e?.message||String(e));
const dateWeek=()=>{const d=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Makassar'}));const offset=(d.getDay()+6)%7;d.setDate(d.getDate()-offset);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const currentWeek=dateWeek();
const unwrap=(value)=>{if(value.error)throw value.error;return value.data};
const show=id=>$(id).hidden=false;
const hide=id=>$(id).hidden=true;
function videoId(raw){try{const u=new URL(raw);const host=u.hostname.replace(/^www\./,'').toLowerCase();let id=null;if(['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com'].includes(host)){id=u.pathname.startsWith('/shorts/')||u.pathname.startsWith('/embed/')?u.pathname.split('/')[2]:u.searchParams.get('v')}else if(host==='youtu.be'){id=u.pathname.split('/')[1]}return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:null}catch{return null}}
function nextStatus(v){const segments=Array.isArray(v.watched_intervals)?v.watched_intervals:[];const duration=v.duration_seconds||0;const watched=segments.reduce((a,x)=>a+Math.max(0,x[1]-x[0]),0);const ratio=duration?Math.min(1,watched/duration):0;return{ratio,display:Math.round(ratio*100),status:v.status==='Selesai'||(ratio>=.9&&v.ended)?'Selesai':watched>0?'Sedang Belajar':'Belum Dimulai'}}
function merge(xs){const sorted=xs.map(x=>[Math.max(0,Number(x[0])||0),Math.max(0,Number(x[1])||0)]).filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0]);return sorted.reduce((a,x)=>{const last=a[a.length-1];if(last&&x[0]<=last[1]+.35)last[1]=Math.max(last[1],x[1]);else a.push(x);return a},[])}
function member(){if(!state.awardee)throw Error('Akun belum terhubung dengan Etoser.');return state.awardee}
async function identify(){
 const {data}=await sb.auth.getUser();state.user=data.user;
 if(!state.user){hide('workspace');show('login');return}
 try{
  const found=unwrap(await sb.from('readmap_memberships').select('awardee_id').eq('user_id',state.user.id).maybeSingle());
  if(found)state.awardee=found.awardee_id;
  else{
   const result=unwrap(await sb.rpc('readmap_claim_account'));
   state.awardee=result?.[0]?.awardee_id;
  }
  if(!state.awardee)throw Error('Akun belum terhubung dengan data Etoser.');
  hide('login');show('workspace');await loadAll();notice('');
 }catch(e){hide('workspace');show('login');err(e);await sb.auth.signOut();state.user=null}
}
async function loadAll(){
 const id=member();
 const [b,e,v]=await Promise.all([
  sb.from('readmap_books').select('*').eq('awardee_id',id).order('created_at',{ascending:false}),
  sb.from('readmap_reading_entries').select('*').eq('awardee_id',id).order('week_start',{ascending:false}),
  sb.from('readmap_videos').select('*').eq('awardee_id',id).order('created_at',{ascending:false})
 ]);
 state.books=unwrap(b)||[];state.entries=unwrap(e)||[];state.videos=unwrap(v)||[];
 render();
}
function render(){
 $('week-label').textContent='Pekan mulai Senin, '+currentWeek;
 $('entry-book').innerHTML=state.books.map(b=>'<option value="'+safe(b.id)+'">'+safe(b.title)+'</option>').join('');
 $('books-list').innerHTML=state.books.length?state.books.map(b=>'<div class="item"><strong>'+safe(b.title)+'</strong><small>'+safe(b.category)+' · '+safe(b.status)+(b.total_pages?' · '+b.total_pages+' halaman':'')+'</small><button class="secondary" data-finish="'+safe(b.id)+'">'+(b.status==='Selesai'?'Tandai Dibaca Lagi':'Tandai Selesai')+'</button></div>').join(''):'Belum ada buku.';
 $('reading-list').innerHTML=state.entries.length?state.entries.map(e=>{const b=state.books.find(x=>x.id===e.book_id);return '<div class="item"><strong>'+safe(b?.title||'Buku')+'</strong><small>'+safe(e.week_start)+' · '+e.pages_read+' halaman</small><p>'+safe(e.insight)+'</p></div>'}).join(''):'Belum ada laporan.';
 const total=state.entries.reduce((a,e)=>a+Number(e.pages_read||0),0);
 const complete=state.books.filter(b=>b.status==='Selesai').length;
 $('stats').innerHTML=[['Halaman dilaporkan',total],['Buku selesai',complete],['Video selesai',state.videos.filter(x=>x.status==='Selesai').length]].map(([k,v])=>'<div class="metric"><b>'+v+'</b><small>'+k+'</small></div>').join('');
 $('videos-list').innerHTML=state.videos.length?state.videos.map(v=>{const p=nextStatus(v);return '<div class="item"><img class="thumb" loading="lazy" src="https://i.ytimg.com/vi/'+safe(v.youtube_id)+'/hqdefault.jpg" alt="Thumbnail video"><strong>'+safe(v.title)+'</strong><small>'+safe(p.status)+' · '+p.display+'% diputar di dashboard</small><button data-play="'+safe(v.id)+'">Tonton / Lanjutkan</button></div>'}).join(''):'Belum ada video.';
}
on('send-code','submit',async e=>{e.preventDefault();if(!sb)return notice('Layanan login belum dapat dimuat.');const email=$('email').value.trim().toLowerCase();try{const x=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:location.origin+'/readmap.html'}});unwrap(x);show('verify-code');notice('Jika email valid, kode masuk telah dikirim. Periksa kotak masuk.')}catch(e){err(e)}});
on('verify-code','submit',async e=>{e.preventDefault();try{unwrap(await sb.auth.verifyOtp({email:$('email').value.trim().toLowerCase(),token:$('code').value.trim(),type:'email'}));await identify()}catch(e){err(e)}});
on('signout','click',async()=>{await flushVideo();await sb.auth.signOut();state.awardee=null;state.user=null;hide('workspace');show('login');notice('Anda telah keluar.')});
on('book-form','submit',async e=>{e.preventDefault();try{unwrap(await sb.from('readmap_books').insert({awardee_id:member(),title:$('book-title').value.trim(),author:$('book-author').value.trim()||null,category:$('book-category').value,total_pages:Number($('book-total').value)||null}));$('book-form').reset();await loadAll();notice('Buku berhasil ditambahkan.')}catch(e){err(e)}});
on('entry-mode','change',()=>{const range=$('entry-mode').value==='rentang';$('range-inputs').hidden=!range;$('amount-input').hidden=range});
on('reading-form','submit',async e=>{e.preventDefault();try{
 const mode=$('entry-mode').value,from=Number($('from-page').value),to=Number($('to-page').value);
 const pages=mode==='rentang'?to-from+1:Number($('pages-read').value);
 if(!Number.isInteger(pages)||pages<1||pages>20000||(mode==='rentang'&&(!Number.isInteger(from)||from<1||to>20000)))throw Error('Periksa jumlah halaman.');
 const bookId=$('entry-book').value;if(!bookId)throw Error('Tambahkan buku terlebih dahulu.');
 const payload={awardee_id:member(),book_id:bookId,week_start:currentWeek,input_mode:mode,from_page:mode==='rentang'?from:null,to_page:mode==='rentang'?to:null,pages_read:pages,insight:$('entry-insight').value.trim()};
 unwrap(await sb.from('readmap_reading_entries').upsert(payload,{onConflict:'awardee_id,week_start,book_id'}));
 $('entry-insight').value='';await loadAll();notice('Laporan pekanan tersimpan.');
 }catch(e){err(e)}});
$('books-list').addEventListener('click',async e=>{const id=e.target.dataset.finish;if(!id)return;const b=state.books.find(x=>x.id===id);if(!b)return;try{unwrap(await sb.from('readmap_books').update({status:b.status==='Selesai'?'Sedang Dibaca':'Selesai',updated_at:new Date().toISOString()}).eq('id',id));await loadAll()}catch(e){err(e)}});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(t=>t.classList.toggle('active',t===b));const videos=b.dataset.tab==='videos';$('videos-panel').hidden=!videos;$('books-panel').hidden=videos}));
on('video-form','submit',async e=>{e.preventDefault();try{const id=videoId($('youtube-url').value);if(!id)throw Error('Masukkan tautan video YouTube yang valid.');unwrap(await sb.from('readmap_videos').upsert({awardee_id:member(),youtube_id:id,title:$('video-title').value.trim(),thumbnail_url:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg'},{onConflict:'awardee_id,youtube_id',ignoreDuplicates:true}));$('video-form').reset();await loadAll();notice('Video ditambahkan.')}catch(e){err(e)}});
$('videos-list').addEventListener('click',async e=>{const id=e.target.dataset.play;if(!id)return;try{await openVideo(id)}catch(e){err(e)}});
function readyYoutube(){return new Promise((resolve,reject)=>{if(window.YT?.Player)return resolve();const old=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{old?.();resolve()};if(!document.querySelector('script[data-yt]')){const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.dataset.yt='1';s.onerror=()=>reject(Error('Pemutar video gagal dimuat'));document.head.appendChild(s)}})}
async function openVideo(id){
 await flushVideo();if(ticker){clearInterval(ticker);ticker=null}state.player?.destroy?.();state.player=null;state.lastTime=null;
 const v=state.videos.find(x=>x.id===id);if(!v)return;
 state.activeVideo=v;state.intervals=merge(v.watched_intervals||[]);
 show('player-card');$('player-title').textContent=v.title;$('video-insight').value=v.insight||'';$('player-status').textContent='Menyiapkan video...';
 await readyYoutube();
 state.player=new YT.Player('yt-player',{width:'100%',height:'100%',videoId:v.youtube_id,playerVars:{playsinline:1,rel:0,origin:location.origin},events:{
  onReady:ev=>{const d=Math.round(ev.target.getDuration()||0);v.duration_seconds=d||v.duration_seconds;if(v.last_position_seconds>0)ev.target.seekTo(v.last_position_seconds,true);$('player-status').textContent='Pemutar siap · Lanjutkan dari posisi tersimpan.'},
  onStateChange:ev=>{if(ev.data===YT.PlayerState.PLAYING){state.lastTime=ev.target.getCurrentTime();tickVideo()}else {state.lastTime=null;if(ticker){clearInterval(ticker);ticker=null}flushVideo().catch(err)}if(ev.data===YT.PlayerState.ENDED){v.ended=true;flushVideo().catch(err)}},
  onError:()=>{$('player-status').textContent='Video tidak dapat diputar tertanam. Progres tidak dihitung.'}
 }});
}
let ticker=null;
function tickVideo(){
 if(ticker)clearInterval(ticker);
 ticker=setInterval(()=>{
  if(!state.player||!state.activeVideo||state.player.getPlayerState?.()!==YT.PlayerState.PLAYING)return;
  const now=state.player.getCurrentTime();const previous=state.lastTime;state.lastTime=now;
  if(Number.isFinite(previous)&&Number.isFinite(now)&&now>previous&&now-previous<=2.2)state.intervals=merge([...state.intervals,[previous,now]]);
  const v=state.activeVideo;v.duration_seconds=Math.round(state.player.getDuration()||v.duration_seconds||0);
  const p=nextStatus({...v,watched_intervals:state.intervals});
  $('player-status').textContent='Tercatat '+p.display+'% · '+p.status;
  if(Date.now()-state.saveAt>12000)flushVideo().catch(err);
 },1000);
}
async function flushVideo(){
 const v=state.activeVideo;if(!v||state.saving||!state.awardee)return;
 state.saving=true;state.saveAt=Date.now();
 try{
  const p=nextStatus({...v,watched_intervals:state.intervals});
  const status=(v.ended&&p.ratio>=.9)?'Selesai':v.status==='Selesai'?'Selesai':p.status;
  const patch={watched_intervals:state.intervals,duration_seconds:v.duration_seconds||0,last_position_seconds:Math.round(state.player?.getCurrentTime?.()||v.last_position_seconds||0),status,last_watched_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  unwrap(await sb.from('readmap_videos').update(patch).eq('id',v.id).eq('awardee_id',state.awardee));
  Object.assign(v,patch);render();
 }finally{state.saving=false}
}
on('save-insight','click',async()=>{try{if(!state.activeVideo)throw Error('Pilih video dahulu');await flushVideo();const insight=$('video-insight').value.trim();unwrap(await sb.from('readmap_videos').update({insight,updated_at:new Date().toISOString()}).eq('id',state.activeVideo.id));state.activeVideo.insight=insight;notice('Pembelajaran video tersimpan.')}catch(e){err(e)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushVideo().catch(()=>{})});
window.addEventListener('pagehide',()=>{flushVideo().catch(()=>{})});
if(!sb)notice('Koneksi Supabase gagal dimuat. Periksa jaringan.');else identify().catch(err);
})();
