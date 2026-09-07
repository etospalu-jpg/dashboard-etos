'use strict';
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..');
const SKIP=new Set(['node_modules','.git']);
const failures=[];
function walk(dir){const out=[];for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(SKIP.has(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())out.push(...walk(p));else out.push(p)}return out}
function rel(p){return path.relative(ROOT,p).replaceAll('\\','/')}
function fail(msg){failures.push(msg);console.error('✗',msg)}
function ok(msg){console.log('✓',msg)}

const files=walk(ROOT),jsFiles=files.filter(p=>p.endsWith('.js'));
for(const file of jsFiles){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)fail(`Syntax JS: ${rel(file)}\n${(r.stderr||r.stdout||'').trim()}`)}
if(!failures.length)ok(`${jsFiles.length} file JavaScript lolos syntax check`);
for(const name of ['vercel.json','data-audit-manifest.json','awardee-authority.json','public-snapshot.min.json']){const file=path.join(ROOT,name);if(!fs.existsSync(file)){fail(`File wajib tidak ditemukan: ${name}`);continue}try{JSON.parse(fs.readFileSync(file,'utf8'));ok(`JSON valid: ${name}`)}catch(e){fail(`JSON tidak valid: ${name} — ${e.message}`)}}

const required=['index.html','shell.html','app.css','app-layout.css','supabase-adapter.js','app-core.js','app-public.js','app-secure.js','app-admin.js','app-360.js','app-system.js','app-data-center.js','app-access.js','app-access-control.js','app-auth-rbac.js','data-center-rbac.js','api/system.js','api/data-center.js','api/access-control.js','api/auth-bridge.js','api/awardee360.js','api/idp-live.js','server-session.js','pin-login-cookie.js'];
for(const name of required){if(!fs.existsSync(path.join(ROOT,name)))fail(`Asset production hilang: ${name}`)}
if(required.every(name=>fs.existsSync(path.join(ROOT,name))))ok(`${required.length} asset production tersedia`);

try{const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');for(const token of ['etos-build','app-data-center','app-system','app-access','app-access-control','app-auth-rbac','etos-booting'])if(!index.includes(token))fail(`index.html kehilangan marker/module: ${token}`);if(!failures.some(x=>x.includes('index.html')))ok('Boot/module markers index.html lengkap')}catch(e){fail(`index.html tidak dapat diperiksa: ${e.message}`)}
try{const auth=fs.readFileSync(path.join(ROOT,'app-auth-rbac.js'),'utf8');for(const token of ['signInWithPassword','invite-password-modal','submitInvitePassword','etos-rbac-auth-v1'])if(!auth.includes(token))fail(`Auth/RBAC kehilangan marker: ${token}`);if(!failures.some(x=>x.includes('Auth/RBAC')))ok('Auth/RBAC markers lengkap')}catch(e){fail(`app-auth-rbac.js tidak dapat diperiksa: ${e.message}`)}
try{const ac=fs.readFileSync(path.join(ROOT,'api/access-control.js'),'utf8');for(const token of ['inviteUserByEmail','access_control_invite','activation_required'])if(!ac.includes(token))fail(`Access Control backend kehilangan marker: ${token}`);if(!failures.some(x=>x.includes('Access Control backend')))ok('Access Control invitation markers lengkap')}catch(e){fail(`api/access-control.js tidak dapat diperiksa: ${e.message}`)}
try{const access=fs.readFileSync(path.join(ROOT,'app-access.js'),'utf8');if(access.includes("'/api/attendance-cutover'")||access.includes('"/api/attendance-cutover"'))fail('Frontend tidak boleh memanggil attendance-cutover yang sudah retired.');if(!access.includes("credentials:'include'"))fail('app-access.js harus memakai cookie credentials untuk server session.');else ok('Attendance cutover retired dan cookie session guard aktif')}catch(e){fail(`app-access.js tidak dapat diperiksa: ${e.message}`)}
try{const idp=fs.readFileSync(path.join(ROOT,'api/idp-live.js'),'utf8');for(const token of ["require('../server-session')",'session.credential(req)','superadmin','facilitator'])if(!idp.includes(token))fail(`IDP RBAC kehilangan marker: ${token}`);if(!failures.some(x=>x.includes('IDP RBAC')))ok('IDP server menggunakan unified RBAC session')}catch(e){fail(`api/idp-live.js tidak dapat diperiksa: ${e.message}`)}
try{const a360=fs.readFileSync(path.join(ROOT,'api/awardee360.js'),'utf8');for(const token of ['hidden_sections','privateOps','development'])if(!a360.includes(token))fail(`Awardee360 RBAC kehilangan marker: ${token}`);if(!failures.some(x=>x.includes('Awardee360 RBAC')))ok('Awardee360 role-aware markers lengkap')}catch(e){fail(`api/awardee360.js tidak dapat diperiksa: ${e.message}`)}

if(failures.length){console.error(`\nQuality gate GAGAL: ${failures.length} masalah.`);process.exit(1)}
console.log('\nETOS quality gate LULUS.');
