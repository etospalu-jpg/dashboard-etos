'use strict';
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..');
const SKIP_DIRS=new Set(['node_modules','.git']);
const failures=[];
const read=n=>fs.readFileSync(path.join(ROOT,n),'utf8');
const exists=n=>fs.existsSync(path.join(ROOT,n));
function walk(dir){const out=[];for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(SKIP_DIRS.has(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())out.push(...walk(p));else out.push(p)}return out}
function rel(p){return path.relative(ROOT,p).replaceAll('\\','/')}
function fail(m){failures.push(m);console.error('✗',m)}
function ok(m){console.log('✓',m)}
function expect(text,tokens,label){for(const t of tokens)if(!text.includes(t))fail(`${label} kehilangan marker: ${t}`)}
function reject(text,tokens,label){for(const t of tokens)if(text.includes(t))fail(`${label} masih mengandung marker terlarang: ${t}`)}

const files=walk(ROOT);
const jsFiles=files.filter(p=>p.endsWith('.js'));
for(const file of jsFiles){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)fail(`Syntax JS: ${rel(file)}\n${(r.stderr||r.stdout||'').trim()}`)}
if(!failures.length)ok(`${jsFiles.length} file JavaScript lolos syntax check`);

for(const name of ['package.json','vercel.json','data-audit-manifest.json']){try{JSON.parse(read(name));ok(`JSON valid: ${name}`)}catch(e){fail(`JSON invalid/hilang: ${name} — ${e.message}`)}}

const required=[
 'index.html','shell.html','app.css','app-layout.css','supabase-adapter.js','app-supabase-authority.js','app-core.js','app-public.js','app-secure.js','secure-cookie.js',
 'app-system.js','app-data-center.js','app-admin.js','app-access.js','app-access-control.js','app-auth-rbac.js','app-interaction-fix.js','app-mentoring-journal.js','app-mentoring-cases.js','app-attendance-settings.js',
 'app-restore-core.js','app-restore-idp.js','app-restore-command.js','app-restore-attendance.js','attendance-entry-handler.js','mentoring-journal-handler.js','rule-analysis-handler.js','idp-live-v32.js','data-center-rbac.js',
 'api/system.js','api/data-center.js','api/access-control.js','api/auth-bridge.js','api/awardee360.js','api/idp-live.js','api/public-attendance.js','api/secure.js','server-session.js','pin-login-cookie.js',
 'supabase/migrations/20260911_remove_dashboard_assessment.sql','supabase/migrations/20260911_add_facilitator_journal.sql'
];
for(const name of required)if(!exists(name))fail(`Asset v36 wajib hilang: ${name}`);
if(required.every(exists))ok(`${required.length} asset v36 tersedia`);

const retired=[
 'app-assessment.js','app-360.js','app-migration-action.js','app-media-sync.js','app-system-health.js','app-audit-ui.js','api/media-sync.js','api/attendance-cutover.js','api/sync-academic-2023-cutover.js',
 'migration-source-cookie.js','migration-source-v2.js','migration-source.js','scripts/migrate-on-build.js','manage-cookie.js','data-authority-2023.js','public-snapshot.min.json','idp-central-snapshot.json','awardee-authority.json','production.html','safe.html'
];
for(const name of retired)if(exists(name))fail(`Legacy/retired file masih ada: ${name}`);
if(!retired.some(exists))ok('File Assessment, fallback, snapshot, dan spreadsheet migration telah dipensiunkan');

const runtimeJs=jsFiles.filter(p=>rel(p)!=='scripts/quality-check.js');
const forbiddenRuntime=[
 '/rest/v1/assessments','getFacilitatorAssessmentHub','getFacilitatorAssessmentReport','assessment_code','app-assessment.js',
 'migrate_source','trigger_etos_sheet_sync','syncSourceOnce','public-snapshot.min.json','idp-central-snapshot.json','migration-source-cookie'
];
for(const file of runtimeJs){const text=fs.readFileSync(file,'utf8');for(const token of forbiddenRuntime)if(text.includes(token))fail(`Runtime ${rel(file)} masih memuat legacy token: ${token}`)}
if(!failures.some(x=>x.includes('legacy token')))ok('Runtime bebas endpoint Assessment dan spreadsheet-sync legacy');

