/* ETOS READMAP - awardee-owned reading and video progress. */
(()=>{'use strict';
const SUPABASE_URL='https://weklmapqizeldfdalbgs.supabase.co';
const KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const $=id=>document.getElementById(id);
const sb=window.supabase?.createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'etos-readmap-auth-v1'}});
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
 const allowed=['image/jpeg','image/png','image/webp','image/heic','image/heif'];
 if(!allowed.includes(file.type)&&!/\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name||''))throw Error('Gunakan foto sampul JPG, PNG, WebP, atau foto dari galeri.');
 if(file.size>15*1024*1024)throw Error('Ukuran foto awal maksimal 15 MB.');
 let img,url=null;
 try{
  if(typeof createImageBitmap==='function')img=await createImageBitmap(file);
 }catch(_){}
 if(!img){
  url=URL.createObjectURL(file);
  try{img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Foto tidak bisa dibaca. Coba kirim screenshot sampul dalam JPG atau PNG.'));image.src=url;})}
  finally{URL.revokeObjectURL(url)}
 }
 const scale=Math.min(1,760/img.width,1050/img.height);
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Foto tidak dapat diproses di perangkat ini.');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);img.close?.();
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(Error('Gagal mengolah foto sampul.')),'image/webp',0.82));
 if(blob.size>5*1024*1024||blob.type!=='image/webp')throw Error('Perangkat tidak dapat mengompres foto. Gunakan screenshot dalam JPG/PNG.');
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
 hide('login');show('workspace');show('demo-banner');$('open-demo-account').hidden=true;refreshCovers().then(()=>{render();notice('')}).catch(err);
}
function exitDemo(){
 if(ticker){clearInterval(ticker);ticker=null}
 state.player?.destroy?.();state.player=null;state.activeVideo=null;state.demo=false;state.awardee=null;state.books=[];state.entries=[];state.videos=[];state.coverUrls={};
 hide('demo-banner');hide('workspace');show('login');hide('player-card');notice('');identify().catch(err);
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
function videoId(raw){
 try{
  let input=String(raw||'').trim();
  const match=input.match(/(?:https?:\/\/)?(?:(?:www|m|music)\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\/[^\s<>\"']+/i);
  if(match)input=match[0];
  if(!/^https?:\/\//i.test(input))input='https://'+input;
  const u=new URL(input),host=u.hostname.toLowerCase().replace(/^www\./,'');
  let id=null;
  if(['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com'].includes(host)){
   const p=u.pathname.split('/').filter(Boolean);
   id=['shorts','embed','live','v'].includes(p[0])?p[1]:u.searchParams.get('v');
  }else if(host==='youtu.be'){id=u.pathname.split('/').filter(Boolean)[0]}
  return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:null;
 }catch{return null}
}
const imageUrl=id=>'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';
const thumbnailFallback=(img,id)=>{if(!img)return;img.onerror=()=>{img.onerror=null;img.src='https://i.ytimg.com/vi/'+id+'/mqdefault.jpg';};};
function emptyState(symbol,title,desc){return '<div class="empty-state"><span class="empty-icon">'+symbol+'</span><strong>'+safe(title)+'</strong><p>'+safe(desc)+'</p></div>'}
function nextStatus(v){const d=Math.max(0,Number(v.duration_seconds)||0);const intervals=merge(Array.isArray(v.watched_intervals)?v.watched_intervals:[]);const watched=intervals.reduce((sum,[a,b])=>sum+Math.max(0,d?Math.min(d,b)-Math.min(d,a):b-a),0);const ratio=d?Math.min(1,watched/d):0;return{ratio,display:Math.round(ratio*100),status:v.status==='Selesai'||(ratio>=.9&&v.ended)?'Selesai':watched>0?'Sedang Belajar':'Belum Dimulai'}}
function merge(xs){const sorted=xs.map(x=>[Math.max(0,Number(x[0])||0),Math.max(0,Number(x[1])||0)]).filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0]);return sorted.reduce((a,x)=>{const last=a[a.length-1];if(last&&x[0]<=last[1]+.35)last[1]=Math.max(last[1],x[1]);else a.push(x);return a},[])}

function bookProgress(b){
 const total=Number(b.total_pages)||0;
 const current=Math.max(0,Number(b.current_page)||0);
 return {total,current:total?Math.min(current,total):current,percent:total?Math.min(100,Math.round(current/total*100)):null};
}
function progressHTML(p,label){
 return '<div class="completion-track" role="progressbar" aria-label="'+safe(label)+'" aria-valuemin="0" aria-valuemax="100"'+(p==null?'':' aria-valuenow="'+p+'"')+'><span style="width:'+(p??0)+'%"></span></div>';
}
function bookCard(b){
 const p=bookProgress(b),url=coverUrl(b);
 const img=url?'<img loading="lazy" src="'+safe(url)+'" alt="Sampul '+safe(b.title)+'">':'';
 return '<article class="item book-item" data-book-card="'+safe(b.id)+'"><div class="book-art"><span class="book-placeholder">📖</span>'+img+'</div><div class="book-detail"><strong>'+safe(b.title)+'</strong><small>'+safe(b.author||'Penulis tidak dicantumkan')+'</small><span class="book-label">'+safe(b.category)+'</span><div class="completion-title"><span>Progres membaca</span><b>'+(p.percent==null?'—':p.percent+'%')+'</b></div>'+progressHTML(p.percent,'Penyelesaian '+b.title)+'<small class="completion-detail">'+(p.total?p.current+' / '+p.total+' halaman':'Posisi '+p.current+' · Total halaman belum diisi')+'</small><small class="completion-state">'+safe(b.status)+'</small><div class="card-actions"><button class="secondary" data-edit-book="'+safe(b.id)+'">Ubah Progres</button><button class="secondary" data-finish="'+safe(b.id)+'">'+(b.status==='Selesai'?'Baca Lagi':'Tandai Selesai')+'</button><button class="delete-button" data-delete-book="'+safe(b.id)+'">Hapus</button></div><form class="book-position-editor" hidden><label>Halaman terakhir dibaca<input type="number" min="0" max="20000" data-current required value="'+p.current+'"></label><label>Total halaman buku<input type="number" min="1" max="20000" data-total required value="'+(p.total||'')+'"></label><small>Persentase dihitung dari halaman terakhir ÷ total halaman. Bisa diperbarui kapan saja.</small><button type="submit" data-save-book="'+safe(b.id)+'">Simpan Progres</button></form></div></article>';
}
function renderContinue(){
 const books=state.books.filter(x=>x.status!=='Selesai').slice(0,2);
 const videos=state.videos.filter(x=>x.status!=='Selesai').slice(0,2);
 const parts=books.map(b=>{const p=bookProgress(b);return '<div class="journey-item"><span class="journey-icon">📖</span><div class="journey-copy"><span class="kicker">BUKU · SEDANG DIBACA</span><strong>'+safe(b.title)+'</strong><div class="journey-percent">'+(p.percent==null?'Total halaman belum diisi':p.percent+'% selesai')+'</div>'+progressHTML(p.percent,'Progres '+b.title)+'<small>'+(p.total?p.current+' / '+p.total+' halaman':'Masukkan total halaman buku')+'</small></div><button data-continue-book="'+safe(b.id)+'" aria-label="Buka buku '+safe(b.title)+'">↗</button></div>'});
 parts.push(...videos.map(v=>{const p=nextStatus(v);return '<div class="journey-item"><span class="journey-icon">▶</span><div class="journey-copy"><span class="kicker">VIDEO · SEDANG DIPELAJARI</span><strong>'+safe(v.title)+'</strong><div class="journey-percent">'+(v.duration_seconds?p.display+'% ditonton':'Mulai video untuk tracking')+'</div>'+progressHTML(v.duration_seconds?p.display:null,'Progres '+v.title)+'<small>'+safe(p.status)+'</small></div><button data-continue-video="'+safe(v.id)+'" aria-label="Lanjutkan video '+safe(v.title)+'">▶</button></div>'}));
 $('continue-items').innerHTML=parts.length?parts.join(''):emptyState('✦','Belum ada yang dilanjutkan','Tambahkan buku atau video untuk melihat progresmu di sini.');
}
function member(){if(!state.awardee)throw Error('Akun belum terhubung dengan Etoser.');return state.awardee}
async function identify(){
 const {data}=await sb.auth.getUser();state.user=data.user;
 if(!state.user){hide('workspace');show('login');return}
 try{
  const found=unwrap(await sb.from('readmap_memberships').select('awardee_id').eq('user_id',state.user.id).maybeSingle());
  state.awardee=found?.awardee_id||null;
  if(!state.awardee)throw Error('Akun belum terhubung dengan data Etoser.');
  hide('login');show('workspace');hide('demo-banner');$('open-demo-account').hidden=false;await loadAll();notice('');
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
 const previouslySelected=$('entry-book').value;
 $('entry-book').innerHTML=state.books.map(b=>'<option value="'+safe(b.id)+'">'+safe(b.title)+'</option>').join('');
 if(state.books.some(b=>b.id===previouslySelected))$('entry-book').value=previouslySelected;
 $('books-list').innerHTML=state.books.length?state.books.map(bookCard).join(''):emptyState('📚','Rak bukumu masih kosong','Tambahkan buku pertama dan unggah fotonya, supaya perjalanan bacamu makin hidup.');
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
 $('videos-list').innerHTML=state.videos.length?state.videos.map(v=>{const p=nextStatus(v);return '<div class="item video-card"><img class="thumb" loading="lazy" src="'+imageUrl(v.youtube_id)+'" alt="Thumbnail YouTube: '+safe(v.title)+'" referrerpolicy="no-referrer"><div class="video-card-content"><strong>'+safe(v.title)+'</strong><div class="completion-title"><span>'+safe(p.status)+'</span><b data-video-pct="'+safe(v.id)+'">'+(v.duration_seconds?p.display+'%':'—')+'</b></div><div class="video-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+p.display+'" aria-label="Persentase ditonton"><i data-video-bar="'+safe(v.id)+'" style="width:'+p.display+'%"></i></div><small>'+(v.duration_seconds?'Sudah ditonton '+p.display+'% dari durasi video':'Durasi terdeteksi setelah video diputar')+'</small><button data-play="'+safe(v.id)+'">▶ '+(p.display?'Lanjutkan menonton':'Mulai menonton')+'</button><button class="secondary" data-delete-video="'+safe(v.id)+'" style="margin-left:6px" title="Hapus video dari koleksi">Hapus</button></div></div>'}).join(''):emptyState('▶','Playlist belajarmu masih kosong','Tempel link YouTube favorit, thumbnail asli akan muncul otomatis di sini.');
 renderContinue();
 updateReadingForm();
}
on('enter-demo','click',enterDemo);
on('open-demo-account','click',()=>{if(!isDemo())enterDemo()});
on('leave-demo','click',exitDemo);
on('reset-demo','click',async()=>{if(!confirm('Ulangi Mode Demo dari data contoh awal? Semua perubahan demo di browser ini akan direset.'))return;const fixture=window.READMAP_DEMO.reset(currentWeek);Object.assign(state,{books:fixture.books,entries:fixture.entries,videos:fixture.videos});await refreshCovers();render();notice('Mode Demo kembali ke 5 buku dan 5 video contoh.');});
on('book-cover','change',()=>{clearCoverPreview();const file=$('book-cover').files?.[0];if(!file)return;if(!file.type.startsWith('image/')&&!/\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name))return notice('Pilih foto atau screenshot sampul dari galeri.');state.coverPreviewUrl=URL.createObjectURL(file);$('book-cover-preview').src=state.coverPreviewUrl;show('book-cover-preview');$('cover-placeholder').hidden=true;notice('');});
on('member-login','submit',async e=>{e.preventDefault();if(!sb)return notice('Layanan login belum dapat dimuat.');const raw=$('username').value.trim().toUpperCase();const pin=$('pin').value.trim();if(!/^ETOS26-[A-F0-9]{10}$/.test(raw)||!/^\d{10}$/.test(pin))return notice('Periksa username dan PIN pribadi Anda.');const button=e.target.querySelector('button[type=submit]');button.disabled=true;try{const email=raw.toLowerCase()+'@readmap.etosidpalu.com';unwrap(await sb.auth.signInWithPassword({email,password:pin}));$('pin').value='';await identify()}catch(error){notice('Username atau PIN tidak sesuai. Hubungi pengelola jika memerlukan reset.')}finally{button.disabled=false}});
on('signout','click',async()=>{
 if(isDemo()){exitDemo();return}
 await flushVideo();await sb.auth.signOut();state.awardee=null;state.user=null;hide('workspace');show('login');notice('Kamu berhasil keluar.');
});
on('book-form','submit',async e=>{
 e.preventDefault();const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;let newCover=null;
 try{
  const title=$('book-title').value.trim(),file=$('book-cover').files?.[0];
  if(title.length<2)throw Error('Judul buku minimal dua karakter.');
  if(file)newCover=await uploadCover(file);
  const book={awardee_id:member(),title,author:$('book-author').value.trim()||null,category:$('book-category').value,total_pages:Number($('book-total').value)||null,cover_path:newCover};
  if(isDemo()){state.books.unshift({...book,id:newId(),status:'Sedang Dibaca'});demoPersist();await refreshCovers();render();}
  else{const response=await sb.from('readmap_books').insert(book);unwrap(response);await loadAll()}
  e.target.reset();clearCoverPreview();selectReadingBook();notice('Buku berhasil ditambahkan ke rak bukumu.');
 }catch(error){if(newCover&&!isDemo())await deleteStoredCover(newCover);err(error)}
 finally{btn.disabled=false}
});

function selectedBook(){return state.books.find(b=>b.id===$('entry-book').value)}
function updateReadingForm(){
 const mode=$('entry-mode').value,range=mode==='rentang';
 $('range-inputs').hidden=!range;$('amount-input').hidden=range;$('reading-position-label').hidden=range;
 const b=selectedBook();
 if(!b){$('reading-progress-preview').textContent='Tambahkan buku dahulu untuk mulai mencatat.';return}
 const p=bookProgress(b);
 const v=range?Number($('to-page').value):($('entry-current-page').value!==''?Number($('entry-current-page').value):p.current);
 const candidate=Number.isFinite(v)?Math.max(p.current,v):p.current;
 const percent=p.total?Math.round(Math.min(1,candidate/p.total)*100):null;
 $('reading-progress-preview').textContent=p.total
  ?'Progres buku: '+Math.min(candidate,p.total)+' / '+p.total+' halaman'+(percent!==null?' · '+percent+'%':'')
  :'Total halaman buku belum diisi. Lengkapi di Rak Buku untuk menampilkan persen.';
}
function selectReadingBook(){
 const b=selectedBook();
 if(!b)return updateReadingForm();
 const p=bookProgress(b);
 const next=p.total&&p.current>=p.total?1:Math.max(1,p.current+1);
 $('from-page').value=Math.min(20000,next);
 $('to-page').value=Math.min(p.total||20000,Math.max(next,next+9));
 $('entry-current-page').value=p.current||'';
 updateReadingForm();
}
on('entry-mode','change',updateReadingForm);
on('entry-book','change',selectReadingBook);
for(const k of ['from-page','to-page','pages-read','entry-current-page'])on(k,'input',updateReadingForm);
async function saveBookPosition(b,position,total){
 if(!Number.isInteger(position)||!Number.isInteger(total)||total<1||total>20000||position<0||position>total)throw Error('Periksa posisi dan total halaman (0 sampai total halaman).');
 const status=position>=total?'Selesai':'Sedang Dibaca';
 if(isDemo()){Object.assign(b,{current_page:position,total_pages:total,status});demoPersist();render();}
 else{unwrap(await sb.from('readmap_books').update({current_page:position,total_pages:total,status,updated_at:new Date().toISOString()}).eq('id',b.id).eq('awardee_id',member()));await loadAll()}
}

on('reading-form','submit',async e=>{e.preventDefault();try{
 const mode=$('entry-mode').value,from=Number($('from-page').value),to=Number($('to-page').value);
 const pages=mode==='rentang'?to-from+1:Number($('pages-read').value);
 if(!Number.isInteger(pages)||pages<1||pages>20000||(mode==='rentang'&&(!Number.isInteger(from)||from<1||to>20000)))throw Error('Periksa jumlah halaman.');
 const bookId=$('entry-book').value;if(!bookId)throw Error('Tambahkan buku terlebih dahulu.');
 const payload={awardee_id:member(),book_id:bookId,week_start:currentWeek,input_mode:mode,from_page:mode==='rentang'?from:null,to_page:mode==='rentang'?to:null,pages_read:pages,insight:$('entry-insight').value.trim()};
 const b=state.books.find(x=>x.id===bookId);
 const rawPosition=$('entry-current-page').value;
 const proposed=mode==='rentang'?to:rawPosition!==''?Number(rawPosition):null;
 if(proposed!==null&&(!Number.isInteger(proposed)||proposed<0||proposed>20000))throw Error('Posisi halaman terakhir belum valid.');
 if(proposed!==null&&b.total_pages&&proposed>b.total_pages)throw Error('Posisi halaman melewati total halaman buku. Perbarui total halaman di Rak Buku jika berbeda.');
 const position=proposed===null?null:Math.max(Number(b.current_page)||0,proposed);

 if(payload.insight.length<8)throw Error('Tulis sedikitnya satu kalimat pembelajaran.');
 if(isDemo()){
  const index=state.entries.findIndex(v=>v.book_id===bookId&&v.week_start===currentWeek);
  if(index>=0)Object.assign(state.entries[index],payload);
  else state.entries.unshift({...payload,id:newId()});
  demoPersist();render();
 }else{
  unwrap(await sb.from('readmap_reading_entries').upsert(payload,{onConflict:'awardee_id,week_start,book_id'}));
  await loadAll();
 }

 if(position!==null&&position>(Number(b.current_page)||0)){
  const changes={current_page:position,updated_at:new Date().toISOString()};
  if(b.total_pages&&position>=b.total_pages)changes.status='Selesai';
  if(isDemo()){Object.assign(b,changes);demoPersist();render();}
  else{
   const result=await sb.from('readmap_books').update(changes).eq('id',bookId).eq('awardee_id',member());
   if(result.error){notice('Laporan tersimpan, tetapi progres buku belum diperbarui: '+result.error.message);return}
   await loadAll();
  }
 }
 $('entry-insight').value='';
 updateReadingForm();
 notice('Laporan tersimpan.'+(position===null?' Isi posisi halaman terakhir untuk menghitung persentase buku.':' Progres bukumu juga diperbarui.'));

 }catch(error){err(error)}});
$('books-list').addEventListener('click',async e=>{
 const button=e.target.closest('button');if(!button)return;
 const id=button.dataset.finish||button.dataset.deleteBook||button.dataset.editBook;
 if(!id)return;
 const b=state.books.find(x=>x.id===id);if(!b)return;
 if(button.dataset.editBook){const editor=button.closest('article').querySelector('.book-position-editor');editor.hidden=!editor.hidden;if(!editor.hidden)editor.querySelector('[data-current]').focus();return;}
 if(button.dataset.deleteBook){
  const reports=state.entries.filter(x=>x.book_id===id).length;
  if(!confirm('Hapus buku "'+b.title+'" dari rak?'+(reports?' '+reports+' catatan bacaan terkait juga akan dihapus.':'')))return;
  button.disabled=true;
  try{
   if(isDemo()){state.books=state.books.filter(x=>x.id!==id);state.entries=state.entries.filter(x=>x.book_id!==id);demoPersist();await loadAll();}
   else {unwrap(await sb.from('readmap_books').delete().eq('id',id).eq('awardee_id',member()));await deleteStoredCover(b.cover_path);await loadAll();}
   notice('Buku berhasil dihapus.');
  }catch(error){err(error)}finally{button.disabled=false}
 }else{
  button.disabled=true;
  try{
   const status=b.status==='Selesai'?'Sedang Dibaca':'Selesai';
   const changes={status,updated_at:new Date().toISOString()};
   if(status==='Selesai'&&b.total_pages)changes.current_page=b.total_pages;
   if(isDemo()){Object.assign(b,changes);demoPersist();render();}
   else{unwrap(await sb.from('readmap_books').update(changes).eq('id',id).eq('awardee_id',member()));await loadAll();}
   notice('Status buku diperbarui.');
  }catch(error){err(error)}finally{button.disabled=false}
 }
});

$('books-list').addEventListener('submit',async e=>{
 const form=e.target.closest('.book-position-editor');if(!form)return;
 e.preventDefault();const article=form.closest('article'),id=article?.dataset.bookCard;
 const b=state.books.find(x=>x.id===id);if(!b)return;
 const button=form.querySelector('[data-save-book]');button.disabled=true;
 try{
  await saveBookPosition(b,Number(form.querySelector('[data-current]').value),Number(form.querySelector('[data-total]').value));
  selectReadingBook();notice('Progres '+b.title+' berhasil diperbarui.');
 }catch(error){err(error)}finally{button.disabled=false}
});
$('continue-items').addEventListener('click',async e=>{
 const button=e.target.closest('button');if(!button)return;
 if(button.dataset.continueBook){
  selectTab('books');requestAnimationFrame(()=>{const article=[...$('books-list').querySelectorAll('[data-book-card]')].find(x=>x.dataset.bookCard===button.dataset.continueBook);article?.scrollIntoView({behavior:'smooth',block:'center'})});
 }else if(button.dataset.continueVideo){
  selectTab('videos');try{await openVideo(button.dataset.continueVideo);$('player-card').scrollIntoView({behavior:'smooth',block:'start'})}catch(error){err(error)}
 }
});
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

on('video-form','submit',async e=>{
 e.preventDefault();
 const id=videoId($('youtube-url').value);
 if(!id){$('youtube-hint').textContent='Tautan belum dikenali. Salin kembali dari tombol Bagikan di video YouTube, bukan link playlist atau channel.';$('youtube-hint').classList.add('hint-error');return}
 $('youtube-hint').classList.remove('hint-error');
 const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;
 try{
  const title=$('video-title').value.trim();if(!title)throw Error('Tulis judul video agar mudah dikenali.');
  if(state.videos.some(v=>v.youtube_id===id)){notice('Video ini sudah ada di koleksimu. Lihat di bagian Video Saya.');return}
  const v={awardee_id:member(),youtube_id:id,title,thumbnail_url:imageUrl(id),duration_seconds:0,last_position_seconds:0,watched_intervals:[],status:'Belum Dimulai'};
  if(isDemo()){state.videos.unshift({...v,id:newId()});demoPersist();render();}
  else{unwrap(await sb.from('readmap_videos').insert({awardee_id:v.awardee_id,youtube_id:id,title,thumbnail_url:v.thumbnail_url}));await loadAll();}
  e.target.reset();hide('video-preview');$('youtube-hint').textContent='Tautan video tersimpan. Pilih Tonton untuk membuka pemutar READMAP.';
  notice('Video masuk ke playlist belajar. Thumbnail asli YouTube ditampilkan otomatis.');
 }catch(error){err(error)}finally{btn.disabled=false}
});
$('videos-list').addEventListener('click',async e=>{const el=e.target.closest('button');if(!el)return;const id=el.dataset.play;if(id){try{await openVideo(id);$('player-card').scrollIntoView({behavior:'smooth',block:'start'})}catch(error){err(error)}return;}const deleteId=el.dataset.deleteVideo;if(deleteId){const v=state.videos.find(x=>x.id===deleteId);if(!v||!confirm('Hapus video "'+v.title+'" dari koleksimu?'))return;try{if(state.activeVideo?.id===deleteId){await flushVideo();state.player?.destroy?.();state.player=null;state.activeVideo=null;hide('player-card')}if(isDemo()){state.videos=state.videos.filter(x=>x.id!==deleteId);demoPersist();await loadAll()}else{unwrap(await sb.from('readmap_videos').delete().eq('id',deleteId).eq('awardee_id',member()));await loadAll()}notice('Video dihapus dari koleksi.')}catch(error){err(error)}}});
function readyYoutube(){return new Promise((resolve,reject)=>{if(window.YT?.Player)return resolve();const old=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{old?.();resolve()};if(!document.querySelector('script[data-yt]')){const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.dataset.yt='1';s.onerror=()=>reject(Error('Pemutar video gagal dimuat'));document.head.appendChild(s)}})}
async function openVideo(id){
 await flushVideo();if(ticker){clearInterval(ticker);ticker=null}state.player?.destroy?.();$('player-card').querySelector('.player').innerHTML='<div id="yt-player"></div>';state.player=null;state.lastTime=null;
 const v=state.videos.find(x=>x.id===id);if(!v)return;
 state.activeVideo=v;state.intervals=merge(v.watched_intervals||[]);
 show('player-card');$('player-title').textContent=v.title;$('video-insight').value=v.insight||'';$('player-status').textContent='Menyiapkan video...';renderPlayerProgress({...v,watched_intervals:state.intervals});
 await readyYoutube();
 state.player=new YT.Player('yt-player',{width:'100%',height:'100%',videoId:v.youtube_id,playerVars:{playsinline:1,rel:0,origin:location.origin},events:{
  onReady:ev=>{const d=Math.round(ev.target.getDuration()||0);v.duration_seconds=d||v.duration_seconds;if(v.last_position_seconds>0)ev.target.seekTo(v.last_position_seconds,true);$('player-status').textContent='Pemutar siap · Lanjutkan dari posisi tersimpan.'},
  onStateChange:ev=>{if(ev.data===YT.PlayerState.PLAYING){state.lastTime=ev.target.getCurrentTime();tickVideo()}else {state.lastTime=null;if(ticker){clearInterval(ticker);ticker=null}if(ev.data===YT.PlayerState.ENDED)v.ended=true;flushVideo().catch(err)}},
  onError:()=>{$('player-status').textContent='Video tidak dapat diputar tertanam. Progres tidak dihitung.'}
 }});
}
let ticker=null;
function renderPlayerProgress(v){
 const p=nextStatus(v);
 $('player-progress-pct').textContent=v.duration_seconds?p.display+'%':'—';
 $('player-progress-bar').style.width=(v.duration_seconds?p.display:0)+'%';
 $('player-progress-caption').textContent=v.duration_seconds
  ?'Bagian yang benar-benar diputar: '+p.display+'% · '+p.status
  :'Durasi dan persentase tersedia setelah pemutar siap.';
 if(v.id){
  const el=[...$('videos-list').querySelectorAll('[data-video-pct]')].find(x=>x.dataset.videoPct===v.id);
  const bar=[...$('videos-list').querySelectorAll('[data-video-bar]')].find(x=>x.dataset.videoBar===v.id);
  if(el)el.textContent=v.duration_seconds?p.display+'%':'—';
  if(bar)bar.style.width=p.display+'%';
 }
}
function tickVideo(){
 if(ticker)clearInterval(ticker);
 ticker=setInterval(()=>{
  if(!state.player||!state.activeVideo||state.player.getPlayerState?.()!==YT.PlayerState.PLAYING)return;
  const now=state.player.getCurrentTime();const previous=state.lastTime;state.lastTime=now;
  if(Number.isFinite(previous)&&Number.isFinite(now)&&now>previous&&now-previous<=2.2)state.intervals=merge([...state.intervals,[previous,now]]);
  const v=state.activeVideo;v.duration_seconds=Math.round(state.player.getDuration()||v.duration_seconds||0);
  const p=nextStatus({...v,watched_intervals:state.intervals});
  $('player-status').textContent='Tercatat '+p.display+'% · '+p.status;
  renderPlayerProgress({...v,watched_intervals:state.intervals});
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
  if(!isDemo())unwrap(await sb.from('readmap_videos').update(patch).eq('id',v.id).eq('awardee_id',state.awardee));
  Object.assign(v,patch);demoPersist();render();renderPlayerProgress(v);
 })();
 state.videoSavePromise=save;
 try{await save}finally{if(state.videoSavePromise===save)state.videoSavePromise=null}
}
on('save-insight','click',async()=>{try{if(!state.activeVideo)throw Error('Pilih video dahulu');await flushVideo();const insight=$('video-insight').value.trim();if(!isDemo())unwrap(await sb.from('readmap_videos').update({insight,updated_at:new Date().toISOString()}).eq('id',state.activeVideo.id));state.activeVideo.insight=insight;notice('Pembelajaran video tersimpan.')}catch(e){err(e)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushVideo().catch(()=>{})});
window.addEventListener('pagehide',()=>{flushVideo().catch(()=>{})});
if(!sb)notice('Koneksi Supabase gagal dimuat. Periksa jaringan.');else identify().catch(err);
})();
