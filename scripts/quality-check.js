'use strict';
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..');
const SKIP=new Set(['node_modules','.git']);
const failures=[];
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
function walk(dir){const out=[];for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(SKIP.has(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())out.push(...walk(p));else out.push(p)}return out}
function rel(p){return path.relative(ROOT,p).replaceAll('\\','/')}
function fail(msg){failures.push(msg);console.error('✗',msg)}
function ok(msg){console.log('✓',msg)}
function expect(text,tokens,label){for(const token of tokens)if(!text.includes(token))fail(`${label} kehilangan marker: ${token}`)}

const files=walk(ROOT),jsFiles=files.filter(p=>p.endsWith('.js'));
for(const file of jsFiles){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)fail(`Syntax JS: ${rel(file)}\n${(r.stderr||r.stdout||'').trim()}`)}
if(!failures.length)ok(`${jsFiles.length} file JavaScript lolos syntax check`);

for(const name of ['vercel.json','package.json','data-audit-manifest.json','awardee-authority.json','public-snapshot.min.json']){const file=path.join(ROOT,name);if(!fs.existsSync(file)){fail(`File wajib tidak ditemukan: ${name}`);continue}try{JSON.parse(fs.readFileSync(file,'utf8'));ok(`JSON valid: ${name}`)}catch(e){fail(`JSON tidak valid: ${name} — ${e.message}`)}}

const required=['index.html','shell.html','app.css','app-layout.css','supabase-adapter.js','app-core.js','app-public.js','app-secure.js','app-admin.js','app-360.js','app-system.js','app-system-health.js','app-data-center.js','app-access.js','app-access-control.js','app-auth-recovery.js','app-auth-rbac.js','app-auth-mfa.js','app-mentoring-journal.js','app-mentoring-cases.js','app-attendance-settings.js','app-restore-attendance.js','attendance-entry-handler.js','mentoring-journal-handler.js','idp-live-v32.js','data-center-rbac.js','api/system.js','api/data-center.js','api/access-control.js','api/auth-bridge.js','api/awardee360.js','api/idp-live.js','api/secure.js','server-session.js','pin-login-cookie.js','tailwind.config.js','tailwind.input.css'];
for(const name of required)if(!fs.existsSync(path.join(ROOT,name)))fail(`Asset production hilang: ${name}`);
if(required.every(name=>fs.existsSync(path.join(ROOT,name))))ok(`${required.length} asset production/readiness tersedia`);
if(fs.existsSync(path.join(ROOT,'noop.txt')))fail('File sementara noop.txt tidak boleh masuk production.');

const apiDir=path.join(ROOT,'api');
const apiFunctions=fs.readdirSync(apiDir).filter(x=>x.endsWith('.js'));
if(apiFunctions.length>12)fail(`Vercel Hobby function limit terlewati: ${apiFunctions.length}/12`);else ok(`Vercel function count ${apiFunctions.length}/12`);

