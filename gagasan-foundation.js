/* Ruang Gagasan v2 — open publication feed with authenticated author workspace. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const client=window.supabase.createClient('https://weklmapqizeldfdalbgs.supabase.co','sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC',{auth:{storageKey:'etos-readmap-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const G={sb:client,$,s:{user:null,member:null,name:'Awardee',articles:[],editing:null,reading:null,view:'feed',saving:false},publicBase:'https://dashboard.etosidpalu.com/tulisan',categories:['Opini','Esai','Resensi Buku','Refleksi','Gagasan & Inovasi','Artikel Ilmiah Populer']};
G.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;',"'" :'&#39;'}[c]));
G.words=s=>String(s||'').trim().split(/\s+/).filter(Boolean).length;
G.slug=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'tulisan';
G.url=a=>G.publicBase+'/'+a.id+'-'+G.slug(a.title);
G.own=a=>!!G.s.member&&a.awardee_id===G.s.member;
G.cover=a=>a.cover_path?client.storage.from('gagasan-covers').getPublicUrl(a.cover_path).data.publicUrl:null;
G.date=v=>v?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Makassar'}).format(new Date(v)):'Belum terbit';
G.check=r=>{if(r.error)throw r.error;return r.data};
G.plain=s=>String(s||'').replace(/^\s*(?:##|>|[-*])\s+/gm,'').replace(/\*+/g,'').replace(/\s+/g,' ').trim();
G.description=a=>G.plain(a.excerpt||a.body).slice(0,180);
G.notice=(content,problem=false)=>{const n=$('toast');n.textContent=String(content);n.className='notice-stack'+(problem?' error':'');n.hidden=false;clearTimeout(G.timer);G.timer=setTimeout(()=>n.hidden=true,5500)};
G.md=text=>{
 const lines=String(text||'').replace(/\r/g,'').split('\n'),out=[];let para=[],list=[];
 const inline=s=>G.esc(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^\w])\*([^*\n]+)\*/g,'$1<em>$2</em>');
 const flush=()=>{if(para.length){out.push('<p>'+inline(para.join(' '))+'</p>');para=[]}if(list.length){out.push('<ul>'+list.map(x=>'<li>'+inline(x)+'</li>').join('')+'</ul>');list=[]}};
 for(const raw of lines){const s=raw.trim();if(!s){flush();continue}if(s.startsWith('## ')){flush();out.push('<h2>'+inline(s.slice(3))+'</h2>')}else if(s.startsWith('> ')){flush();out.push('<blockquote>'+inline(s.slice(2))+'</blockquote>')}else if(/^[-*] /.test(s)){if(para.length)flush();list.push(s.slice(2))}else{if(list.length)flush();para.push(s)}}
 flush();return out.join('\n');
};
G.requireAuthor=action=>{
 if(G.s.member)return action();
 G.authDialog(true);G.notice('Jelajahi tulisan tanpa akun. Masuk hanya untuk menulis atau mengelola karyamu.');return false;
};
G.authDialog=show=>{
 const dialog=$('login-panel'),backdrop=$('login-backdrop');
 dialog.hidden=!show;backdrop.hidden=!show;
 document.body.classList.toggle('dialog-open',show);
 if(show){$('login-username').focus({preventScroll:true})}
 else $('author-login').focus({preventScroll:true});
};
G.view=id=>{
 if((id==='editor'||id==='mine')&&!G.s.member)return G.requireAuthor(()=>{});
 G.s.view=id;
 $('intro').hidden=id!=='feed';
 ['feed','mine','editor','article'].forEach(k=>$(k+'-view').hidden=k!==id);
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('nav-active',b.dataset.view===id);b.setAttribute('aria-current',b.dataset.view===id?'page':'false')});
 if(id==='feed')window.GGFeed?.feed();
 if(id==='mine')window.GGFeed?.mine();
 window.scrollTo({top:0,behavior:'smooth'});
};
G.copy=async a=>{const link=G.url(a);try{await navigator.clipboard.writeText(link);G.notice('Tautan artikel disalin. Bagikan melalui WhatsApp!')}catch{window.prompt('Salin tautan artikel:',link)}};
G.refresh=async()=>{
 const response=await client.from('gagasan_articles').select('id,awardee_id,author_name,title,slug,excerpt,body,category,cover_path,status,share_enabled,published_at,created_at,updated_at').order('published_at',{ascending:false,nullsFirst:false}).limit(1000);
 G.s.articles=G.check(response)||[];
 window.GGFeed?.draw();
};
G.boot=async()=>{
 let user=null;try{user=(await client.auth.getUser()).data?.user||null}catch(_){}
 G.s.user=user;G.s.member=null;G.s.name='Awardee';
 if(user){
  try{
   const row=G.check(await client.from('readmap_memberships').select('awardee_id').eq('user_id',user.id).maybeSingle());
   if(row?.awardee_id){G.s.member=row.awardee_id;const a=await client.from('awardees').select('name').eq('id',row.awardee_id).maybeSingle();G.s.name=a.data?.name||'Awardee'}
  }catch(e){G.notice('Akun belum dapat diverifikasi. Kamu tetap bisa membaca tulisan.',true)}
 }
 $('workspace').hidden=false;
 $('logout').hidden=!G.s.member;$('author-login').hidden=!!G.s.member;
 $('account-name').textContent=G.s.member?G.s.name:'Terbuka untuk umum';
 $('author-login').textContent='Masuk Penulis';
 G.authDialog(false);
 try{await G.refresh()}catch(e){G.s.articles=[];window.GGFeed?.draw();G.notice('Kumpulan tulisan belum bisa dimuat. Coba lagi beberapa saat.',true)}
 G.view('feed');
};
$('author-login').addEventListener('click',()=>G.authDialog(true));
$('login-close').addEventListener('click',()=>G.authDialog(false));
$('login-backdrop').addEventListener('click',()=>G.authDialog(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('login-panel').hidden)G.authDialog(false)});
window.GG=G;
})();