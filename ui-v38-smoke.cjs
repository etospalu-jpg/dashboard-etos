// ETOS UI V38: static contract checks before publishing.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
for(const file of ['shell.html','readmap.html','readmap-admin.html','tahsin-reflection.html']){
 const s=read(file),ids=[...s.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'Duplicate element IDs in '+file);
 assert.match(s,/brand-etos-white\.svg/,'White official ETOS logo missing in '+file);
 assert.doesNotMatch(s,/src="\/brand-etos\.svg"/,'Legacy logo still visible in '+file);
}
const shell=read('shell.html'),appCss=read('etos-workspace-v37.css'),memberCss=read('readmap.css');
assert.match(shell,/id="page-title" class="etos-accessible-page-title"/);
assert.match(appCss,/#main-app #page-title\.etos-accessible-page-title\{position:absolute!important/);
assert.match(appCss,/\.etos-app-header\.topbar\{\s*display:flex!important/);
assert.match(appCss,/\.bo-hero\{background:linear-gradient\(/);
assert.doesNotMatch(shell,/#0f6248|#0b1b15|#071b13/);
assert.doesNotMatch(read('app-v369-backoffice.js'),/#0f6248|#071b13|#69d391/);
assert.doesNotMatch(memberCss,/#0f6248|#071b13|#0b1b15/);
assert.match(read('sw.js'),/VERSION='38\.0'/);
assert.match(read('index.html'),/const V='38\.0'/);
assert.match(read('favicon.svg'),/fill="#142c49"/);
assert.match(read('pwa-icon.svg'),/fill="#142c49"/);
for(const file of ['app-core.js','app-public.js','app-polish.js','app-attendance-settings.js','app-attendance-detail.js','app-facilitator-intelligence.js','app-v369-backoffice.js','app-system.js','app-branding.js','app-mentoring-journal.js','readmap.js','readmap-admin.js']){
 try{new Function(read(file))}catch(err){throw new Error(file+': '+err.message)}
}
console.log('ETOS V38 UI and JavaScript contract checks: PASS');
