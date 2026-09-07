const session=require('../server-session');
const TABLES={
 awardees:{label:'Awardee',write:true,create:true,delete:false},
 awardee_contacts:{label:'Kontak Awardee',write:true,create:true,delete:true},
 academic_records:{label:'Akademik',write:true,create:true,delete:true},
 organization_records:{label:'Organisasi',write:true,create:true,delete:true},
 achievements:{label:'Prestasi',write:true,create:true,delete:true},
 coaching_sessions:{label:'Coaching',write:true,create:true,delete:true},
 spiritual_records:{label:'Spiritual',write:true,create:true,delete:true},
 networking_records:{label:'Networking',write:true,create:true,delete:true},
 portfolios:{label:'Portfolio / CV Links',write:true,create:true,delete:true},
 assessments:{label:'Asesmen',write:true,create:true,delete:true},
 competencies:{label:'Kompetensi',write:true,create:true,delete:true},
 mentoring_cases:{label:'Mentoring Case',write:true,create:true,delete:true},
 pdp_records:{label:'PDP Semester',write:true,create:true,delete:true},
 rule_analyses:{label:'Analisis Otomatis',write:false,create:false,delete:false},
 development_periods:{label:'Periode Pembinaan',write:true,create:true,delete:true},
 attendance_sessions:{label:'Sesi Absensi',write:true,create:true,delete:true},
 attendance_records:{label:'Detail Absensi',write:true,create:true,delete:true},
 reflection_forms:{label:'Form Refleksi',write:true,create:true,delete:true},
 reflection_responses:{label:'Refleksi Awardee',write:true,create:true,delete:true},
 facilitators:{label:'Fasilitator',write:true,create:true,delete:true},
 idp_external_sources:{label:'IDP — Sumber Pusat',write:false,create:false,delete:false},
 idp_snapshots:{label:'IDP — Snapshot',write:false,create:false,delete:false},
 migration_batches:{label:'Migration Batch',write:false,create:false,delete:false},
 migration_issues:{label:'Migration Issues',write:false,create:false,delete:false},
 audit_logs:{label:'Audit Log',write:false,create:false,delete:false}
};
const PROTECTED=new Set(['id','created_at','created_by','updated_at','updated_by']);
const LOOKUP_MAP={awardee_id:'awardees',facilitator_id:'facilitators',period_id:'development_periods',session_id:'attendance_sessions',form_id:'reflection_forms'};
function out(res,status,body){res.status(status);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
async function q(path,c,options={}){const r=await fetch(session.PROJECT_URL+path,{...options,headers:{...session.dbHeaders(c),...(options.headers||{})}});const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!r.ok){const e=new Error(body?.message||body?.error_description||body?.error||body?.hint||`Supabase ${r.status}`);e.status=r.status;throw e}return body}
async function actor(c){if(c?.server)return{user:{id:null},profile:{role:'admin',is_active:true,full_name:'ETOS ID Palu Administrator'}};const user=await q('/auth/v1/user',c),rows=await q(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,is_active,full_name,email`,c),profile=rows?.[0];if(!profile?.is_active)throw Object.assign(new Error('Akun tidak aktif.'),{status:403});if(!['superadmin','admin','operator','facilitator'].includes(String(profile.role||'').toLowerCase()))throw Object.assign(new Error('Role tidak memiliki akses Data Center.'),{status:403});return{user,profile}}
async function openApi(c){return q('/rest/v1/',c,{headers:{Accept:'application/openapi+json'}})}
function definitions(doc){return doc?.definitions||doc?.components?.schemas||{}}
function editableFields(defs,table){const d=defs?.[table]||{},req=new Set(d.required||[]),props=d.properties||{};return Object.entries(props).filter(([name])=>!PROTECTED.has(name)).map(([name,p])=>({name,type:p?.type||'string',format:p?.format||null,required:req.has(name),enum:Array.isArray(p?.enum)?p.enum:null,description:p?.description||null,lookup:LOOKUP_MAP[name]||null,readOnly:!!p?.readOnly})).filter(x=>!x.readOnly)}
function clean(input,allowed){const x={};for(const[k,v]of Object.entries(input||{})){if(PROTECTED.has(k)||k.startsWith('_')||(allowed&&!allowed.has(k)))continue;x[k]=v===''?null:v}return x}
function sortRows(rows){return rows.sort((a,b)=>String(b.updated_at||b.created_at||b.activity_date||b.analyzed_at||'').localeCompare(String(a.updated_at||a.created_at||a.activity_date||a.analyzed_at||'')))}
async function lookupData(c){const [aw,fac,per,sess,forms]=await Promise.all([
 q('/rest/v1/awardees?select=id,legacy_id,name&order=legacy_id.asc',c).catch(()=>[]),
 q('/rest/v1/facilitators?select=id,name,email&order=name.asc',c).catch(()=>[]),
 q('/rest/v1/development_periods?select=id,legacy_id,name,status&order=start_date.desc.nullslast',c).catch(()=>[]),
 q('/rest/v1/attendance_sessions?select=id,activity_name,activity_date&order=activity_date.desc.nullslast&limit=200',c).catch(()=>[]),
 q('/rest/v1/reflection_forms?select=id,legacy_id,agenda_name,agenda_date&order=agenda_date.desc.nullslast&limit=200',c).catch(()=>[])
 ]);return{
  awardees:(aw||[]).map(x=>({value:x.id,label:`${x.legacy_id||''} — ${x.name||''}`.replace(/^ — /,'')})),
  facilitators:(fac||[]).map(x=>({value:x.id,label:x.name||x.email||x.id})),
  development_periods:(per||[]).map(x=>({value:x.id,label:`${x.legacy_id||''} — ${x.name||x.status||''}`.replace(/^ — /,'')})),
  attendance_sessions:(sess||[]).map(x=>({value:x.id,label:`${x.activity_date||''} — ${x.activity_name||'Sesi'}`})),
  reflection_forms:(forms||[]).map(x=>({value:x.id,label:`${x.legacy_id||''} — ${x.agenda_name||x.agenda_date||'Form'}`.replace(/^ — /,'')}))
 }}
module.exports=async function handler(req,res){if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});try{
 const c=session.credential(req);if(!c)return out(res,401,{success:false,error:'Sesi PIN operasional diperlukan.'});const who=await actor(c),role=String(who.profile.role||'').toLowerCase(),action=String(req.body?.action||'catalog'),table=String(req.body?.table||''),cfg=TABLES[table];
 if(action==='catalog')return out(res,200,{success:true,data:Object.entries(TABLES).map(([name,v])=>({name,label:v.label,write:v.write,create:v.create,delete:v.delete}))});
 if(!cfg)return out(res,400,{success:false,error:'Tabel tidak termasuk Data Center ETOS.'});
 if(action==='schema'){const defs=definitions(await openApi(c));return out(res,200,{success:true,data:{table,label:cfg.label,write:cfg.write,create:cfg.create,delete:cfg.delete,fields:editableFields(defs,table),lookups:await lookupData(c)}})}
 if(action==='list'){const limit=Math.min(1000,Math.max(1,Number(req.body?.limit||500)));let rows=await q(`/rest/v1/${table}?select=*&limit=${limit}`,c);rows=Array.isArray(rows)?sortRows(rows):[];const s=String(req.body?.search||'').trim().toLowerCase();if(s)rows=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(s));return out(res,200,{success:true,data:{table,label:cfg.label,write:cfg.write,create:cfg.create,delete:cfg.delete,total:rows.length,rows}})}
 const defs=definitions(await openApi(c)),fields=editableFields(defs,table),allowed=new Set(fields.map(x=>x.name));
 if(action==='create'){if(!cfg.write||!cfg.create)return out(res,403,{success:false,error:'Tabel ini tidak dapat ditambah dari Data Center.'});const body=clean(req.body?.data,allowed);if(!Object.keys(body).length)throw Object.assign(new Error('Data baru masih kosong.'),{status:400});const rows=await q(`/rest/v1/${table}?select=*`,c,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify([body])});return out(res,201,{success:true,data:rows?.[0]||null})}
 if(action==='update'){if(!cfg.write)return out(res,403,{success:false,error:'Tabel ini read-only di Data Center.'});const id=String(req.body?.id||'').trim();if(!id)throw Object.assign(new Error('ID record wajib ada.'),{status:400});const patch=clean(req.body?.data,allowed);if(!Object.keys(patch).length)throw Object.assign(new Error('Tidak ada perubahan yang dapat disimpan.'),{status:400});const rows=await q(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`,c,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});if(!rows?.length)return out(res,404,{success:false,error:'Record tidak ditemukan atau tidak dapat diubah.'});return out(res,200,{success:true,data:rows[0]})}
 if(action==='delete'){if(!cfg.write||!cfg.delete)return out(res,403,{success:false,error:table==='awardees'?'Awardee tidak dihapus permanen dari Data Center. Ubah status menjadi Nonaktif/Lulus bila diperlukan.':'Tabel ini tidak dapat dihapus dari Data Center.'});if(!['superadmin','admin'].includes(role))return out(res,403,{success:false,error:'Penghapusan record hanya diizinkan untuk admin.'});const id=String(req.body?.id||'').trim(),confirm=String(req.body?.confirm||'').trim();if(!id||confirm!==id)return out(res,400,{success:false,error:'Konfirmasi penghapusan tidak cocok.'});const rows=await q(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`,c,{method:'DELETE',headers:{Prefer:'return=representation'}});if(!rows?.length)return out(res,404,{success:false,error:'Record tidak ditemukan.'});return out(res,200,{success:true,data:rows[0]})}
 return out(res,404,{success:false,error:'Aksi Data Center tidak tersedia.'});
}catch(e){console.error('[data-center]',e);return out(res,Number(e.status)||500,{success:false,error:e.message||String(e)})}};