for(const file of runtimeJs){const name=rel(file),text=fs.readFileSync(file,'utf8');if(text.includes('window.loadView='))fail(`Router harus terpusat di app-core, tetapi ${name} masih menimpa window.loadView`);if(/setTimeout\s*\(\s*activate\s*,/m.test(text))fail(`Late remount terlarang masih ada di ${name}`)}
if(!failures.some(x=>x.includes('Router harus terpusat')||x.includes('Late remount')))ok('Router terpusat dan tidak ada late remount module');

for(const file of runtimeJs){if(rel(file)==='idp-live-v32.js')continue;const text=fs.readFileSync(file,'utf8');for(const token of ['GOOGLE_SERVICE_ACCOUNT_JSON','sheets.googleapis.com/v4/spreadsheets','oauth2.googleapis.com/token'])if(text.includes(token))fail(`Google Sheet runtime hanya boleh berada di IDP live: ${rel(file)} -> ${token}`)}
if(!failures.some(x=>x.includes('Google Sheet runtime')))ok('Integrasi Google runtime terisolasi hanya pada IDP live');

const apiDir=path.join(ROOT,'api');
const apiCount=fs.readdirSync(apiDir).filter(x=>x.endsWith('.js')).length;
if(apiCount>12)fail(`Vercel Hobby function limit terlewati: ${apiCount}/12`);else ok(`Vercel function count ${apiCount}/12`);

try{
 const index=read('index.html');
 expect(index,['20260911-supabase-only-v36',"const V='36'",'PRE_REVEAL','PRE_REVEAL_OPTIONAL','POST_REVEAL','loadGroup','loadPostReveal','requestIdleCallback','ETOSTimeoutError'],'Boot v36');
 reject(index,['app-assessment','app-migration-action','app-media-sync','app-system-health','app-audit-ui'],'Boot v36');
 const d=index.lastIndexOf('async function dashboard()'),r=index.indexOf('reveal();',d),p=index.indexOf('loadPostReveal()',d);
 if(d<0||r<d||p<r)fail('POST_REVEAL harus dimulai setelah dashboard direveal.');else ok('Boot menunda modul non-kritis sampai setelah reveal');
}catch(e){fail(`Boot v36 gagal diperiksa: ${e.message}`)}

try{
 const shell=read('shell.html');
 reject(shell,['data-view="assessment"','view-assessment','Asesmen & Development'],'Shell');
 expect(shell,['data-view="attendance"','data-view="coaching"','data-view="mentoring"','data-view="profile"'],'Shell');
}catch(e){fail(`Shell gagal diperiksa: ${e.message}`)}

try{
 const core=read('app-core.js'),rbac=read('app-auth-rbac.js'),interaction=read('app-interaction-fix.js'),dc=read('app-data-center.js'),admin=read('app-admin.js'),settings=read('app-attendance-settings.js'),journal=read('app-mentoring-journal.js'),ac=read('app-access-control.js');
 expect(core,["datacenter:'Data Center'","secureViews=new Set(['attendance','coaching','mentoring','profile','datacenter','settings','system'])","v==='datacenter'","v==='settings'",'window.loadAccessControl','normalizeAttendanceAgendaControl'],'Core');
 for(const token of ["attendance:['operator','facilitator','admin','superadmin']","coaching:['facilitator','admin','superadmin']","mentoring:['facilitator','admin','superadmin']","profile:['facilitator','admin','superadmin']","datacenter:['operator','facilitator','admin','superadmin']","settings:['operator','facilitator','admin','superadmin']","system:['admin','superadmin']"]){if(!rbac.includes(token)||!interaction.includes(token))fail(`RBAC tidak konsisten untuk ${token}`)}
 expect(rbac,['window.ETOSApplyRoleUI=applyRoleUI','const observer=new MutationObserver'],'RBAC sidebar controller');
 expect(interaction,["ETOS_INTERACTION_FIX='v36-single-nav-controller'",'window.ETOSApplyRoleUI'],'Interaction sidebar delegation');
 reject(interaction,['new MutationObserver','const previousUpdate=window.updateAuthUI'],'Interaction sidebar delegation');
 expect(dc,['ETOS_DATA_CENTER_V36',"secureViews.add('datacenter')","b.dataset.view='datacenter'","view-datacenter","window.loadDataCenter=async","goView?.('datacenter')"],'Data Center');
 reject(dc,["s.id='view-settings'","titles.settings='Pengaturan'",'sinkronisasi','window.loadView='],'Data Center');
 expect(settings,["ETOS_ATTENDANCE_SETTINGS_READY='v36'",'window.loadSettings=window.loadAttendanceSettings','localDate()'],'Attendance Settings v36');
 reject(settings,['window.loadView=','setTimeout(activate'],'Attendance Settings v36');
 expect(journal,["ETOS_FACILITATOR_JOURNAL_READY='v36'",'function currentMonth()'],'Journal v36');
 reject(journal,['setTimeout(activate','window.loadView='],'Journal v36');
 expect(ac,['ETOS_ACCESS_CONTROL_V36','box.style.display=\'none\'','attendance-settings-root','window.loadAccessControl=async'],'Access Control v36');
 reject(ac,['dc-workspace','window.loadView=','setTimeout(()=>loadAccessControl'],'Access Control v36');
 expect(admin,['ETOS_ADMIN_LAUNCHER_V36','profile-edit-launcher','loadDataCenterTable?.(\'facilitators\')'],'Admin compatibility');
 reject(admin,['/api/manage','b=document.createElement(\'button\')'],'Admin compatibility');
}catch(e){fail(`RBAC/Data Center/Settings gagal diperiksa: ${e.message}`)}

try{
 const adapter=read('supabase-adapter.js'),authority=read('app-supabase-authority.js'),access=read('app-access.js');
 expect(adapter,["source:'supabase'",'/functions/v1/public-api','function secureCall','startRealtimeSignals'],'Supabase adapter');
 reject(adapter,['snapshotCall','syncAfterPin','migrate_source'],'Supabase adapter');
 expect(authority,['v36-supabase-only','public_data'],'Supabase authority');
 reject(authority,['snapshotCall','Snapshot spreadsheet'],'Supabase authority');
 expect(access,['getIDPOverview','getIDPDetail','/api/idp-live'],'IDP exception');
 reject(access,['syncSourceOnce','migrate_source','ACADEMIC_RECAP','getAbsensiList'],'IDP exception');
}catch(e){fail(`Data source policy gagal diperiksa: ${e.message}`)}

try{
 const attendance=read('attendance-entry-handler.js'),dispatch=read('api/secure.js'),settings=read('app-attendance-settings.js');
 expect(attendance,['async function listAttendance','development_periods','choosePeriod','getAbsensiList','getAttendanceSettings','saveAttendancePeriod'],'Attendance backend');
 expect(dispatch,["'getAbsensiList'",'getAttendanceSettings','saveAttendancePeriod'],'Attendance dispatcher');
 expect(settings,['Periode pembinaan tersimpan.','loadAttendanceSettings(true)','loadAttendance(true)','attendance-form-agenda'],'Attendance settings');
}catch(e){fail(`Attendance gagal diperiksa: ${e.message}`)}

try{
 const sys=read('api/system.js'),ui=read('app-system.js'),dcRbac=read('data-center-rbac.js');
 reject(sys,['migrate_source','trigger_etos_sheet_sync','DASHBOARD AWARDEE ETOS ID PALU'],'System API');
 reject(ui,['Sinkronkan Spreadsheet','runFullMigration','migrate_source'],'System UI');
 expect(sys,["source:{type:'supabase-postgres'",'IDP pusat merupakan satu-satunya sumber eksternal'],'System API');
 expect(ui,['Database utama hanya Supabase PostgreSQL','Tidak ada sinkronisasi spreadsheet'],'System UI');
 reject(dcRbac,["assessments:{",'migration_batches','idp_snapshots'],'Data Center catalog');
 expect(dcRbac,['attendance_agendas','facilitator_journal_entries','facilitator_monthly_summaries'],'Data Center catalog');
}catch(e){fail(`System/Data Center policy gagal diperiksa: ${e.message}`)}

try{
 const sc=read('secure-cookie.js'),a360=read('api/awardee360.js'),rule=read('rule-analysis-handler.js'),command=read('app-restore-command.js'),idp=read('app-restore-idp.js');
 reject(sc,['getFacilitatorAssessmentHub','getFacilitatorAssessmentReport','/rest/v1/assessments'],'Secure API');
 reject(a360,['/assessments?','assessment_completed','idp_snapshots','awardee-authority','data-audit-manifest'],'Awardee360');
 reject(rule,['/rest/v1/assessments','assessment_code'],'Rule analysis');
 reject(command,['getFacilitatorAssessmentHub','<th>Asesmen</th>'],'Command Center');
 expect(a360,["source_policy:'supabase-only'",'hidden_sections'],'Awardee360');
 expect(command,["ETOS_RESTORE_COMMAND='v36-no-assessment'",'Dashboard Supabase tetap berjalan normal tanpa IDP'],'Command Center');
 expect(idp,["ETOS_RESTORE_IDP='v36-live-only'",'Satu-satunya sumber eksternal aplikasi'],'IDP live UI');
}catch(e){fail(`Assessment removal/IDP isolation gagal diperiksa: ${e.message}`)}

try{
 const drop=read('supabase/migrations/20260911_remove_dashboard_assessment.sql'),journal=read('supabase/migrations/20260911_add_facilitator_journal.sql');
 expect(drop,['Intentionally no CASCADE','drop table if exists public.assessments;'],'Assessment migration');
 reject(drop,['assessments cascade'],'Assessment migration');
 expect(journal,['revoke all on schema private from public','grant usage on schema private to authenticated, service_role','private.etos_v36_can_development','private.etos_v36_can_admin','security definer','create table if not exists public.facilitator_journal_entries','create table if not exists public.facilitator_monthly_summaries','enable row level security','revoke all on table public.facilitator_journal_entries from anon, authenticated','revoke all on table public.facilitator_monthly_summaries from anon, authenticated'],'Journal migration');
 reject(journal,['private.can_read_development','private.can_manage_development','private.can_admin'],'Journal migration');
}catch(e){fail(`Migration v36 gagal diperiksa: ${e.message}`)}

try{
 const manifest=JSON.parse(read('data-audit-manifest.json'));
 if(manifest.policy_version!=='supabase-only-v36')fail('Manifest authority bukan supabase-only-v36.');
 if(manifest.database_authority?.project_ref!=='weklmapqizeldfdalbgs')fail('Manifest menunjuk Supabase project yang salah.');
 if(manifest.external_sources?.idp?.mode!=='live-read-only')fail('IDP harus live-read-only.');
 if(manifest.assessment?.dashboard_feature!=='retired')fail('Assessment dashboard harus retired.');
 else ok('Manifest authority v36 konsisten');
}catch(e){fail(`Manifest v36 gagal diperiksa: ${e.message}`)}

if(failures.length){console.error(`\nQuality gate GAGAL: ${failures.length} masalah.`);process.exit(1)}
console.log('\nETOS quality gate v36 LULUS.');
