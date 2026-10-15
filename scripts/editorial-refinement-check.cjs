'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const portal=read('gagasan.html'),home=read('readmap.html'),admin=read('readmap-admin.html'),shell=read('shell.html');
function uniqueIds(html,file){
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length,'Duplicate element ID in '+file);
}
uniqueIds(portal,'gagasan.html');uniqueIds(home,'readmap.html');
assert(!portal.includes('Gagasan tumbuh.'),'Promotional hero still shown');
assert(portal.includes('class="editorial-masthead"'),'Missing concise editorial masthead');
assert(portal.indexOf('id="featured"')<portal.indexOf('id="search"'),'Feature article must precede archive search');
assert(portal.includes('/gagasan-editorial-v3.css?v='),'Editorial stylesheet not loaded');
assert(read('gagasan-editorial-v3.css').includes('.editorial-feed .featured-card'),'Editorial image-first hero CSS absent');
for(const id of ['create-cta','explore-cta','portal-total','portal-writers','category-chips','featured','feed-grid','feed-count']){
 assert(portal.includes('id="'+id+'"'),'Missing editorial interactive control '+id);
}
assert(home.indexOf('id="readmap-hero"')>home.indexOf('id="workspace"'),'Hero must be inside Awardee workspace');
assert(home.indexOf('id="readmap-personal"')>home.indexOf('id="readmap-hero"'),'Personal snapshot must be inside hero');
assert.equal((home.match(/id="awardee-first-name"/g)||[]).length,1,'Repeated welcome headline');
assert(!home.includes('class="welcome"'),'Second generic greeting exists');
assert(home.includes('class="quick-actions" hidden'),'Duplicated quick actions still visible');
assert(home.includes('/readmap-refined.css?v='),'Readmap refined CSS not loaded');
assert(!read('readmap-refined.css').includes('.metric{content:"★"'),'Decorative metric icons present');
assert(home.includes('id="stats"')&&home.includes('id="hero-book"')&&home.includes('id="hero-video"'),'Existing book/video actions must survive');
assert(home.includes('id="enter-demo"')&&home.includes('id="demo-banner"'),'Demo flow removed');
assert(home.includes('id="readmap-personal"')&&home.includes('href="/profil-awardee.html"'),'Private profile access removed');
for(const file of ['readmap.html','readmap.js','shell.html','readmap-admin.html','readmap-admin.js','app-auth-rbac.js']){
 assert(!/Etoser/i.test(read(file).replace(/top-etoser-entry/g,'')),'User-visible Etoser in '+file);
}
for(const file of ['gagasan-feed.js','readmap.js','awardee-services.js','readmap-personal.js','readmap-admin.js','app-auth-rbac.js']){
 new vm.Script(read(file),{filename:file});
}
assert(read('gagasan-foundation.js').includes('dashboard.etosidpalu.com/tulisan'),'Public sharing domain changed');
console.log('ETOS editorial / Awardee UI refinement contracts: PASS');