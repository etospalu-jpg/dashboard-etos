'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const source=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const html=source('gagasan.html'),admin=source('readmap-admin.html'),publicCode=source('gagasan-public/api/article.js');
for(const file of ['gagasan-foundation.js','gagasan-feed.js','gagasan-covers.js','gagasan-editor.js','gagasan-admin.js','gagasan-public/api/article.js','ops/readmap-admin-handler.js'])new vm.Script(source(file),{filename:file});
assert(html.includes('id="article-import"'),'DOCX/TXT import control missing');
assert(html.includes('mammoth@1.13.0'),'Pinned DOCX importer missing');
for(const id of ['login-form','login-backdrop','login-close','author-login','feed-grid','featured','category-chips','portal-total','portal-writers','feed-count','article-form','save-draft','publish-article','cover-preview-box','cover-preview-image','cover-output-info','article-cover','mine-list','read-title','share-article','article-share-url','article-link-panel','visit-article'])assert(html.includes('id="'+id+'"'),'Missing UI '+id);
for(const file of ['gagasan-foundation.js','gagasan-feed.js','gagasan-covers.js','gagasan-editor.js'])assert(html.includes('/'+file+'?v='),'Missing script '+file);
for(const id of ['gagasan-period','gagasan-stats','gagasan-authors','gagasan-articles'])assert(admin.includes('id="'+id+'"'),'Missing admin UI '+id);
assert(source('readmap.html').includes('href="/gagasan.html"'),'Not linked from Ruang Awardee');
assert(source('gagasan-covers.js').includes('400*1024'),'Compression budget missing');
assert(publicCode.includes('property="og:image"'),'WhatsApp OG image not present');
assert(publicCode.includes('property="og:title"'),'WhatsApp OG title missing');
assert(publicCode.includes('name="robots" content="noindex,nofollow"'),'Unlisted public article indexing policy missing');
assert(publicCode.includes('esc(a.title)'),'Article title must be HTML-escaped');
assert(source('ops/readmap-admin-handler.js').includes("action==='gagasanReport'"),'Admin reporting API missing');
assert(source('ops/readmap-admin-handler.js').includes("action==='gagasanUpdate'"),'Admin edit API missing');
assert(source('gagasan-editor.js').includes("status==='published'"),'Publish flow missing');
assert(source('gagasan-foundation.js').includes("storageKey:'etos-readmap-auth-v1'"),'Awardee session mismatch');
assert(source('gagasan.html').includes('/brand-etos-white.svg'),'Official logo missing in Ruang Gagasan');
assert(source('gagasan-public/api/article.js').includes('ETOS_LOGO'),'Official logo missing in public reader');
assert(source('gagasan-foundation.js').includes('dashboard.etosidpalu.com/tulisan'),'Wrong share domain');
assert(source('gagasan-admin.js').includes('dashboard.etosidpalu.com/tulisan'),'Wrong admin share domain');
assert(source('gagasan-foundation.js').includes("G.url=a=>G.publicBase+'/'+a.id"),'Share URL must not add old /t/ segment');
assert(JSON.parse(source('vercel.json')).rewrites.some(x=>x.source==='/tulisan/:ref'&&x.destination==='/api/public-attendance?ref=:ref'),'Unified same-project article route missing');
assert(source('api/public-attendance.js').includes("if(req.method==='GET'&&typeof req.query?.ref==='string')return articlePage(req,res)"),'Article must reuse public Vercel function');
assert(!source('vercel.json').includes('gagasan-etos-palu.vercel.app'),'External project still referenced by dashboard routing');
assert(source('index.html').includes("cache:'no-store'"),'Shell must bypass stale browser cache');
assert(source('sw.js').includes("url.pathname==='/shell.html'"),'Service worker must use network-first for shell');
assert(source('shell.html').includes('Masuk sebagai Awardee'),'Official Awardee entrance not fixed');
assert(source('gagasan-reader.css').includes('.brand-logo'),'Reader styles missing');

assert(!html.includes('id="article-excerpt"'),'Awardee must not fill in a manual summary');
assert(source('gagasan-editor.js').includes('const excerpt=G.plain(body).slice(0,320)'),'Article description must be generated automatically');
assert(source('gagasan-foundation.js').includes("$('workspace').hidden=false"),'Visitors must always see public articles without signing in');
assert(source('gagasan-foundation.js').includes("G.refresh()"),'Public feed should fetch anonymously');
assert(source('gagasan-feed.js').includes("data-share="),'Every published article card must offer share action');
assert(source('gagasan-feed.js').includes("$('article-link-panel').hidden=!isPublic"),'Link must be visible after publication');
assert(source('gagasan-feed.js').includes('category-chips'),'Public category filters missing');
assert(source('gagasan-covers.js').includes('const fit=Math.min(1200/img.width,630/img.height)'),'Cover must preserve full image instead of cropping it');
assert(source('gagasan-covers.js').includes('cache.blob'),'Upload must reuse the same file as preview');
assert(source('gagasan-covers.js').includes('1200 × 630'),'Accurate preview dimensions must be visible');
assert(!source('gagasan-public/api/article.js').includes("Authorization:'Bearer '+KEY"),'Publishable key must be passed only through apikey, not Bearer');
assert(source('ops/readmap-admin-handler.js').includes("const excerpt=body.replace("),'Admin summary should be computed from body');
assert(source('gagasan-portal-v2.css').includes('prefers-reduced-motion'),'Respect reduced-motion settings');
assert(source('gagasan-portal-v2.css').includes('.login-backdrop'),'Login must be a modal, not the default page');
assert(html.includes('/gagasan-portal-v2.css?v=1'),'New portal stylesheet not loaded');


const configuration=JSON.parse(source('gagasan-public/vercel.json'));
assert(configuration.rewrites.some(x=>x.source==='/t/:ref'),'Dynamic article rewrite missing');
(async()=>{
 const handler=require(path.join(ROOT,'gagasan-public/api/article.js')),originalFetch=global.fetch;
 const id='11111111-2222-4333-8444-555555555555';
 const malicious='<img src=x onerror=alert(1)>';
 const fake={id,title:malicious+' Uji Tulisan',excerpt:'Tulisan tentang budaya literasi.',body:'## Isi\n\n'+malicious,author_name:'Contoh Penulis',category:'Opini',cover_path:'11111111-2222-4333-8444-555555555555/22222222-3333-4444-8555-666666666666.jpg',status:'published',share_enabled:true,published_at:'2026-10-15T10:00:00Z'};
 global.fetch=async()=>({ok:true,json:async()=>[fake]});
 function makeRes(){return{statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=body}}}
 try{
  const res=makeRes();await handler({method:'GET',query:{ref:id+'-uji-tulisan'}},res);
  assert.equal(res.statusCode,200);assert(res.body.includes('og:image'));assert(res.body.includes('&lt;img src=x onerror=alert(1)&gt;'));assert(!res.body.includes('<img src=x onerror=alert(1)>'));
  const other=makeRes();await handler({method:'GET',query:{ref:'invalid'}},other);assert.equal(other.statusCode,404);
  console.log('RUANG GAGASAN V2: public reading, optional login, auto summary, compressed image, public link, editorial UI, OG PASS');
 }finally{global.fetch=originalFetch}
})().catch(error=>{console.error(error);process.exitCode=1});