try{
 const index=read('index.html');
 expect(index,['20260911-runtime-stability-v33',"const V='33'",'app-mentoring-journal','app-mentoring-cases','app-attendance-settings','app-data-center','app-system','app-system-health','app-access','app-access-control','app-auth-recovery','app-auth-rbac','app-auth-mfa','etosRecoveryReady','etos-booting','window.etosLoadChart','shellPromise=fetch','libsPromise=libs'],'index.html');
 if(index.indexOf('app-auth-recovery')>index.indexOf('app-auth-rbac'))fail('Recovery module harus dimuat sebelum RBAC utama.');
 if(index.indexOf('app-auth-rbac')>index.indexOf('app-auth-mfa'))fail('MFA module harus dimuat setelah RBAC utama.');
 if(index.indexOf('app-system')>index.indexOf('app-system-health'))fail('System health module harus dimuat setelah System Center.');
 if(index.indexOf('app-mentoring-journal')>index.indexOf('app-mentoring-cases'))fail('Case Pendampingan harus dipasang setelah Jurnal Pendampingan agar fitur lama tetap tersedia.');
 const enhancementsCall=index.lastIndexOf('await loadEnhancements();');
 const revealCall=index.lastIndexOf('reveal();');
 if(enhancementsCall<0||revealCall<0||enhancementsCall>revealCall)fail('Enhancement visual harus selesai sebelum dashboard direveal.');
 if(index.includes('setTimeout(()=>loadEnhancements'))fail('Enhancement tidak boleh dimuat tertunda setelah dashboard direveal.');
 const libs=index.match(/async function libs\(\)\{([\s\S]*?)\}\n    function mountShell/);
 if(libs&&libs[1].includes('chart.umd.min.js'))fail('Chart.js tidak boleh memblokir library boot utama.');
 if(!failures.some(x=>x.includes('index.html')||x.includes('module harus')||x.includes('Case Pendampingan harus')||x.includes('Enhancement')||x.includes('Chart.js')))ok('Boot v33 stability dan module order lengkap');
}catch(e){fail(`index.html tidak dapat diperiksa: ${e.message}`)}

try{const core=read('app-core.js');expect(core,['chartTokens','window.etosLoadChart','state.chartTokens[id]'],'Lazy chart core');}catch(e){fail(`app-core.js tidak dapat diperiksa: ${e.message}`)}
try{const pkg=JSON.parse(read('package.json'));if(pkg.scripts?.['build:css']!=='tailwindcss -i ./tailwind.input.css -o ./tailwind.generated.css --minify')fail('Static Tailwind build command berubah/tidak tersedia.');if(pkg.devDependencies?.tailwindcss!=='3.4.17')fail('Tailwind build dependency harus dipin ke 3.4.17.');}catch(e){fail(`package.json Tailwind readiness gagal diperiksa: ${e.message}`)}
try{const tw=read('tailwind.config.js'),input=read('tailwind.input.css');expect(tw,['./index.html','./shell.html','./app-*.js'],'Tailwind content');expect(input,['@tailwind base','@tailwind components','@tailwind utilities'],'Tailwind input');}catch(e){fail(`Tailwind readiness files gagal diperiksa: ${e.message}`)}
try{const v=JSON.parse(read('vercel.json')),all=JSON.stringify(v);expect(all,['Content-Security-Policy-Report-Only',"default-src 'self'",'wss://weklmapqizeldfdalbgs.supabase.co','max-age=31536000, immutable','max-age=63072000; includeSubDomains; preload'],'Vercel headers');if(all.includes('"key":"Content-Security-Policy"'))fail('CSP enforcement belum boleh diaktifkan sebelum report-only diuji.');}catch(e){fail(`vercel.json security headers gagal diperiksa: ${e.message}`)}

try{const auth=read('app-auth-rbac.js');expect(auth,['signInWithPassword','invite-password-modal','submitInvitePassword','etos-rbac-auth-v1'],'Auth/RBAC');if(auth.includes('challengeAndVerify'))fail('RBAC login tidak boleh memaksa MFA sebelum rollout enforcement disetujui.');}catch(e){fail(`app-auth-rbac.js tidak dapat diperiksa: ${e.message}`)}
try{const recovery=read('app-auth-recovery.js');expect(recovery,['resetPasswordForEmail','recovery-password-modal','currentPassword',"scope:'others'","scope:'global'",'etosRecoveryReady'],'Auth recovery');}catch(e){fail(`app-auth-recovery.js tidak dapat diperiksa: ${e.message}`)}
try{const mfa=read('app-auth-mfa.js');expect(mfa,["factorType:'totp'",'listFactors','getAuthenticatorAssuranceLevel','challengeAndVerify','unenroll','MFA belum diwajibkan'],'MFA readiness');}catch(e){fail(`app-auth-mfa.js tidak dapat diperiksa: ${e.message}`)}

