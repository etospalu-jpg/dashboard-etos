const session=require('../server-session');
(async()=>{
 const db=await session.testDatabase();
 console.log('[ETOS PROBE] database',JSON.stringify({ok:db.ok,kind:db.kind,status:db.status,error:db.error||null}));
 if(!db.ok)process.exit(2);
 const key=session.secret(),kind=session.kind(key);const headers={apikey:key,Accept:'application/openapi+json'};if(kind==='legacy')headers.Authorization=`Bearer ${key}`;
 const r=await fetch(session.PROJECT_URL+'/rest/v1/',{headers});
 console.log('[ETOS PROBE] openapi status',r.status);
 if(!r.ok){console.error((await r.text()).slice(0,400));process.exit(3)}
 const x=await r.json();const defs=x.definitions||x.components?.schemas||{};
 const tables=['awardees','awardee_contacts','academic_records','organization_records','achievements','spiritual_records','coaching_sessions','networking_records','portfolios','assessments','competencies','mentoring_cases','rule_analyses','development_periods','attendance_sessions','attendance_records','reflection_forms','reflection_responses','facilitators','migration_issues'];
 for(const t of tables){const d=defs[t];console.log('[ETOS SCHEMA]',t,JSON.stringify({fields:Object.keys(d?.properties||{}),required:d?.required||[]}))}
})().catch(e=>{console.error('[ETOS PROBE ERROR]',e);process.exit(1)});
