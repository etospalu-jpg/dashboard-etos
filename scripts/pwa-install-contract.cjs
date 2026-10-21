'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.display,'standalone');
assert.equal(manifest.start_url,'/');
assert.equal(manifest.prefer_related_applications,false);
for(const size of [192,512]){
 const match=manifest.icons.find(x=>x.sizes===size+'x'+size&&x.type==='image/png');
 assert.ok(match,'Chrome requires PNG icon '+size);
 const filename='public'+match.src;
 const buf=fs.readFileSync(path.join(root,filename));
 assert.ok(buf.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),'Invalid PNG '+filename);
 assert.equal(buf.readUInt32BE(16),size,'PNG width');
 assert.equal(buf.readUInt32BE(20),size,'PNG height');
}
const page=read('index.html');
assert.match(page,/rel="manifest"/);
assert.match(page,/app-pwa\.js\?v=38\.12/);
assert.match(page,/app-etos23-monitor\.js/);
assert.match(page,/app-tahfidz-2026\.css\?v=38\.12/);
assert.match(read('sw.js'),/const VERSION='38\.12'/);
const pwa=read('app-pwa.js');
assert.doesNotMatch(pwa,/preventDefault\s*\(/,'Native Chrome install prompt may not be intercepted');
assert.match(pwa,/serviceWorker\.register\('\/sw\.js'/);
const css=read('app-tahfidz-2026.css');assert.match(css,/linear-gradient\(120deg,#142c49,#234b80\)/);
assert.doesNotMatch(css,/#0a6057|#0a7767|#11856c/);
for(const p of ['app-keislaman.js','app-etos23-monitor.js','etos23-report-handler.js','api/public-attendance.js','app-pwa.js'])
 new vm.Script(read(p),{filename:p});
assert.match(read('app-keislaman.js'),/kajianLink/);
assert.match(read('app-keislaman.js'),/ki-etos23-root/);
const edge=read('etos23-report-handler.js');
assert.match(edge,/session\.verify\(req\)/);
assert.match(edge,/session\.originAllowed\(req\)/);
assert.match(edge,/\.directFetch\(UPSTREAM/);
assert.match(read('api/public-attendance.js'),/etos23_report/);
const apiCount=fs.readdirSync(path.join(root,'api')).filter(f=>f.endsWith('.js')).length;
assert.ok(apiCount<=12,'Hobby cap violated');
console.log('ETOS v38.12 PWA native installability, navy Tahfidz, Kajian links, ETOS23 read-only contract PASS');
