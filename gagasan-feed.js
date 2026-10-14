/* Ruang Gagasan library and article reader */
(()=>{'use strict';
const G=window.GG,$=G.$,s=G.s,esc=G.esc;
const short=(x,n=160)=>String(x||'').length>n?String(x).slice(0,n-1)+'…':String(x||'');
const published=a=>a.status==='published'&&a.share_enabled;
function card(a){const image=G.cover(a);return '<article class="article-card">'+(image?'<img loading="lazy" data-read="'+esc(a.id)+'" alt="Sampul '+esc(a.title)+'" src="'+esc(image)+'">':'')+'<div class="article-card-content"><span class="kicker">'+esc(a.category)+'</span><h3 data-read="'+esc(a.id)+'">'+esc(a.title)+'</h3><p>'+esc(short(a.excerpt))+'</p><div class="card-bottom"><span>'+esc(a.author_name)+' · '+esc(G.date(a.published_at))+'</span><button data-read="'+esc(a.id)+'" type="button">Baca ↗</button></div></div></article>'}
function feed(){
 const q=$('search').value.trim().toLowerCase(),c=$('category-filter').value;
 const all=s.articles.filter(a=>published(a)&&(!c||a.category===c)&&(!q||(a.title+' '+a.excerpt+' '+a.author_name+' '+a.body).toLowerCase().includes(q)));
 const first=!q&&!c?all[0]:null;
 $('featured').innerHTML=first?'<div class="featured-card"><div class="featured-copy"><small>EDITORIAL · '+esc(first.category)+'</small><h3>'+esc(first.title)+'</h3><p>'+esc(short(first.excerpt,200))+'</p><span class="byline">'+esc(first.author_name)+' · '+esc(G.date(first.published_at))+'</span><button data-read="'+esc(first.id)+'">Baca selengkapnya ↗</button></div>'+(G.cover(first)?'<img src="'+esc(G.cover(first))+'" alt="Foto tulisan unggulan">':'')+'</div>':'';
 $('feed-grid').innerHTML=(first?all.slice(1):all).map(card).join('');
 $('feed-empty').hidden=all.length>0;
}
function mine(){
 const all=s.articles.filter(G.own),pub=all.filter(published);
 $('mine-published').textContent=all.filter(a=>a.status==='published').length;
 $('mine-drafts').textContent=all.filter(a=>a.status==='draft').length;
 $('mine-words').textContent=pub.reduce((n,a)=>n+G.words(a.body),0).toLocaleString('id-ID');
 $('mine-list').innerHTML=all.length?all.map(a=>'<article class="mine-item">'+(G.cover(a)?'<img alt="Sampul" src="'+esc(G.cover(a))+'">':'<div class="upload-preview">✦</div>')+'<div><span class="kicker">'+esc(a.category)+' · '+(published(a)?'TERBIT':a.status==='draft'?'DRAF':'DISEMBUNYIKAN')+'</span><h3>'+esc(a.title||'Tanpa judul')+'</h3><p>'+esc(G.date(a.updated_at))+' · '+G.words(a.body)+' kata</p></div><div class="mine-actions"><button data-read="'+esc(a.id)+'">Lihat</button><button data-edit="'+esc(a.id)+'">Edit</button>'+(published(a)?'<button data-copy="'+esc(a.id)+'">Salin link</button><button data-hide="'+esc(a.id)+'">Sembunyikan</button>':'')+'<button data-delete="'+esc(a.id)+'" class="danger">Hapus</button></div></article>').join(''):'<div class="empty-state"><span>✎</span><h3>Halaman pertama menantimu.</h3><p>Mulailah menulis dan buat karya pertamamu.</p></div>';
}
function read(id){
 const a=s.articles.find(x=>x.id===id);if(!a)return G.notice('Tulisan tidak ditemukan.',true);
 s.reading=id;$('read-category').textContent=a.category;$('read-title').textContent=a.title;$('read-excerpt').textContent=a.excerpt;
 $('read-byline').textContent='Oleh '+a.author_name+' · '+G.date(a.published_at||a.updated_at)+' · '+Math.max(1,Math.ceil(G.words(a.body)/200))+' menit baca';
 const image=G.cover(a);$('read-cover').hidden=!image;if(image)$('read-cover').src=image;
 $('read-body').innerHTML=G.md(a.body);$('share-article').hidden=!published(a);$('edit-from-read').hidden=!G.own(a);
 G.view('article');
}
async function del(a){
 if(!G.own(a)||!confirm('Hapus tulisan ini secara permanen?'))return;
 try{G.check(await G.sb.from('gagasan_articles').delete().eq('id',a.id).eq('awardee_id',s.member));if(a.cover_path)await G.sb.storage.from('gagasan-covers').remove([a.cover_path]);await G.refresh();G.notice('Tulisan berhasil dihapus.')}catch(e){G.notice('Gagal menghapus: '+e.message,true)}
}
async function hide(a){
 if(!G.own(a)||!confirm('Sembunyikan tulisan? Link publik akan tidak aktif.'))return;
 try{G.check(await G.sb.from('gagasan_articles').update({status:'hidden',share_enabled:false}).eq('id',a.id).eq('awardee_id',s.member));await G.refresh();G.notice('Tulisan disembunyikan.')}catch(e){G.notice('Tidak dapat menyembunyikan: '+e.message,true)}
}
function click(e){
 const b=e.target.closest('[data-read],[data-copy],[data-edit],[data-delete],[data-hide]');if(!b)return;
 const id=b.dataset.read||b.dataset.copy||b.dataset.edit||b.dataset.delete||b.dataset.hide;
 const a=s.articles.find(x=>x.id===id);if(!a)return;
 if(b.dataset.read)read(id);else if(b.dataset.copy)G.copy(a);else if(b.dataset.edit)window.GGEditor.open(a);
 else if(b.dataset.delete)del(a);else if(b.dataset.hide)hide(a);
}
window.GGFeed={draw:()=>{feed();mine()},read,mine,feed};
$('feed-grid').addEventListener('click',click);$('featured').addEventListener('click',click);$('mine-list').addEventListener('click',click);
$('search').addEventListener('input',feed);$('category-filter').addEventListener('change',feed);
$('read-back').addEventListener('click',()=>G.view('feed'));
$('share-article').addEventListener('click',()=>{const a=s.articles.find(x=>x.id===s.reading);if(a)G.copy(a)});
$('edit-from-read').addEventListener('click',()=>{const a=s.articles.find(x=>x.id===s.reading);if(a)window.GGEditor.open(a)});
})();