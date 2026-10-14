'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const source=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const html=source('gagasan.html'),admin=source('readmap-admin.html'),publicCode=source('gagasan-public/api/article.js');
for(const file of ['gagasan-foundation.js','gagasan-feed.js','gagasan-covers.js','gagasan-editor.js','gagasan-admin.js','gagasan-public/api/article.js','ops/readmap-admin-handler.js'])new vm.Script(source(file),{filename:file});
assert(html.includes('id="article-import"'),'DOCX/TXT import control missing');
assert(html.includes('mammoth@1.13.0'),'Pinned DOCX importer missing');
for(const id of ['login-form','feed-grid','featured','article-form','save-draft','publish-article','cover-preview-box','article-cover','mine-list','read-title','share-article'])assert(html.includes('id="'+id+'"'),'Missing UI '+id);
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
  console.log('RUANG GAGASAN: UI, auth, safe rendering, WhatsApp OG, route contracts PASS');
 }finally{global.fetch=originalFetch}
})().catch(error=>{console.error(error);process.exitCode=1});
