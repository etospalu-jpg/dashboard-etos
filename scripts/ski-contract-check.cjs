// SKI private workspace: build-time contract and security regression checks.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const s=p=>fs.readFileSync(p,'utf8');
const ui=s('app-ski.js'),api=s('ski-handler.js'),cron=s('ski-weekly-handler.js'),html=s('index.html');
for(const f of ['app-ski.js','ski-handler.js','ski-weekly-handler.js','api/secure.js','api/system.js'])assert.doesNotThrow(()=>new Function(s(f)),f+' contains syntax error');
assert.match(html,/app-ski\.js/);assert.match(html,/app-ski\.css/);assert.match(ui,/SKI Saya · Privat/);
assert.match(ui,/2026-2/);assert.match(ui,/2027-1/);
const s26=ui.slice(ui.indexOf("'2026-2':["),ui.indexOf("'2027-1':["));
const s27=ui.slice(ui.indexOf("'2027-1':["),ui.indexOf("const reportKinds"));
function weights(t){return [...t.matchAll(/^\['[a-z_]+','[^']+',(\d+),/gm)].map(m=>Number(m[1]))}
assert.equal(weights(s26).length,11,'11 SKI 2026 indicators');assert.equal(weights(s27).length,14,'14 SKI 2027 indicators');
assert.equal(weights(s26).reduce((a,b)=>a+b,0),100);assert.equal(weights(s27).reduce((a,b)=>a+b,0),100);
assert.match(api,/session\.originAllowed\(req\)/);assert.match(api,/session\.verify\(req\)/);assert.match(api,/authorized\(req,owner\)/);
assert.match(api,/crypto\.scryptSync/);assert.match(api,/HttpOnly; Secure; SameSite=Strict/);
assert.match(api,/\['terkirim','terverifikasi'\]/);
assert.match(cron,/process\.env\.CRON_SECRET/);assert.match(cron,/achievements_imported:0/);
const config=JSON.parse(s('vercel.json'));assert.ok(config.crons.some(x=>x.path==='/ski-weekly-check'&&x.schedule==='0 0 * * 1'));
assert.ok(config.rewrites.some(x=>x.source==='/ski-weekly-check'&&x.destination==='/api/system?skiWeekly=1'));
assert.ok(require('node:fs').readdirSync('api').filter(x=>x.endsWith('.js')).length<=12,'Vercel Hobby allows 12 API functions');
assert.match(s('api/secure.js'),/skiPrivate/);assert.match(s('api/system.js'),/skiWeekly/);
console.log('ETOS SKI PRIVATE WORKSPACE SECURITY + CONTRACT: PASS');