// Structural smoke tests for ETOS Palu attendance integration.
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
for(const p of ['awardee-attendance.js','readmap-admin-asrama.js','readmap.js','readmap-admin.js','ops/readmap-admin-handler.js']){
 assert.doesNotThrow(()=>new Function(read(p)),p+' must parse as JavaScript');
}
assert.doesNotThrow(()=>new Function(read('integrations/asrama-google-sheets/Code.gs')),'Apps Script must parse');
const html=read('readmap.html'),admin=read('readmap-admin.html'),script=read('readmap.js'),css=read('readmap.css');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(ids.length,new Set(ids).size,'Duplicated DOM IDs in Awardee page');
const used=[...read('awardee-attendance.js').matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);
for(const id of used)assert.ok(ids.includes(id),'Missing attendance UI field: '+id);
assert.match(html,/id="attendance-panel"/);
assert.match(html,/data-mobile-view="attendance"/);
assert.match(html,/id="awardee-first-name"/);
assert.match(html,/src="\/awardee-attendance\.js\?v=38\.10"/);
assert.match(html,/class="welcome"/);
assert.match(css,/\.readmap-app \.welcome\{/);
assert.match(css,/\.readmap-app \.attendance-summary-grid\{/);
assert.match(script,/\['books','videos','services','tahsin','attendance'\]/);
assert.match(admin,/id="asrama-sync-section"/);
assert.match(admin,/readmap-admin-asrama\.js\?v=38\.10/);
assert.match(read('supabase/functions/asrama-sheet-sync/index.ts'),/x-etos-asrama-key/);
assert.match(read('supabase/functions/asrama-sheet-sync/index.ts'),/apply_asrama_sheet_snapshot/);
assert.match(read('integrations/asrama-google-sheets/Code.gs'),/everyMinutes\(5\)/);
assert.doesNotMatch(html,/Etoser|ETOSER|etoser/);
assert.match(read('sw.js'),/VERSION='38\.10'/);
console.log('ETOS asrama integration, Awardee attendance and Apps Script structure: PASS');
