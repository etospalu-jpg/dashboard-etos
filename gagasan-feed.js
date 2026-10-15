/* Ruang Gagasan v2 — public editorial index, discovery, share and reading. */
(()=>{'use strict';
const G=window.GG,$=G.$,s=G.s,esc=G.esc;
const published=a=>a.status==='published'&&a.share_enabled;
const shorten=(str,n)=>String(str||'').length>n?String(str).slice(0,n-1).trimEnd()+'…':String(str||'');
function card(a,i){
 const cover=G.cover(a),url=G.url(a);
 return '<article class="article-card reveal-card" style="--delay:'+Math.min(i,9)*62+'ms" data-card="'+esc(a.id)+'">'+
 '<a class="article-cover-link" href="'+esc(url)+'" aria-label="Buka tulisan '+esc(a.title)+'">'+
 (cover?'<img loading="lazy" src="'+esc(cover)+'" alt="Sampul '+esc(a.title)+'">':'<div class="card-image-placeholder">RUANG GAGASAN</div>')+
 '<span class="cover-arrow" aria-hidden="true">↗</span></a>'+
 '<div class="article-card-content"><div class="card-topline"><span class="kicker">'+esc(a.category)+'</span><span class="read-minute">'+Math.max(1,Math.ceil(G.words(a.body)/200))+' menit baca</span></div>'+
 '<h3><a href="'+esc(url)+'">'+esc(a.title)+'</a></h3><p>'+esc(shorten(G.description(a),150))+'</p>'+
 '<div class="card-bottom"><span class="card-author"><span><b>'+esc(a.author_name)+'</b><small>'+esc(G.date(a.published_at))+'</small></span></span>'+
 '<button type="button" data-share="'+esc(a.id)+'" class="share-round" title="Salin tautan '+esc(a.title)+'" aria-label="Bagikan tulisan '+esc(a.title)+'">↗</button></div></div></article>';
}
function featured(a){
 const url=G.url(a),image=G.cover(a);
 return '<article class="featured-card spotlight-card"><a href="'+esc(url)+'" class="featured-visual" aria-label="Buka tulisan unggulan">'+(image?'<img src="'+esc(image)+'" alt="Sampul '+esc(a.title)+'">':'<div class="featured-placeholder">ETOS ID PALU</div>')+'</a>'+
 '<div class="featured-copy"><div class="featured-label"><span class="live-dot"></span> TULISAN TERBARU <span class="featured-category">'+esc(a.category)+'</span></div>'+
 '<h3><a href="'+esc(url)+'">'+esc(a.title)+'</a></h3><p>'+esc(shorten(G.description(a),215))+'</p>'+
 '<div class="featured-bottom"><span>Oleh <strong>'+esc(a.author_name)+'</strong><small>'+esc(G.date(a.published_at))+' · '+Math.max(1,Math.ceil(G.words(a.body)/200))+' menit baca</small></span>'+
 '<a href="'+esc(url)+'" class="featured-read">Baca selengkapnya <span>↗</span></a></div></div></article>';
}
function animation(){
 const cards=[...document.querySelectorAll('.reveal-card')];
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){cards.forEach(c=>c.classList.add('is-visible'));return}
 if(!('IntersectionObserver'in window)){cards.forEach(c=>c.classList.add('is-visible'));return}
 const o=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');o.unobserve(entry.target)}})},{threshold:0.08,rootMargin:'0px 0px 50px 0px'});
 cards.forEach(c=>o.observe(c));
}
function feed(){
 const q=$('search').value.trim().toLocaleLowerCase('id-ID'),cat=$('category-filter').value;
 const publishedList=s.articles.filter(published);
 const items=publishedList.filter(a=>(!cat||a.category===cat)&&(!q||(a.title+' '+a.author_name+' '+a.category+' '+a.body).toLocaleLowerCase('id-ID').includes(q)));
 const lead=(!q&&!cat)?items[0]:null;
 $('featured').innerHTML=lead?featured(lead):'';
 $('feed-grid').innerHTML=(lead?items.slice(1):items).map(card).join('');
 $('feed-empty').hidden=items.length>0;
 $('feed-empty-title').textContent=publishedList.length?'Tidak ada tulisan yang cocok.':'Ruang ini siap menyambut karya pertama.';
 $('feed-empty-text').textContent=publishedList.length?'Coba gunakan kata kunci atau kategori lainnya.':'Belum ada tulisan terbit. Saat Awardee mulai menulis, karya mereka akan langsung hadir di sini untuk dibaca bersama.';
 $('feed-count').textContent=items.length+' tulisan';
 $('portal-total').textContent=publishedList.length.toLocaleString('id-ID');
 $('portal-writers').textContent=(new Set(publishedList.map(a=>a.awardee_id))).size.toLocaleString('id-ID');
 const chips=$('category-chips');chips.innerHTML='<button type="button" class="category-pill'+(!cat?' selected':'')+'" data-category="">Semua tulisan <span>'+publishedList.length+'</span></button>'+G.categories.map(c=>'<button type="button" class="category-pill'+(cat===c?' selected':'')+'" data-category="'+esc(c)+'">'+esc(c)+' <span>'+publishedList.filter(a=>a.category===c).length+'</span></button>').join('');
 animation();
}
function mine(){
 const mine=s.articles.filter(G.own),pub=mine.filter(published);
 $('mine-published').textContent=mine.filter(a=>a.status==='published').length;
 $('mine-drafts').textContent=mine.filter(a=>a.status==='draft').length;
 $('mine-words').textContent=pub.reduce((n,a)=>n+G.words(a.body),0).toLocaleString('id-ID');
 $('mine-list').innerHTML=mine.length?mine.map(a=>{
  const image=G.cover(a),share=published(a);
  return '<article class="mine-item">'+(image?'<img loading="lazy" src="'+esc(image)+'" alt="Sampul '+esc(a.title)+'">':'<span class="mine-placeholder">✎</span>')+
  '<div><span class="kicker">'+esc(a.category)+' · '+(share?'TERBIT':a.status==='draft'?'DRAF':'DISEMBUNYIKAN')+'</span><h3>'+esc(a.title||'Tanpa judul')+'</h3><p>'+esc(G.date(a.updated_at))+' · '+G.words(a.body)+' kata</p></div>'+
  '<div class="mine-actions"><button data-read="'+esc(a.id)+'">Baca</button><button data-edit="'+esc(a.id)+'">Edit</button>'+(share?'<button data-share="'+esc(a.id)+'">Salin tautan ↗</button>':'')+(share?'<button data-hide="'+esc(a.id)+'">Sembunyikan</button>':'')+'<button class="danger" data-delete="'+esc(a.id)+'">Hapus</button></div></article>';
 }).join(''):'<div class="empty-state empty-state-mine"><span class="empty-emblem">✎</span><h3>Setiap penulis punya awal.</h3><p>Mulai tulisan pertamamu. Simpan sebagai draf atau terbitkan langsung.</p><button id="mine-empty-create" class="button primary" type="button">Mulai menulis ↗</button></div>';
}
function read(id){
 const a=s.articles.find(x=>x.id===id);
 if(!a)return G.notice('Tulisan tidak tersedia.',true);
 s.reading=id;
 $('read-category').textContent=a.category;$('read-title').textContent=a.title;
 const desc=G.description(a);$('read-excerpt').textContent=desc;$('read-excerpt').hidden=!desc;
 $('read-byline').textContent='Oleh '+a.author_name+' · '+G.date(a.published_at||a.updated_at)+' · '+Math.max(1,Math.ceil(G.words(a.body)/200))+' menit baca';
 const url=G.cover(a);$('read-cover').hidden=!url;if(url)$('read-cover').src=url;
 $('read-body').innerHTML=G.md(a.body);
 const isPublic=published(a);$('article-link-panel').hidden=!isPublic;
 if(isPublic){$('visit-article').href=G.url(a);$('article-share-url').value=G.url(a)}
 $('edit-from-read').hidden=!G.own(a);
 G.view('article');
}
async function remove(a){
 if(!G.own(a)||!confirm('Hapus tulisan secara permanen? Tindakan ini tidak dapat dibatalkan.'))return;
 try{G.check(await G.sb.from('gagasan_articles').delete().eq('id',a.id).eq('awardee_id',s.member));if(a.cover_path)await G.sb.storage.from('gagasan-covers').remove([a.cover_path]);await G.refresh();G.notice('Tulisan dihapus.')}
 catch(e){G.notice('Gagal menghapus: '+e.message,true)}
}
async function hide(a){
 if(!G.own(a)||!confirm('Sembunyikan tulisan dari publik? Link artikel akan dinonaktifkan.'))return;
 try{G.check(await G.sb.from('gagasan_articles').update({status:'hidden',share_enabled:false}).eq('id',a.id).eq('awardee_id',s.member));await G.refresh();G.notice('Tulisan telah disembunyikan.')}
 catch(e){G.notice('Gagal menyembunyikan: '+e.message,true)}
}
function delegate(e){
 const b=e.target.closest('[data-read],[data-share],[data-edit],[data-hide],[data-delete]');
 if(!b)return;
 const id=b.dataset.read||b.dataset.share||b.dataset.edit||b.dataset.hide||b.dataset.delete;
 const a=s.articles.find(x=>x.id===id);if(!a)return;
 if(b.dataset.read)read(id);
 else if(b.dataset.share)G.copy(a);
 else if(b.dataset.edit)window.GGEditor.open(a);
 else if(b.dataset.hide)hide(a);
 else if(b.dataset.delete)remove(a);
}
window.GGFeed={draw:()=>{feed();mine()},feed,mine,read};
['feed-grid','featured','mine-list'].forEach(id=>$(id).addEventListener('click',delegate));
$('category-chips').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;$('category-filter').value=b.dataset.category;feed()});
$('search').addEventListener('input',feed);$('category-filter').addEventListener('change',feed);
$('read-back').addEventListener('click',()=>G.view('feed'));
$('empty-reload').addEventListener('click',()=>G.refresh().catch(e=>G.notice('Tidak dapat memuat artikel: '+e.message,true)));
$('share-article').addEventListener('click',()=>{const a=s.articles.find(x=>x.id===s.reading);if(a)G.copy(a)});
$('edit-from-read').addEventListener('click',()=>{const a=s.articles.find(x=>x.id===s.reading);if(a)window.GGEditor.open(a)});
$('mine-list').addEventListener('click',e=>{if(e.target.id==='mine-empty-create')window.GGEditor.open()});
document.addEventListener('pointermove',e=>{const c=e.target.closest('.article-card,.spotlight-card');if(!c)return;const rect=c.getBoundingClientRect();c.style.setProperty('--cursor-x',Math.round(e.clientX-rect.left)+'px');c.style.setProperty('--cursor-y',Math.round(e.clientY-rect.top)+'px')},{passive:true});
})();