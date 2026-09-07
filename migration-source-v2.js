const core=require('./migration-source');
const URL='https://weklmapqizeldfdalbgs.supabase.co';
const KEY='sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
const RECAP=[
 ['AKD-001','AWD-0001',3.64],
 ['AKD-002','AWD-0002',null],
 ['AKD-003','AWD-0003',null],
 ['AKD-004','AWD-0004',null],
 ['AKD-005','AWD-0005',null],
 ['AKD-006','AWD-0006',3.77],
 ['AKD-007','AWD-0007',null]
];
function h(t,extra={}){return{apikey:KEY,Authorization:`Bearer ${t}`,'Content-Type':'application/json',...extra}}
async function q(path,t,options={}){const r=await fetch(URL+path,{...options,headers:{...h(t),...(options.headers||{})}});const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!r.ok)throw new Error(body?.message||body?.error||body?.hint||`Supabase ${r.status}`);return body}
async function schema(t){const r=await fetch(URL+'/rest/v1/',{headers:{apikey:KEY,Authorization:`Bearer ${t}`,Accept:'application/openapi+json'}});if(!r.ok)return{};const x=await r.json();return x.definitions||x.components?.schemas||{}}
function definition(defs,table){return defs?.[table]||{}}
function fields(defs,table){return new Set(Object.keys(definition(defs,table).properties||{}))}
function pick(row,set){const out={};for(const[k,v]of Object.entries(row))if(set.has(k)&&v!==undefined)out[k]=v;return out}
async function upsertRecap(t,userId){const defs=await schema(t),def=definition(defs,'academic_records'),set=fields(defs,'academic_records');const semType=def?.properties?.semester?.type||'';const awardees=await q('/rest/v1/awardees?select=id,legacy_id',t);const amap=new Map((awardees||[]).map(x=>[x.legacy_id,x.id]));const rows=[];
 for(const[legacy,awd,ipk]of RECAP){const aid=amap.get(awd);if(!aid)continue;const row={legacy_id:legacy,awardee_id:aid,ipk,semester_label:'1-8',period_label:'1-8',record_type:'rekap_1_8',is_summary:true,semester_from:1,semester_to:8,notes:'Rekap IPK Semester 1-8 dari spreadsheet ETOS ID Palu',created_by:userId,updated_by:userId};if(set.has('semester'))row.semester=semType==='string'?'1-8':8;rows.push(pick(row,set))}
 if(rows.length){const suffix=set.has('legacy_id')?'?on_conflict=legacy_id':'';await q('/rest/v1/academic_records'+suffix,t,{method:'POST',headers:{Prefer:set.has('legacy_id')?'resolution=merge-duplicates,return=minimal':'return=minimal'},body:JSON.stringify(rows)})}
 try{await q('/rest/v1/migration_issues?source_sheet=eq.Akademik&issue_type=eq.invalid_semester',t,{method:'DELETE',headers:{Prefer:'return=minimal'}})}catch{}
 return rows.length}
module.exports=async function migrateSourceV2(token,userId){const result=await core(token,userId);const recap=await upsertRecap(token,userId);result.counts=result.counts||{};result.counts.academic_records=(Number(result.counts.academic_records)||0)+recap;result.academic_model={individual_semesters:'Angkatan 2023: Semester 1-6',recap_semesters:'Angkatan 2021-2022: Rekap Semester 1-8',recap_records:recap};result.normalized=true;return result};
