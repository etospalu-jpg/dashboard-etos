const session=require('../server-session');
const TABLES={
 awardees:{label:'Awardee',write:true,create:true,delete:false},
 awardee_contacts:{label:'Kontak Awardee',write:true,create:true,delete:true,key:'awardee_id'},
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
function bad(message){const e=new Error(message);e.status=400;throw e}
async function q(path,c,options={}){const r=await fetch(session.PROJECT_URL+path,{...options,headers:{...session.dbHeaders(c),...(options.headers||{})}});const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!r.ok){const e=new Error(body?.message||body?.error_description||body?.error||body?.hint||`Supabase ${r.status}`);e.status=r.status;throw e}return body}
async function actor(c){if(c?.server)return{user:{id:null},profile:{role:'admin',is_active:true,full_name:'ETOS ID Palu Administrator'}};const user=await q('/auth/v1/user',c),rows=await q(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,is_active,full_name,email`,c),profile=rows?.[0];if(!profile?.is_active)throw Object.assign(new Error('Akun tidak aktif.'),{status:403});if(!['superadmin','admin','operator','facilitator'].includes(String(profile.role||'').toLowerCase()))throw Object.assign(new Error('Role tidak memiliki akses Data Center.'),{status:403});return{user,profile}}
async function openApi(c){return q('/rest/v1/',c,{headers:{Accept:'application/openapi+json'}})}
function definitions(doc){return doc?.definitions||doc?.components?.schemas||{}}
function editableFields(defs,table){const d=defs?.[table]||{},req=new Set(d.required||[]),props=d.properties||{};return Object.entries(props).filter(([name])=>!PROTECTED.has(name)).map(([name,p])=>({name,type:p?.type||'string',format:p?.format||null,required:req.has(name),enum:Array.isArray(p?.enum)?p.enum:null,minimum:Number.isFinite(p?.minimum)?p.minimum:null,maximum:Number.isFinite(p?.maximum)?p.maximum:null,description:p?.description||null,lookup:LOOKUP_MAP[name]||null,readOnly:!!p?.readOnly})).filter(x=>!x.readOnly)}
function clean(input,allowed){const x={};for(const[k,v]of Object.entries(input||{})){if(PROTECTED.has(k)||k.startsWith('_')||(allowed&&!allowed.has(k)))continue;x[k]=v===''?null:v}return x}
function validDate(v){const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return false;const d=new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);return d.getUTCFullYear()===Number(m[1])&&d.getUTCMonth()+1===Number(m[2])&&d.getUTCDate()===Number(m[3])}
function validUrl(v){try{const u=new URL(String(v));return u.protocol==='https:'||u.protocol==='http:'}catch{return false}}
function year(v,label){if(v==null)return;const n=Number(v);if(!Number.isInteger(n)||n<1900||n>2100)bad(`${label} harus berupa tahun 1900–2100.`)}
function validatePayload(table,data,fields){const meta=new Map(fields.map(x=>[x.name,x]));for(const[k,v]of Object.entries(data)){if(v==null)continue;const f=meta.get(k);if(f?.enum?.length&&!f.enum.includes(v))bad(`${k} memiliki nilai yang tidak diizinkan.`);if(typeof v==='string'&&v.length>50000)bad(`${k} terlalu panjang.`);if(/email/i.test(k)&&String(v).trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()))bad(`${k} bukan alamat email yang valid.`);if(/whatsapp|(^|_)no_wa$/i.test(k)&&String(v).trim()&&!/^\+?[0-9][0-9\s-]{6,20}$/.test(String(v).trim()))bad(`${k} bukan nomor WhatsApp yang valid.`);if(/(?:^|_)(?:url|link)$/i.test(k)||/_url$/i.test(k)){if(String(v).trim()&&!validUrl(v))bad(`${k} harus berupa URL http/https yang valid.`)}if(f?.format==='date'&&!validDate(v))bad(`${k} harus berupa tanggal yang valid.`);if(String(f?.format||'').includes('time')&&Number.isNaN(Date.parse(v)))bad(`${k} harus berupa waktu yang valid.`);if(['number','integer'].includes(f?.type)&&!Number.isFinite(Number(v)))bad(`${k} harus berupa angka.`);if(f?.minimum!=null&&Number(v)<f.minimum)bad(`${k} minimal ${f.minimum}.`);if(f?.maximum!=null&&Number(v)>f.maximum)bad(`${k} maksimal ${f.maximum}.`)}
 if(table==='awardees'&&'name'in data&&!String(data.name||'').trim())bad('Nama Awardee wajib diisi.');
 if(table==='academic_records'){if(data.ipk!=null&&(Number(data.ipk)<0||Number(data.ipk)>4))bad('IPK harus berada pada rentang 0–4.');for(const k of ['semester','semester_from','semester_to'])if(data[k]!=null&&(!Number.isInteger(Number(data[k]))||Number(data[k])<1||Number(data[k])>14))bad(`${k} harus 1–14.`);if(data.semester_from!=null&&data.semester_to!=null&&Number(data.semester_from)>Number(data.semester_to))bad('semester_from tidak boleh lebih besar dari semester_to.');}
 if(table==='pdp_records'&&data.semester!=null&&(!Number.isInteger(Number(data.semester))||Number(data.semester)<1||Number(data.semester)>14))bad('Semester PDP harus 1–14.');
 if(table==='achievements')year(data.year,'Tahun prestasi');
 if(table==='organization_records')year(data.start_year,'Tahun mulai organisasi');
 if(table==='development_periods'&&data.start_date&&data.end_date&&String(data.start_date)>String(data.end_date))bad('Tanggal mulai periode tidak boleh melewati tanggal selesai.');
 if(table==='attendance_records'&&data.status!=null){const m={hadir:'Hadir',izin:'Izin',sakit:'Sakit',alpa:'Alpa'},canon=m[String(data.status).toLowerCase()];if(!canon)bad('Status absensi hanya Hadir, Izin, Sakit, atau Alpa.');data.status=canon;}
 return data}
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
 if(action==='catalog')return out(res,200,{success:true,data:Object.entries(TABLES).map(([name,v])=>({name,label:v.label,write:v.write,create:v.create,delete:v.delete,key:v.key||'id'}))});
 if(!cfg)return out(res,400,{success:false,error:'Tabel tidak termasuk Data Center ETOS.'});const key=cfg.key||'id';
 if(action==='schema'){const defs=definitions(await openApi(c));return out(res,200,{success:true,data:{table,label:cfg.label,key,write:cfg.write,create:cfg.create,delete:cfg.delete,fields:editableFields(defs,table),lookups:await lookupData(c)}})}
 if(action==='list'){const limit=Math.min(1000,Math.max(1,Number(req.body?.limit||500)));let rows=await q(`/rest/v1/${table}?select=*&limit=${limit}`,c);rows=Array.isArray(rows)?sortRows(rows):[];const s=String(req.body?.search||'').trim().toLowerCase();if(s)rows=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(s));return out(res,200,{success:true,data:{table,label:cfg.label,key,write:cfg.write,create:cfg.create,delete:cfg.delete,total:rows.length,rows}})}
 const defs=definitions(await openApi(c)),fields=editableFields(defs,table),allowed=new Set(fields.map(x=>x.name));
 if(action==='create'){if(!cfg.write||!cfg.create)return out(res,403,{success:false,error:'Tabel ini tidak dapat ditambah dari Data Center.'});const body=validatePayload(table,clean(req.body?.data,allowed),fields);if(!Object.keys(body).length)bad('Data baru masih kosong.');const rows=await q(`/rest/v1/${table}?select=*`,c,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify([body])});return out(res,201,{success:true,data:rows?.[0]||null})}
 if(action==='update'){if(!cfg.write)return out(res,403,{success:false,error:'Tabel ini read-only di Data Center.'});const id=String(req.body?.id||'').trim();if(!id)bad('Kunci record wajib ada.');const patch=validatePayload(table,clean(req.body?.data,allowed),fields);delete patch[key];if(!Object.keys(patch).length)bad('Tidak ada perubahan yang dapat disimpan.');const rows=await q(`/rest/v1/${table}?${key}=eq.${encodeURIComponent(id)}&select=*`,c,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});if(!rows?.length)return out(res,404,{success:false,error:'Record tidak ditemukan atau tidak dapat diubah.'});return out(res,200,{success:true,data:rows[0]})}
 if(action==='delete'){if(!cfg.write||!cfg.delete)return out(res,403,{success:false,error:table==='awardees'?'Awardee tidak dihapus permanen dari Data Center. Ubah status menjadi Nonaktif/Lulus bila diperlukan.':'Tabel ini tidak dapat dihapus dari Data Center.'});if(!['superadmin','admin'].includes(role))return out(res,403,{success:false,error:'Penghapusan record hanya diizinkan untuk admin.'});const id=String(req.body?.id||'').trim(),confirm=String(req.body?.confirm||'').trim();if(!id||confirm!==id)return out(res,400,{success:false,error:'Konfirmasi penghapusan tidak cocok.'});const rows=await q(`/rest/v1/${table}?${key}=eq.${encodeURIComponent(id)}&select=*`,c,{method:'DELETE',headers:{Prefer:'return=representation'}});if(!rows?.length)return out(res,404,{success:false,error:'Record tidak ditemukan.'});return out(res,200,{success:true,data:rows[0]})}
 return out(res,404,{success:false,error:'Aksi Data Center tidak tersedia.'});
}catch(e){console.error('[data-center]',e);return out(res,Number(e.status)||500,{success:false,error:e.message||String(e)})}};
