/* Ruang Gagasan foundation: Supabase session, safe text, navigation. */
(()=>{'use strict';
const S='https://weklmapqizeldfdalbgs.supabase.co',K='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const $=id=>document.getElementById(id);
const client=window.supabase.createClient(S,K,{auth:{storageKey:'etos-readmap-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const G={sb:client,$,s:{user:null,member:null,name:'Awardee',articles:[],editing:null,reading:null,view:'feed',file:null,saving:false},publicBase:'https://dashboard.etosidpalu.com/tulisan',categories:['Opini','Esai','Resensi Buku','Refleksi','Gagasan & Inovasi','Artikel Ilmiah Populer']};
G.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
G.words=s=>String(s||'').trim().split(/\s+/).filter(Boolean).length;
G.slug=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,86)||'tulisan';
G.url=a=>G.publicBase+'/'+a.id+'-'+G.slug(a.title);
G.own=a=>!!G.s.member&&a.awardee_id===G.s.member;
G.cover=a=>a.cover_path?client.storage.from('gagasan-covers').getPublicUrl(a.cover_path).data.publicUrl:null;
G.date=v=>v?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Makassar'}).format(new Date(v)):'Belum terbit';
G.check=r=>{if(r.error)throw r.error;return r.data};
G.notice=(text,problem=false)=>{const n=$('toast');n.textContent=String(text);n.className='notice-stack'+(problem?' error':'');n.hidden=false;clearTimeout(G.timer);G.timer=setTimeout(()=>n.hidden=true,5500)};
G.md=text=>{
 const lines=String(text||'').replace(/\r/g,'').split('\n'),out=[];let para=[],list=[];
 const inline=s=>G.esc(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^\w])\*([^*\n]+)\*/g,'$1<em>$2</em>');
 const flush=()=>{if(para.length){out.push('<p>'+inline(para.join(' '))+'</p>');para=[]}if(list.length){out.push('<ul>'+list.map(x=>'<li>'+inline(x)+'</li>').join('')+'</ul>');list=[]}};
 for(const raw of lines){const s=raw.trim();if(!s){flush();continue}if(s.startsWith('## ')){flush();out.push('<h2>'+inline(s.slice(3))+'</h2>')}else if(s.startsWith('> ')){flush();out.push('<blockquote>'+inline(s.slice(2))+'</blockquote>')}else if(/^[-*] /.test(s)){if(para.length)flush();list.push(s.slice(2))}else{if(list.length)flush();para.push(s)}}
 flush();return out.join('\n')
};
G.view=id=>{G.s.view=id;$('intro').hidden=id!=='feed';['feed','mine','editor','article'].forEach(k=>$(k+'-view').hidden=k!==id);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('nav-active',b.dataset.view===id));window.scrollTo({top:0,behavior:'instant'})};
G.copy=async a=>{const link=G.url(a);try{await navigator.clipboard.writeText(link);G.notice('Link disalin. Bagikan melalui WhatsApp!')}catch{window.prompt('Salin link:',link)}};
G.refresh=async()=>{const res=await client.from('gagasan_articles').select('id,awardee_id,author_name,title,slug,excerpt,body,category,cover_path,status,share_enabled,published_at,created_at,updated_at').order('created_at',{ascending:false}).limit(1000);G.s.articles=G.check(res)||[];window.GGFeed?.draw()};
G.boot=async()=>{let user=null;try{user=(await client.auth.getUser()).data?.user}catch(e){}G.s.user=user;G.s.member=null;
 if(user){try{const membership=G.check(await client.from('readmap_memberships').select('awardee_id').eq('user_id',user.id).maybeSingle());if(membership?.awardee_id){G.s.member=membership.awardee_id;const a=await client.from('awardees').select('name').eq('id',G.s.member).maybeSingle();G.s.name=a.data?.name||'Awardee';await G.refresh()}}catch(e){G.notice('Akun belum bisa membuka Ruang Gagasan: '+e.message,true)}}
 $('login-panel').hidden=!!G.s.member;$('workspace').hidden=!G.s.member;$('logout').hidden=!G.s.member;$('account-name').textContent=G.s.member?G.s.name:'Ruang Awardee';if(G.s.member)G.view('feed');
};
window.GG=G;
})();