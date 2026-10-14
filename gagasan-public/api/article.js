'use strict';
/* Public single-article HTML: server-rendered OG tags for WhatsApp and other bots. */
const URL_SB='https://weklmapqizeldfdalbgs.supabase.co',KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const DASHBOARD='https://dashboard.etosidpalu.com/gagasan.html';
const ARTICLE_ORIGIN='https://dashboard.etosidpalu.com/tulisan/';
const ETOS_LOGO='https://dashboard.etosidpalu.com/brand-etos-white.svg?v=38';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const inline=s=>esc(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^\w])\*([^*\n]+)\*/g,'$1<em>$2</em>');
function markdown(text){
 const lines=String(text||'').replace(/\r/g,'').split('\n'),out=[];let paragraph=[],list=[];
 function flush(){if(paragraph.length){out.push('<p>'+inline(paragraph.join(' '))+'</p>');paragraph=[]}if(list.length){out.push('<ul>'+list.map(x=>'<li>'+inline(x)+'</li>').join('')+'</ul>');list=[]}}
 for(const raw of lines){const x=raw.trim();if(!x){flush();continue}
 if(x.startsWith('## ')){flush();out.push('<h2>'+inline(x.slice(3))+'</h2>')}
 else if(x.startsWith('> ')){flush();out.push('<blockquote>'+inline(x.slice(2))+'</blockquote>')}
 else if(/^[-*] /.test(x)){if(paragraph.length)flush();list.push(x.slice(2))}
 else{if(list.length)flush();paragraph.push(x)}}
 flush();return out.join('\n');
}
function page({title,head,body,status=200}){
 return {status,html:'<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#142d46"><title>'+esc(title)+'</title>'+head+'<link rel="icon" href="'+DASHBOARD.replace('/gagasan.html','/favicon.svg')+'"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://dashboard.etosidpalu.com/gagasan-reader.css?v=3"></head><body><header class="top"><a class="brand" href="'+DASHBOARD+'"><img class="brand-logo" src="'+ETOS_LOGO+'" alt="Logo resmi ETOS ID putih"><span>RUANG GAGASAN<em>.</em><small>PORTAL KARYA AWARDEE · ETOS ID PALU</small></span></a><a class="top-back" href="'+DASHBOARD+'">Kumpulan tulisan ↗</a></header>'+body+'<footer><div><strong>RUANG GAGASAN<em>.</em></strong><small>Menulis, berpikir, bertumbuh. · ETOS ID Palu</small></div><a href="'+DASHBOARD+'">Kembali ke Ruang Awardee ↗</a></footer></body></html>'};
}
function notFound(){
 return page({status:404,title:'Tulisan Tidak Tersedia — Ruang Gagasan',head:'<meta name="robots" content="noindex,nofollow">',body:'<main class="notfound"><div class="mark">ETOS</div><h1>Tulisan ini tidak tersedia.</h1><p>Link mungkin salah, tulisan telah disembunyikan, atau belum diterbitkan.</p><a class="button" href="'+DASHBOARD+'">Kembali ke Ruang Gagasan ↗</a></main>'});
}
function author(a){const title=a.title,desc=String(a.excerpt||a.body||'').replace(/^\s*(?:##|>|[-*])\s+/gm,'').replace(/\*+/g,'').replace(/\s+/g,' ').trim().slice(0,190),authorName=a.author_name,fullDate=a.published_at||a.created_at;
 const date=new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Makassar'}).format(new Date(fullDate));
 const mins=Math.max(1,Math.ceil(String(a.body).trim().split(/\s+/).length/200));
 let cover='';
 if(typeof a.cover_path==='string'&&/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i.test(a.cover_path))cover=URL_SB+'/storage/v1/object/public/gagasan-covers/'+a.cover_path;
 return {title,desc,authorName,date,mins,cover};
}
module.exports=async function handler(req,res){
 if(req.method!=='GET'){res.statusCode=405;res.end('Metode tidak diizinkan');return}
 let code=String(req.query?.ref||''),id=code.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-|$)/i)?.[1]||null;
 let result=null;
 if(!id)result=notFound();
 else {
  try{
   const query=new URL(URL_SB+'/rest/v1/gagasan_articles');
   query.searchParams.set('select','id,title,excerpt,body,author_name,category,cover_path,status,share_enabled,published_at,created_at');
   query.searchParams.set('id','eq.'+id);query.searchParams.set('status','eq.published');query.searchParams.set('share_enabled','eq.true');
   query.searchParams.set('limit','1');
   const r=await fetch(query.toString(),{headers:{apikey:KEY,accept:'application/json'},signal:AbortSignal.timeout(7000)});
   if(!r.ok)throw Error('Public article lookup failed');
   const rows=await r.json(),a=rows?.[0];
   if(!a)result=notFound();
   else{
    const data=author(a),canonical=ARTICLE_ORIGIN+a.id;
    const meta='<meta name="description" content="'+esc(data.desc)+'"><meta name="robots" content="noindex,nofollow"><link rel="canonical" href="'+canonical+'">'+
     '<meta property="og:type" content="article"><meta property="og:site_name" content="Ruang Gagasan · ETOS ID Palu"><meta property="og:locale" content="id_ID">'+
     '<meta property="og:title" content="'+esc(data.title)+'"><meta property="og:description" content="'+esc(data.desc)+'"><meta property="og:url" content="'+canonical+'">'+
     (data.cover?'<meta property="og:image" content="'+esc(data.cover)+'"><meta property="og:image:secure_url" content="'+esc(data.cover)+'"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">':'')+
     '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+esc(data.title)+'"><meta name="twitter:description" content="'+esc(data.desc)+'">'+(data.cover?'<meta name="twitter:image" content="'+esc(data.cover)+'"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:alt" content="Sampul '+esc(data.title)+'">':'');
    const link=ARTICLE_ORIGIN+a.id;
    const wa='https://wa.me/?text='+encodeURIComponent(a.title+' — '+link);
    result=page({title:a.title+' — Ruang Gagasan ETOS ID Palu',head:meta,body:'<main class="reader"><p class="eyebrow">RUANG GAGASAN / '+esc(a.category)+'</p><h1>'+esc(a.title)+'</h1><p class="deck">'+esc(data.desc)+'</p><div class="byline"><div class="avatar">ET</div><div><strong>'+esc(data.authorName)+'</strong><span>Awardee ETOS ID Palu · '+esc(data.date)+' · '+data.mins+' menit baca</span></div></div>'+(data.cover?'<figure><img src="'+esc(data.cover)+'" width="1200" height="630" alt="Sampul artikel '+esc(a.title)+'"></figure>':'')+'<div class="body-copy">'+markdown(a.body)+'</div><div class="ending"><div class="end-mark">✦</div><p>Setiap pemikiran punya ruang untuk bertumbuh.</p><div class="actions"><a href="'+wa+'" target="_blank" rel="noopener noreferrer">Bagikan ke WhatsApp ↗</a><button type="button" id="copy-url">Salin link</button></div></div></main><script>document.getElementById("copy-url").onclick=async()=>{try{await navigator.clipboard.writeText(location.href);document.getElementById("copy-url").textContent="Tautan disalin ✓"}catch(e){window.prompt("Salin tautan",location.href)}}</script>'});
   }
  }catch(error){console.error('[gagasan public]',String(error.message||'Error').slice(0,90));result=page({status:503,title:'Layanan sementara tidak tersedia',head:'<meta name="robots" content="noindex">',body:'<main class="notfound"><h1>Artikel belum dapat dimuat.</h1><p>Silakan coba lagi beberapa saat.</p><a class="button" href="'+DASHBOARD+'">Kembali ke Ruang Gagasan ↗</a></main>'})}
 }
 res.statusCode=result.status;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=60');res.end(result.html)
};