try{
 const adapter=read('supabase-adapter.js');
 expect(adapter,["const endpoint=name==='getAwardee360'?'/api/awardee360':'/api/secure'",'credentials=options.credentials||\'include\''],'Secure adapter');
 if(adapter.includes("if(!s)return{success:false,error:'Akses operasional diperlukan untuk fitur ini.'}"))fail('Secure adapter tidak boleh memblokir account-session sebelum server melakukan authorization.');
}catch(e){fail(`supabase-adapter.js tidak dapat diperiksa: ${e.message}`)}

try{
 const front=read('app-mentoring-journal.js'),cases=read('app-mentoring-cases.js'),back=read('mentoring-journal-handler.js');
 expect(front,['ETOS_FACILITATOR_JOURNAL_READY','Muhammad Shadiq Muntashir','Septianindi','Tambah Temuan','Ringkasan Bulanan'],'Jurnal frontend');
 expect(cases,['ETOS_MENTORING_CASES_READY','Case Pendampingan','Riwayat Case','getMentoringCases','getMentoringJournal','saveMentoringJournal'],'Case Pendampingan preserved');
 expect(back,['getFacilitatorJournalHub','saveFacilitatorJournalEntry','generateFacilitatorMonthlySummary','facilitator_monthly_summaries','observed_at:now','getMentoringJournal','saveMentoringJournal'],'Jurnal backend');
}catch(e){fail(`Pendampingan/Jurnal tidak dapat diperiksa: ${e.message}`)}

try{
 const front=read('app-attendance-settings.js'),back=read('attendance-entry-handler.js'),restore=read('app-restore-attendance.js');
 expect(front,['ETOS_ATTENDANCE_SETTINGS_READY','saveAttendancePeriod','saveAttendanceAgenda','agendaId','Pengaturan'],'Attendance settings frontend');
 expect(back,['getAttendanceSettings','saveAttendancePeriod','deleteAttendancePeriod','saveAttendanceAgenda','deleteAttendanceAgenda','attendance_agendas','agenda_id'],'Attendance settings backend');
 expect(restore,['ETOS_ATTENDANCE_SETTINGS_READY','v32-agenda-compatible'],'Attendance legacy compatibility');
}catch(e){fail(`Attendance settings tidak dapat diperiksa: ${e.message}`)}

try{
 const wrapper=read('api/idp-live.js'),idp=read('idp-live-v32.js');
 expect(wrapper,["require('../idp-live-v32')"],'IDP API wrapper');
 expect(idp,['1OzW2RfiXL5SmqLOJx-t4Grimy7usdnSqVvSQszZ8WvQ','1973014346','session.credential(req)','superadmin','facilitator','source_health'],'IDP central read-only');
}catch(e){fail(`IDP central tidak dapat diperiksa: ${e.message}`)}

try{const secure=read('api/secure.js');expect(secure,['getFacilitatorJournalHub','generateFacilitatorMonthlySummary','getAttendanceSettings','saveAttendanceAgenda'],'Secure dispatcher');}catch(e){fail(`api/secure.js tidak dapat diperiksa: ${e.message}`)}
try{const a360=read('api/awardee360.js');expect(a360,['hidden_sections','privateOps','development'],'Awardee360 RBAC');}catch(e){fail(`api/awardee360.js tidak dapat diperiksa: ${e.message}`)}
try{const access=read('app-access.js');if(access.includes("'/api/attendance-cutover'")||access.includes('"/api/attendance-cutover"'))fail('Frontend tidak boleh memanggil attendance-cutover yang sudah retired.');if(!access.includes("credentials:'include'"))fail('app-access.js harus memakai cookie credentials.');}catch(e){fail(`app-access.js tidak dapat diperiksa: ${e.message}`)}

if(failures.length){console.error(`\nQuality gate GAGAL: ${failures.length} masalah.`);process.exit(1)}
console.log('\nETOS quality gate v33 LULUS.');
