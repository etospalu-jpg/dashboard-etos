/* Direct publishing and personal writing desk. No admin approval workflow. */
(()=>{'use strict';
const G=window.GG,$=G.$,s=G.s,Pic=window.GGCovers;
const draftKey=()=>('etos-gagasan-draft-'+(s.user?.id||'guest'));
let draftTimer;
function count(){const n=G.words($('article-body').value);$('word-count').textContent=n.toLocaleString('id-ID')+' kata';$('read-time').value=Math.max(1,Math.ceil(n/200))+' menit'}
function draftLocal(){if(s.editing)return;try{localStorage.setItem(draftKey(),JSON.stringify({title:$('article-title').value,excerpt:$('article-excerpt').value,body:$('article-body').value,category:$('article-category').value}))}catch(e){}}
function restore(){try{const d=JSON.parse(localStorage.getItem(draftKey())||'null');if(d){$('article-title').value=d.title||'';$('article-excerpt').value=d.excerpt||'';$('article-body').value=d.body||'';$('article-category').value=G.categories.includes(d.category)?d.category:'Opini'}}catch(e){}}
function edit(a){
 if(a&&!G.own(a))return G.notice('Hanya penulis yang dapat mengedit tulisan ini.',true);
 s.editing=a?.id||null;$('article-form').reset();
 $('article-title').value=a?.title||'';$('article-excerpt').value=a?.excerpt||'';$('article-body').value=a?.body||'';$('article-category').value=a?.category||'Opini';
 if(!a)restore();
 $('editor-heading').textContent=a?'Sunting tulisanmu.':'Tulis sesuatu yang berarti.';
 $('editor-status').textContent=a?(a.status==='published'?'Sudah diterbitkan':a.status==='hidden'?'Disembunyikan':'Draf pribadi'):'Tulisan baru';
 Pic.preview(a?G.cover(a):null);$('article-cover').value='';
 $('editor-preview').hidden=true;$('show-preview').textContent='◉ Pratinjau';count();G.view('editor');
}
function valid(){
 const title=$('article-title').value.trim(),excerpt=$('article-excerpt').value.trim(),body=$('article-body').value.trim(),category=$('article-category').value;
 if(title.length<2||title.length>180)throw Error('Judul harus 2 sampai 180 karakter.');
 if(!G.categories.includes(category))throw Error('Kategori tulisan tidak sesuai.');
 if(excerpt.length>400||body.length>50000)throw Error('Teks terlalu panjang.');
 return {title,excerpt,body,category};
}
async function save(status){
 if(s.saving)return;if(!s.member)return G.notice('Masuk dahulu sebagai Awardee.',true);
 let data;try{data=valid()}catch(e){return G.notice(e.message,true)}
 if(status==='published'&&(data.title.length<6||data.excerpt.length<20||data.body.length<120))
  return G.notice('Untuk menerbitkan: judul minimal 6, ringkasan minimal 20, dan isi minimal 120 karakter.',true);
 s.saving=true;[$('save-draft'),$('publish-article')].forEach(b=>b.disabled=true);
 let uploaded=null,committed=false;
 try{
  const old=s.articles.find(a=>a.id===s.editing);
  let path=old?.cover_path||null;
  if(Pic.selected()||status==='published'&&!path){
   G.notice('Mengolah dan mengunggah sampul terkompresi…');
   uploaded=await Pic.upload(Pic.selected(),data.title,data.category);path=uploaded;
  }
  const payload={awardee_id:s.member,...data,slug:G.slug(data.title),cover_path:path,status,share_enabled:status==='published',
   published_at:status==='published'?(old?.published_at||new Date().toISOString()):old?.published_at||null};
  let response;
  if(old)response=await G.sb.from('gagasan_articles').update(payload).eq('id',old.id).eq('awardee_id',s.member).select('id').single();
  else response=await G.sb.from('gagasan_articles').insert(payload).select('id').single();
  const saved=G.check(response);committed=true;
  if(uploaded&&old?.cover_path)await Pic.cleanup(old.cover_path);
  try{localStorage.removeItem(draftKey())}catch(e){}
  s.editing=saved.id;await G.refresh();
  G.notice(status==='published'?'Tulisan berhasil terbit. Link berbagi sudah siap.':'Draf berhasil disimpan.');
  if(status==='published')window.GGFeed.read(saved.id);else G.view('mine');
 }catch(e){if(uploaded&&!committed)await Pic.cleanup(uploaded);G.notice('Gagal menyimpan: '+e.message,true)}
 finally{s.saving=false;[$('save-draft'),$('publish-article')].forEach(b=>b.disabled=false)}
}
async function importDocument(file){
 if(!file)return;
 if(file.size>5*1024*1024||!file.size)throw Error('Dokumen maksimal 5 MB.');
 const name=String(file.name||''),extension=name.split('.').pop().toLowerCase();
 if(!['docx','txt','md'].includes(extension))throw Error('Unggah DOCX, TXT atau MD.');
 if($('article-body').value.trim()&&!confirm('Ganti isi tulisan pada editor dengan isi dokumen?'))return;
 let text='';
 if(extension==='docx'){
  if(!window.mammoth?.extractRawText)throw Error('Pembaca dokumen Word belum tersedia. Coba muat ulang atau salin teks ke editor.');
  const result=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
  text=result.value||'';
 }else text=await file.text();
 text=text.replace(/\\r\\n/g,'\\n').trim();
 if(!text||text.length>50000)throw Error('Dokumen kosong atau lebih dari 50.000 karakter.');
 $('article-body').value=text;
 if(!$('article-title').value.trim())$('article-title').value=name.replace(/\\.(docx|txt|md)$/i,'').replace(/[-_]+/g,' ').slice(0,180);
 $('article-body').dispatchEvent(new Event('input',{bubbles:true}));
 G.notice('Isi dokumen berhasil dimuat. Periksa dan lengkapi ringkasan sebelum diterbitkan.');
}
function init(){
 $('article-form').addEventListener('submit',e=>{e.preventDefault();save('published')});
 $('save-draft').addEventListener('click',()=>save('draft'));
 $('article-import').addEventListener('change',async e=>{const f=e.target.files?.[0];try{await importDocument(f)}catch(error){G.notice('Tidak dapat membaca dokumen: '+error.message,true)}finally{e.target.value=''}});
 $('editor-cancel').addEventListener('click',()=>G.view('mine'));
 $('mine-create').addEventListener('click',()=>edit());
 $('create-cta').addEventListener('click',()=>{if(s.member)edit();else $('login-panel').scrollIntoView({behavior:'smooth'})});
 $('explore-cta').addEventListener('click',()=>{if(s.member)G.view('feed');else $('login-panel').scrollIntoView({behavior:'smooth'})});
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{if(!s.member)return G.notice('Masuk ke akun terlebih dahulu.',true);if(b.dataset.view==='editor')edit();else G.view(b.dataset.view)}));
 for(const id of ['article-title','article-excerpt','article-body','article-category'])$(id).addEventListener('input',()=>{count();clearTimeout(draftTimer);draftTimer=setTimeout(draftLocal,500)});
 document.querySelectorAll('[data-format]').forEach(b=>b.addEventListener('click',()=>{
  const x=$('article-body'),start=x.selectionStart,end=x.selectionEnd,s=x.value.slice(start,end)||'teks',mode=b.dataset.format;
  const v=mode==='bold'?'**'+s+'**':mode==='italic'?'*'+s+'*':mode==='h2'?'## '+s:mode==='quote'?'> '+s:'- '+s;
  x.setRangeText(v,start,end,'select');x.focus();count();draftLocal()
 }));
 $('show-preview').addEventListener('click',()=>{const el=$('editor-preview');el.hidden=!el.hidden;$('preview-content').innerHTML=G.md($('article-body').value);$('show-preview').textContent=el.hidden?'◉ Pratinjau':'Tutup pratinjau'});
 $('login-form').addEventListener('submit',async e=>{
  e.preventDefault();const b=e.target.querySelector('button[type=submit]');b.disabled=true;
  try{
   const u=$('login-username').value.trim().toUpperCase(),pin=$('login-pin').value.trim();
   if(!/^ETOS26-[A-F0-9]{10}$/.test(u)||!/^\d{10}$/.test(pin))throw Error('Username atau PIN tidak sesuai format.');
   G.check(await G.sb.auth.signInWithPassword({email:u.toLowerCase()+'@readmap.etosidpalu.com',password:pin}));
   $('login-pin').value='';await G.boot()
  }catch(e){G.notice('Login gagal: '+(e.message||'Periksa kembali akunmu.'),true)}
  finally{b.disabled=false}
 });
 $('logout').addEventListener('click',async()=>{await G.sb.auth.signOut();s.member=null;s.user=null;s.articles=[];await G.boot();G.notice('Kamu berhasil keluar.')});
}
window.GGEditor={open:edit,save};
init();G.boot();
})();