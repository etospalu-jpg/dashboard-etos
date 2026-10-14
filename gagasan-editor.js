/* Ruang Gagasan v2: direct publish, no summary input, existing Awardee login only for authoring. */
(()=>{'use strict';
const G=window.GG,$=G.$,s=G.s,Pic=window.GGCovers;
let draftTimer=null;
const key=()=>('etos-gagasan-draft-'+(s.user?.id||'guest'));
function count(){const n=G.words($('article-body').value);$('word-count').textContent=n.toLocaleString('id-ID')+' kata';$('read-time').value=Math.max(1,Math.ceil(n/200))+' menit'}
function localSave(){if(s.editing||!s.member)return;try{localStorage.setItem(key(),JSON.stringify({title:$('article-title').value,body:$('article-body').value,category:$('article-category').value}))}catch(_){}}
function restore(){try{const d=JSON.parse(localStorage.getItem(key())||'null');if(d){$('article-title').value=d.title||'';$('article-body').value=d.body||'';$('article-category').value=G.categories.includes(d.category)?d.category:'Opini'}}catch(_){}}
function open(a=null){
 if(!s.member){s.pendingAuthorView='editor';return G.requireAuthor(()=>{})}
 if(a&&!G.own(a))return G.notice('Kamu hanya dapat mengedit tulisan sendiri.',true);
 s.editing=a?.id||null;$('article-form').reset();
 $('article-title').value=a?.title||'';$('article-body').value=a?.body||'';$('article-category').value=a?.category||'Opini';
 if(!a)restore();
 $('editor-heading').textContent=a?'Sunting tulisanmu.':'Tulis sesuatu yang berarti.';
 $('editor-status').textContent=a?(a.status==='published'?'Tulisan terbit':a.status==='hidden'?'Tulisan disembunyikan':'Draf pribadi'):'Tulisan baru';
 $('article-cover').value='';Pic.preview(a?G.cover(a):null);
 $('editor-preview').hidden=true;$('show-preview').textContent='◉ Pratinjau';count();G.view('editor');
}
function validate(status){
 const title=$('article-title').value.trim(),body=$('article-body').value.trim(),category=$('article-category').value;
 if(title.length<2||title.length>180)throw Error('Judul harus antara 2 sampai 180 karakter.');
 if(!G.categories.includes(category))throw Error('Pilih kategori tulisan.');
 if(body.length>50000)throw Error('Isi tulisan terlalu panjang (maksimal 50.000 karakter).');
 if(status==='published'&&(title.length<6||body.length<120))throw Error('Judul minimal 6 karakter dan isi tulisan minimal 120 karakter untuk diterbitkan.');
 // Database/OG description is generated automatically from the article, never separately requested.
 const excerpt=G.plain(body).slice(0,320);
 return {title,body,category,excerpt};
}
async function save(status){
 if(s.saving)return;if(!s.member)return G.requireAuthor(()=>{});
 let d;try{d=validate(status)}catch(e){return G.notice(e.message,true)}
 s.saving=true;const buttons=[$('save-draft'),$('publish-article')];buttons.forEach(b=>b.disabled=true);
 let newCover=null,stored=false;
 try{
  const old=s.articles.find(a=>a.id===s.editing)||null;
  let cover_path=old?.cover_path||null;
  if(Pic.selected()||(status==='published'&&!cover_path)){
   G.notice('Menyiapkan foto sampul yang sudah dikompresi…');
   newCover=await Pic.upload(Pic.selected(),d.title,d.category);
   cover_path=newCover;
  }
  const payload={awardee_id:s.member,...d,slug:G.slug(d.title),cover_path,status,share_enabled:status==='published',
   published_at:status==='published'?(old?.published_at||new Date().toISOString()):old?.published_at||null};
  const res=old
   ? await G.sb.from('gagasan_articles').update(payload).eq('id',old.id).eq('awardee_id',s.member).select('id').single()
   : await G.sb.from('gagasan_articles').insert(payload).select('id').single();
  const saved=G.check(res);stored=true;
  if(newCover&&old?.cover_path)await Pic.cleanup(old.cover_path);
  try{localStorage.removeItem(key())}catch(_){}
  s.editing=saved.id;
  try{await G.refresh()}catch(syncError){
   const replacementRow={id:saved.id,awardee_id:s.member,author_name:s.name,...payload,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
   s.articles=[replacementRow,...s.articles.filter(a=>a.id!==saved.id)];
   window.GGFeed?.draw();
   G.notice('Tulisan tersimpan. Sinkronisasi daftar masih tertunda; tautannya tetap tersedia.');
  }
  if(status==='published'){
   G.notice('Tulisan terbit. Tautan publiknya siap dibagikan.');
   window.GGFeed.read(saved.id);
  }else{G.notice('Draf berhasil disimpan.');G.view('mine')}
 }catch(e){
  if(newCover&&!stored)await Pic.cleanup(newCover);
  G.notice('Gagal menyimpan tulisan: '+(e.message||'Coba lagi.'),true);
 }finally{s.saving=false;buttons.forEach(b=>b.disabled=false)}
}
async function importDocument(file){
 if(!file)return;
 if(file.size>5*1024*1024||!file.size)throw Error('Dokumen maksimal 5 MB.');
 const name=String(file.name||''),extension=name.split('.').pop().toLowerCase();
 if(!['docx','txt','md'].includes(extension))throw Error('Pilih dokumen DOCX, TXT atau MD.');
 if($('article-body').value.trim()&&!confirm('Ganti isi tulisan sekarang dengan isi dokumen?'))return;
 let text='';
 if(extension==='docx'){
  if(!window.mammoth?.extractRawText)throw Error('Pembaca Word belum termuat. Coba salin isi tulisan atau muat ulang.');
  const result=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});text=result.value||'';
 }else text=await file.text();
 text=text.replace(/\r\n/g,'\n').trim();
 if(!text||text.length>50000)throw Error('Isi dokumen kosong atau melebihi 50.000 karakter.');
 $('article-body').value=text;
 if(!$('article-title').value.trim())$('article-title').value=name.replace(/\.(docx|txt|md)$/i,'').replace(/[-_]+/g,' ').slice(0,180);
 $('article-body').dispatchEvent(new Event('input',{bubbles:true}));
 G.notice('Isi dokumen berhasil dimuat. Periksa hasilnya sebelum terbit.');
}
$('article-form').addEventListener('submit',e=>{e.preventDefault();save('published')});
$('save-draft').addEventListener('click',()=>save('draft'));
$('article-import').addEventListener('change',async e=>{const file=e.target.files?.[0];try{await importDocument(file)}catch(err){G.notice('Impor dokumen gagal: '+err.message,true)}finally{e.target.value=''}});
$('editor-cancel').addEventListener('click',()=>G.view('mine'));
$('mine-create').addEventListener('click',()=>open());
$('create-cta').addEventListener('click',()=>open());
$('explore-cta').addEventListener('click',()=>{G.view('feed');document.getElementById('feed-view').scrollIntoView({behavior:'smooth'})});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{
 const view=b.dataset.view;if(view==='editor')open();
 else if(view==='mine'&&!s.member){s.pendingAuthorView='mine';G.requireAuthor(()=>{})}
 else G.view(view)
}));
['article-title','article-body','article-category'].forEach(id=>$(id).addEventListener('input',()=>{count();clearTimeout(draftTimer);draftTimer=setTimeout(localSave,500)}));
document.querySelectorAll('[data-format]').forEach(b=>b.addEventListener('click',()=>{
 const x=$('article-body'),start=x.selectionStart,end=x.selectionEnd,str=x.value.slice(start,end)||'teks',kind=b.dataset.format;
 const formatted=kind==='bold'?'**'+str+'**':kind==='italic'?'*'+str+'*':kind==='h2'?'## '+str:kind==='quote'?'> '+str:'- '+str;
 x.setRangeText(formatted,start,end,'select');x.focus();count();localSave();
}));
$('show-preview').addEventListener('click',()=>{const block=$('editor-preview');block.hidden=!block.hidden;$('preview-content').innerHTML=G.md($('article-body').value);$('show-preview').textContent=block.hidden?'◉ Pratinjau':'Tutup pratinjau'});
$('login-form').addEventListener('submit',async e=>{
 e.preventDefault();const b=e.target.querySelector('button[type=submit]');b.disabled=true;
 try{
  const username=$('login-username').value.trim().toUpperCase(),pin=$('login-pin').value.trim();
  if(!/^ETOS26-[A-F0-9]{10}$/.test(username)||!/^\d{10}$/.test(pin))throw Error('Periksa username dan PIN 10 digit.');
  G.check(await G.sb.auth.signInWithPassword({email:username.toLowerCase()+'@readmap.etosidpalu.com',password:pin}));
  $('login-pin').value='';
  const target=s.pendingAuthorView;s.pendingAuthorView=null;
  await G.boot();
  if(s.member&&target==='editor')open();
  else if(s.member&&target==='mine')G.view('mine');
 }catch(err){G.notice('Login gagal: '+(err.message||'Periksa kembali akunmu.'),true)}
 finally{b.disabled=false}
});
$('logout').addEventListener('click',async()=>{
 await G.sb.auth.signOut();s.member=null;s.user=null;s.articles=[];s.editing=null;
 await G.boot();G.notice('Berhasil keluar. Kamu tetap bisa membaca seluruh tulisan.');
});
window.GGEditor={open,save,validate};
G.boot();
})();