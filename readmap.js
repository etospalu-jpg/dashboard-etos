/* ETOS READMAP - awardee-owned reading and video progress. */
(()=>{'use strict';
const URL='https://weklmapqizeldfdalbgs.supabase.co';
const KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const $=id=>document.getElementById(id);
const sb=window.supabase?.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'etos-readmap-auth-v1'}});
const state={user:null,awardee:null,books:[],entries:[],videos:[],player:null,activeVideo:null,intervals:[],lastTime:null,lastSample:0,saveAt:0,saving:false,demo:false,coverUrls:{},coverPreviewUrl:null};

function demoPersist(){if(state.demo)window.READMAP_DEMO?.save(state)}
function isDemo(){return state.demo}
function newId(){return (window.crypto?.randomUUID?.()||('demo-'+Date.now()+'-'+Math.random().toString(36).slice(2)))}
function coverUrl(book){return state.coverUrls[book.id]||(state.demo?book.cover_path:null)||''}
function clearCoverPreview(){if(state.coverPreviewUrl){URL.revokeObjectURL(state.coverPreviewUrl);state.coverPreviewUrl=null}hide('book-cover-preview');$('book-cover-preview').removeAttribute('src');$('cover-placeholder').hidden=false;}
async function refreshCovers(){
 state.coverUrls={};
 for(const b of state.books){
  if(!b.cover_path)continue;
  if(isDemo()){state.coverUrls[b.id]=b.cover_path;continue}
  if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png)$/i.test(b.cover_path))continue;
  const {data,error}=await sb.storage.from('readmap-book-covers').createSignedUrl(b.cover_path,3600);
  if(!error&&data?.signedUrl)state.coverUrls[b.id]=data.signedUrl;
 }
}
async function compressedCover(file){
 if(!file)return null;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Sampul harus berupa JPG, PNG, atau WebP.');
 if(file.size>5*1024*1024)throw Error('Ukuran sampul maksimal 5 MB.');
 const img=await createImageBitmap(file);
 const scale=Math.min(1,760/img.width,1050/img.height);
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Gambar tidak dapat diproses di perangkat ini.');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);img.close?.();
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(Error('Gagal mengolah foto sampul.')),'image/webp',0.82));
 return blob;
}
async function uploadCover(file){
 const blob=await compressedCover(file);if(!blob)return null;
 if(isDemo()){return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Foto tidak dapat dibaca.'));reader.readAsDataURL(blob)})}
 if(!state.user?.id)throw Error('Sesi login belum siap.');
 const path=state.user.id+'/'+newId()+'.webp';
 const {error}=await sb.storage.from('readmap-book-covers').upload(path,blob,{contentType:'image/webp',upsert:false,cacheControl:'3600'});
 if(error)throw new Error('Unggah sampul gagal: '+error.message);
 return path;
}
async function deleteStoredCover(path){
 if(!path||isDemo()||!state.user?.id||!path.startsWith(state.user.id+'/'))return;
 const {error}=await sb.storage.from('readmap-book-covers').remove([path]);
 if(error)console.warn('[READMAP] gagal membersihkan foto sampul');
}
function enterDemo(){
 const fixture=window.READMAP_DEMO?.load(currentWeek);
 if(!fixture){notice('Mode Demo belum tersedia. Silakan muat ulang halaman.');return}
 state.demo=true;state.user=null;state.awardee='demo';state.books=fixture.books;state.entries=fixture.entries;state.videos=fixture.videos;
 hide('login');show('workspace');show('demo-banner');refreshCovers().then(()=>{render();notice('')}).catch(err);
}
function exitDemo(){
 if(ticker){clearInterval(ticker);ticker=null}
 state.player?.destroy?.();state.player=null;state.activeVideo=null;state.demo=false;state.awardee=null;state.books=[];state.entries=[];state.videos=[];state.coverUrls={};
 hide('demo-banner');hide('workspace');show('login');hide('player-card');notice('');
}
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notice=s=>{const el=$('notice');el.textContent=s||'';el.hidden=!s;if(s)el.scrollIntoView({behavior:'smooth',block:'nearest'});};
const on=(id,event,fn)=>$(id).addEventListener(event,fn);
const err=e=>notice(e?.message||String(e));
const dateWeek=()=>{const d=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Makassar'}));const offset=(d.getDay()+6)%7;d.setDate(d.getDate()-offset);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const currentWeek=dateWeek();
const unwrap=(value)=>{if(value.error)throw value.error;return value.data};
const show=id=>$(id).hidden=false;
const hide=id=>$(id).hidden=true;
function videoId(raw){try{let text=String(raw||'').trim();if(!/^https?:\/\//i.test(text))text='https://'+text;const u=new URL(text);const host=u.hostname.toLowerCase().replace(/^www\./,'');let id=null;if(['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com'].includes(host)){const p=u.pathname.split('/').filter(Boolean);id=['shorts','embed','live','v'].includes(p[0])?p[1]:u.searchParams.get('v')}else if(host==='youtu.be'){id=u.pathname.split('/').filter(Boolean)[0]}return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:null}catch{return null}}
const imageUrl=id=>'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';
const thumbnailFallback=(img,id)=>{if(!img)return;img.onerror=()=>{img.onerror=null;img.src='https://i.ytimg.com/vi/'+id+'/mqdefault.jpg';};};
function emptyState(symbol,title,desc){return '<div class="empty-state"><span class="empty-icon">'+symbol+'</span><strong>'+safe(title)+'</strong><p>'+safe(desc)+'</p></div>'}
function nextStatus(v){const segments=Array.isArray(v.watched_intervals)?v.watched_intervals:[];const duration=v.duration_seconds||0;const watched=segments.reduce((a,x)=>a+Math.max(0,x[1]-x[0]),0);const ratio=duration?Math.min(1,watched/duration):0;return{ratio,display:Math.round(ratio*100),status:v.status==='Selesai'||(ratio>=.9&&v.ended)?'Selesai':watched>0?'Sedang Belajar':'Belum Dimulai'}}
function merge(xs){const sorted=xs.map(x=>[Math.max(0,Number(x[0])||0),Math.max(0,Number(x[1])||0)]).filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0]);return sorted.reduce((a,x)=>{const last=a[a.length-1];if(last&&x[0]<=last[1]+.35)last[1]=Math.max(last[1],x[1]);else a.push(x);return a},[])}
function member(){if(!state.awardee)throw Error('Akun belum terhubung dengan Etoser.');return state.awardee}
async function identify(){
 const {data}=await sb.auth.getUser();state.user=data.user;
 if(!state.user){hide('workspace');show('login');return}
 try{
  const found=unwrap(await sb.from('readmap_memberships').select('awardee_id').eq('user_id',state.user.id).maybeSingle());
  state.awardee=found?.awardee_id||null;
  if(!state.awardee)throw Error('Akun belum terhubung dengan data Etoser.');
  hide('login');show('workspace');await loadAll();notice('');
 }catch(e){hide('workspace');show('login');err(e);await sb.auth.signOut();state.user=null}
}
async function loadAll(){
 const id=member();
 if(isDemo()){await refreshCovers();render();return}
 const [b,e,v]=await Promise.all([
  sb.from('readmap_books').select('*').eq('awardee_id',id).order('created_at',{ascending:false}),
  sb.from('readmap_reading_entries').select('*').eq('awardee_id',id).order('week_start',{ascending:false}),
  sb.from('readmap_videos').select('*').eq('awardee_id',id).order('created_at',{ascending:false})
 ]);
 state.books=unwrap(b)||[];state.entries=unwrap(e)||[];state.videos=unwrap(v)||[];
 await refreshCovers();render();
}
function render(){
 $('week-label').textContent='Pekan mulai Senin, '+currentWeek; $('week-chip').textContent='Pekan '+currentWeek.slice(8)+'/'+currentWeek.slice(5,7);
 $('entry-book').innerHTML=state.books.map(b=>'<option value="'+safe(b.id)+'">'+safe(b.title)+'</option>').join('');
 $('books-list').innerHTML=state.books.length?state.books.map(b=>{
 const url=coverUrl(b);const img=url?'<img loading="lazy" src="'+safe(url)+'" alt="Sampul '+safe(b.title)+'">':'';
 return '<article class="item book-item"><div class="book-art"><span class="book-placeholder">📖</span>'+img+'</div><div class="book-detail"><strong>'+safe(b.title)+'</strong><small>'+safe(b.author||'Penulis tidak dicantumkan')+'</small><span class="book-label">'+safe(b.category)+'</span><small>'+safe(b.status)+(b.total_pages?' · '+b.total_pages+' halaman':'')+'</small><div class="card-actions"><button class="secondary" data-finish="'+safe(b.id)+'">'+(b.status==='Selesai'?'Baca Lagi':'Tandai Selesai')+'</button><button class="delete-button" data-delete-book="'+safe(b.id)+'">Hapus</button></div></div></article>';
 }).join(''):emptyState('📚','Rak bukumu masih kosong','Tambahkan buku pertama dan unggah fotonya, supaya perjalanan bacamu makin hidup.');
 $('books-list').querySelectorAll('.book-art img').forEach(img=>{img.addEventListener('error',()=>img.remove(),{once:true})});
 $('reading-list').innerHTML=state.entries.length?state.entries.map(e=>{const b=state.books.find(x=>x.id===e.book_id);return '<div class="item"><strong>'+safe(b?.title||'Buku')+'</strong><small>'+safe(e.week_start)+' · '+e.pages_read+' halaman</small><p>'+safe(e.insight)+'</p></div>'}).join('') :emptyState('✍️','Belum ada catatan pekanan','Mulai catat satu hal menarik dari bacaanmu pekan ini.');
 const total=state.entries.reduce((a,e)=>a+Number(e.pages_read||0),0);
 const complete=state.books.filter(b=>b.status==='Selesai').length;
 $('stats').innerHTML=[['Halaman dilaporkan',total],['Buku selesai',complete],['Video selesai',state.videos.filter(x=>x.status==='Selesai').length]].map(([k,v])=>'<div class="metric"><b>'+v+'</b><small>'+k+'</small></div>').join('');
 const weekly=new Map();
 for(let i=7;i>=0;i--){
  const d=new Date(currentWeek+'T12:00:00+08:00');
  d.setUTCDate(d.getUTCDate()-7*i);
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  weekly.set(date,0);
 }
 state.entries.forEach(e=>{if(weekly.has(e.week_start))weekly.set(e.week_start,weekly.get(e.week_start)+Number(e.pages_read||0))});
 const highs=Math.max(1,...weekly.values());
 $('reading-chart').innerHTML=[...weekly].map(([k,v])=>'<div class="chart-week" title="'+safe(k)+' · '+v+' halaman"><span class="chart-value">'+v+'</span><div class="chart-track"><div class="chart-bar" style="height:'+Math.max(3,Math.round(100*v/highs))+'%"></div></div><small>'+safe(k.slice(5))+'</small></div>').join('');
 const categories=new Map();
 state.entries.forEach(e=>{const b=state.books.find(x=>x.id===e.book_id);if(b)categories.set(b.category,(categories.get(b.category)||0)+Number(e.pages_read||0))});
 $('category-chart').innerHTML=categories.size?[...categories].sort((a,b)=>b[1]-a[1]).map(([cat,n])=>'<div class="cat-row"><span>'+safe(cat)+'</span><div><div style="width:'+Math.round(100*n/Math.max(1,...categories.values()))+'%"></div></div><strong>'+n+' hlm</strong></div>').join('') :'<p class="empty-state">Kategori bacaan favoritmu akan terlihat setelah kamu mengisi laporan.</p>';
 $('videos-list').innerHTML=state.videos.length?state.videos.map(v=>{const p=nextStatus(v);return '<div class="item video-card"><img class="thumb" loading="lazy" src="'+imageUrl(v.youtube_id)+'" alt="Thumbnail YouTube: '+safe(v.title)+'" referrerpolicy="no-referrer"><div class="video-card-content"><strong>'+safe(v.title)+'</strong><small>'+safe(p.status)+' · '+p.display+'% diputar di READMAP</small><div class="video-progress" aria-label="Progres '+p.display+' persen"><i style="width:'+p.display+'%"></i></div><button data-play="'+safe(v.id)+'">▶ '+(p.display?'Lanjutkan menonton':'Mulai menonton')+'</button><button class="secondary" data-delete-video="'+safe(v.id)+'" style="margin-left:6px" title="Hapus video dari koleksi">Hapus</button></div></div>'}).join(''):emptyState('▶','Playlist belajarmu masih kosong','Tempel link YouTube favorit, thumbnail asli akan muncul otomatis di sini.');
}
on('enter-demo','click',enterDemo);
on('leave-demo','click',exitDemo);
on('reset-demo','click',async()=>{if(!confirm('Ulangi Mode Demo dari data contoh awal? Semua perubahan demo di browser ini akan direset.'))return;const fixture=window.READMAP_DEMO.reset(currentWeek);Object.assign(state,{books:fixture.books,entries:fixture.entries,videos:fixture.videos});await refreshCovers();render();notice('Mode Demo kembali ke 5 buku dan 5 video contoh.');});
on('book-cover','change',()=>{clearCoverPreview();const file=$('book-cover').files?.[0];if(!file)return;if(!file.type.startsWith('image/'))return notice('Pilih file gambar JPG, PNG, atau WebP.');state.coverPreviewUrl=URL.createObjectURL(file);$('book-cover-preview').src=state.coverPreviewUrl;show('book-cover-preview');$('cover-placeholder').hidden=true;notice('');});
on('member-login','submit',async e=>{e.preventDefault();if(!sb)return notice('Layanan login belum dapat dimuat.');const raw=$('username').value.trim().toUpperCase();const pin=$('pin').value.trim();if(!/^ETOS26-[A-F0-9]{10}$/.test(raw)||!/^\d{10}$/.test(pin))return notice('Periksa username dan PIN pribadi Anda.');const button=e.target.querySelector('button[type=submit]');button.disabled=true;try{const email=raw.toLowerCase()+'@readmap.etosidpalu.com';unwrap(await sb.auth.signInWithPassword({email,password:pin}));$('pin').value='';await identify()}catch(error){notice('Username atau PIN tidak sesuai. Hubungi pengelola jika memerlukan reset.')}finally{button.disabled=false}});
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

function selectTab(tab){const isVideo=tab==='videos';document.querySelectorAll('[data-tab]').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));$('videos-panel').hidden=!isVideo;$('books-panel').hidden=isVideo}
function jumpTo(tab,target){selectTab(tab);requestAnimationFrame(()=>$((target|| (tab==='videos'?'video-add-card':'reading-entry-card')))?.scrollIntoView({behavior:'smooth',block:'start'}));}
on('hero-book','click',()=>jumpTo('books','reading-entry-card'));
on('hero-video','click',()=>jumpTo('videos','video-add-card'));
on('quick-book','click',()=>jumpTo('books',state.books.length?'reading-entry-card':'book-add-card'));
on('quick-video','click',()=>jumpTo('videos','video-add-card'));
on('youtube-url','input',()=>{
 const id=videoId($('youtube-url').value);
 if(!id){hide('video-preview');return}
 const img=$('video-preview-image');
 img.onload=null;img.onerror=null;thumbnailFallback(img,id);img.src=imageUrl(id);
 $('video-preview-title').textContent='Video '+id;
 $('video-preview-status').textContent='Memuat thumbnail dari YouTube...';
 img.onload=()=>{$('video-preview-status').textContent='Thumbnail YouTube siap · simpan untuk menambah ke playlist';};
 show('video-preview');
});

on('video-form','submit',async e=>{e.preventDefault();const id=videoId($('youtube-url').value);if(!id)return notice('Link YouTube belum valid. Gunakan tautan video, youtu.be, live, atau Shorts.');const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;try{const title=$('video-title').value.trim();if(!title)throw Error('Isi nama video terlebih dahulu.');unwrap(await sb.from('readmap_videos').upsert({awardee_id:member(),youtube_id:id,title,thumbnail_url:imageUrl(id)},{onConflict:'awardee_id,youtube_id',ignoreDuplicates:true}));$('video-form').reset();hide('video-preview');await loadAll();notice('Video berhasil ditambahkan ke ruang belajarmu.')}catch(error){err(error)}finally{btn.disabled=false}});
$('videos-list').addEventListener('click',async e=>{const el=e.target.closest('button');if(!el)return;const id=el.dataset.play;if(id){try{await openVideo(id);$('player-card').scrollIntoView({behavior:'smooth',block:'start'})}catch(error){err(error)}return;}const deleteId=el.dataset.deleteVideo;if(deleteId){const v=state.videos.find(x=>x.id===deleteId);if(!v||!confirm('Hapus video "'+v.title+'" dari koleksimu?'))return;try{if(state.activeVideo?.id===deleteId){await flushVideo();state.player?.destroy?.();state.player=null;state.activeVideo=null;hide('player-card')}unwrap(await sb.from('readmap_videos').delete().eq('id',deleteId).eq('awardee_id',member()));await loadAll();notice('Video dihapus dari koleksi.')}catch(error){err(error)}}});
function readyYoutube(){return new Promise((resolve,reject)=>{if(window.YT?.Player)return resolve();const old=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{old?.();resolve()};if(!document.querySelector('script[data-yt]')){const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.dataset.yt='1';s.onerror=()=>reject(Error('Pemutar video gagal dimuat'));document.head.appendChild(s)}})}
async function openVideo(id){
 await flushVideo();if(ticker){clearInterval(ticker);ticker=null}state.player?.destroy?.();$('player-card').querySelector('.player').innerHTML='<div id="yt-player"></div>';state.player=null;state.lastTime=null;
 const v=state.videos.find(x=>x.id===id);if(!v)return;
 state.activeVideo=v;state.intervals=merge(v.watched_intervals||[]);
 show('player-card');$('player-title').textContent=v.title;$('video-insight').value=v.insight||'';$('player-status').textContent='Menyiapkan video...';
 await readyYoutube();
 state.player=new YT.Player('yt-player',{width:'100%',height:'100%',videoId:v.youtube_id,playerVars:{playsinline:1,rel:0,origin:location.origin},events:{
  onReady:ev=>{const d=Math.round(ev.target.getDuration()||0);v.duration_seconds=d||v.duration_seconds;if(v.last_position_seconds>0)ev.target.seekTo(v.last_position_seconds,true);$('player-status').textContent='Pemutar siap · Lanjutkan dari posisi tersimpan.'},
  onStateChange:ev=>{if(ev.data===YT.PlayerState.PLAYING){state.lastTime=ev.target.getCurrentTime();tickVideo()}else {state.lastTime=null;if(ticker){clearInterval(ticker);ticker=null}if(ev.data===YT.PlayerState.ENDED)v.ended=true;flushVideo().catch(err)}},
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
 const v=state.activeVideo;if(!v||!state.awardee)return;
 if(state.videoSavePromise)await state.videoSavePromise.catch(()=>{});
 const save=(async()=>{
  state.saveAt=Date.now();
  const segments=state.intervals.map(x=>[Number(x[0]),Number(x[1])]);
  const p=nextStatus({...v,watched_intervals:segments});
  const status=v.ended&&p.ratio>=.9?'Selesai':v.status==='Selesai'?'Selesai':p.status;
  const pos=state.player?.getCurrentTime?.();
  const patch={watched_intervals:segments,duration_seconds:v.duration_seconds||0,last_position_seconds:Number.isFinite(pos)&&pos>=0?Math.round(pos):v.last_position_seconds||0,status,last_watched_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  unwrap(await sb.from('readmap_videos').update(patch).eq('id',v.id).eq('awardee_id',state.awardee));
  Object.assign(v,patch);render();
 })();
 state.videoSavePromise=save;
 try{await save}finally{if(state.videoSavePromise===save)state.videoSavePromise=null}
}
on('save-insight','click',async()=>{try{if(!state.activeVideo)throw Error('Pilih video dahulu');await flushVideo();const insight=$('video-insight').value.trim();unwrap(await sb.from('readmap_videos').update({insight,updated_at:new Date().toISOString()}).eq('id',state.activeVideo.id));state.activeVideo.insight=insight;notice('Pembelajaran video tersimpan.')}catch(e){err(e)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushVideo().catch(()=>{})});
window.addEventListener('pagehide',()=>{flushVideo().catch(()=>{})});
if(!sb)notice('Koneksi Supabase gagal dimuat. Periksa jaringan.');else identify().catch(err);
})();
