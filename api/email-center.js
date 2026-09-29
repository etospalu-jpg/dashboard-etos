const session=require('../server-session');

function out(res,status,body){
  res.status(status);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}
function bad(message,status=400){const e=new Error(message);e.status=status;throw e}
function clean(v,max=5000){return String(v??'').trim().slice(0,max)}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim())}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function q(path,c,options={}){
  const r=await fetch(session.PROJECT_URL+path,{...options,headers:{...session.dbHeaders(c),...(options.headers||{})}});
  const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
  if(!r.ok){const e=new Error(body?.message||body?.error_description||body?.error||body?.hint||`Supabase ${r.status}`);e.status=r.status;throw e}
  return body;
}
async function rpc(name,c,payload={}){
  return q('/rest/v1/rpc/'+encodeURIComponent(name),c,{method:'POST',body:JSON.stringify(payload)});
}
async function settings(c){
  const rows=await q('/rest/v1/email_settings?id=eq.true&select=*',c);
  return rows?.[0]||null;
}
async function providerKey(c){
  try{
    const v=await rpc('get_email_resend_secret',c,{});
    if(typeof v==='string')return v.trim();
    if(Array.isArray(v)&&typeof v[0]==='string')return String(v[0]).trim();
    if(v&&typeof v==='object'&&typeof v.get_email_resend_secret==='string')return v.get_email_resend_secret.trim();
    return '';
  }catch{return ''}
}
async function resend(path,key,options={}){
  if(!key)bad('Resend API key belum dikonfigurasi.',409);
  const r=await fetch('https://api.resend.com'+path,{...options,headers:{
    Authorization:'Bearer '+key,
    'Content-Type':'application/json',
    ...(options.headers||{})
  }});
  const text=await r.text();let body={};try{body=text?JSON.parse(text):{}}catch{body={message:text}}
  if(!r.ok){const e=new Error(body?.message||body?.name||`Resend ${r.status}`);e.status=r.status;e.provider=body;throw e}
  return body;
}
async function providerState(c,refresh=false){
  const s=await settings(c),key=await providerKey(c);
  let domainStatus=s?.domain_status||'not_started',providerReachable=false;
  if(refresh&&key&&s?.provider_domain_id){
    try{
      const d=await resend('/domains/'+encodeURIComponent(s.provider_domain_id),key);
      domainStatus=String(d?.status||domainStatus);
      providerReachable=true;
      await q('/rest/v1/email_settings?id=eq.true',c,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({
        domain_status:domainStatus,is_enabled:domainStatus==='verified',updated_at:new Date().toISOString()
      })});
    }catch(e){
      providerReachable=false;
      if(e.status===401||e.status===403)domainStatus='key_invalid';
    }
  }
  return{keyConfigured:!!key,providerReachable,domainStatus,ready:!!key&&domainStatus==='verified'};
}
async function baseRecipients(c){
  const [aw,contacts]=await Promise.all([
    q('/rest/v1/awardees?select=id,legacy_id,name,angkatan,status&order=angkatan.asc,legacy_id.asc',c),
    q('/rest/v1/awardee_contacts?select=awardee_id,email',c)
  ]);
  const cm=new Map((contacts||[]).map(x=>[x.awardee_id,x.email]));
  return (aw||[]).map(a=>({...a,email:cm.get(a.id)||''}));
}
async function resolveRecipients(c,p={}){
  const all=await baseRecipients(c),type=clean(p.audienceType||'active_all',40),f=p.filter||{};
  let ids=null;
  if(type==='manual'){
    const wanted=new Set((Array.isArray(f.awardeeIds)?f.awardeeIds:[]).map(x=>String(x).toUpperCase()));
    ids=new Set(all.filter(a=>wanted.has(String(a.id).toUpperCase())||wanted.has(String(a.legacy_id).toUpperCase())).map(a=>a.id));
  }else if(type==='attendance_status'){
    const sid=clean(f.sessionId,80);if(!sid)bad('Pilih agenda/sesi absensi.');
    const statuses=(Array.isArray(f.statuses)?f.statuses:['Hadir']).map(x=>clean(x,20)).filter(Boolean);
    const rows=await q(`/rest/v1/attendance_records?session_id=eq.${encodeURIComponent(sid)}&status=in.(${statuses.map(x=>encodeURIComponent(x)).join(',')})&select=awardee_id`,c);
    ids=new Set((rows||[]).map(x=>x.awardee_id));
  }else if(type==='reflection_pending'){
    const formRef=clean(f.formId||f.publicCode,100);if(!formRef)bad('Pilih form refleksi.');
    let forms=await q(`/rest/v1/reflection_forms?public_code=eq.${encodeURIComponent(formRef)}&select=id,period_id,agenda_name,agenda_date&limit=1`,c);
    if(!forms?.length)forms=await q(`/rest/v1/reflection_forms?id=eq.${encodeURIComponent(formRef)}&select=id,period_id,agenda_name,agenda_date&limit=1`,c);
    const form=forms?.[0];if(!form)bad('Form refleksi tidak ditemukan.',404);
    let sessions=await q(`/rest/v1/attendance_sessions?period_id=eq.${form.period_id}&activity_name=eq.${encodeURIComponent(form.agenda_name)}&activity_date=eq.${form.agenda_date}&select=id&limit=1`,c);
    if(!sessions?.length)sessions=await q(`/rest/v1/attendance_sessions?period_id=eq.${form.period_id}&activity_name=eq.${encodeURIComponent(form.agenda_name)}&select=id&order=activity_date.desc&limit=1`,c);
    const sess=sessions?.[0];if(!sess)bad('Sesi absensi untuk refleksi tidak ditemukan.',404);
    const [hadir,responses]=await Promise.all([
      q(`/rest/v1/attendance_records?session_id=eq.${sess.id}&status=eq.Hadir&select=awardee_id`,c),
      q(`/rest/v1/reflection_responses?form_id=eq.${form.id}&select=awardee_id`,c)
    ]);
    const done=new Set((responses||[]).map(x=>x.awardee_id));
    ids=new Set((hadir||[]).map(x=>x.awardee_id).filter(id=>!done.has(id)));
  }
  let rows=all.filter(a=>String(a.status||'').toLowerCase()==='aktif');
  if(type==='cohort')rows=rows.filter(a=>String(a.angkatan||'')===String(f.cohort||''));
  if(ids)rows=rows.filter(a=>ids.has(a.id));
  const withEmail=rows.filter(a=>validEmail(a.email));
  const missing=rows.filter(a=>!validEmail(a.email));
  return{
    totalEligible:rows.length,
    totalWithEmail:withEmail.length,
    totalMissingEmail:missing.length,
    recipients:withEmail.map(a=>({id:a.id,legacyId:a.legacy_id,nama:a.name,angkatan:a.angkatan,email:a.email})),
    missingEmail:missing.map(a=>({id:a.id,legacyId:a.legacy_id,nama:a.name,angkatan:a.angkatan}))
  };
}
function renderVars(text,vars){
  return String(text||'').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,(_,k)=>String(vars[k]??''));
}
function prettyDate(v){
  if(!v)return'';
  try{return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Makassar'}).format(new Date(v+'T00:00:00+08:00'))}catch{return String(v)}
}
function varsFor(r,ctx={}){
  return{
    nama:r.nama||'',
    angkatan:r.angkatan||'',
    agenda:ctx.agenda||'',
    tanggal:ctx.tanggalLabel||prettyDate(ctx.tanggal),
    waktu:ctx.waktu||'',
    lokasi:ctx.lokasi||'',
    link_refleksi:ctx.link_refleksi||ctx.linkRefleksi||'',
    deadline:ctx.deadline||''
  };
}
function htmlFromText(text){
  const escaped=escHtml(text).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" style="color:#0f6248;text-decoration:underline">$1</a>');
  return `<!doctype html><html><body style="margin:0;background:#f5f7f6;font-family:Arial,sans-serif;color:#1f2a24"><div style="max-width:640px;margin:0 auto;padding:28px 16px"><div style="background:#ffffff;border:1px solid #e5ebe7;border-radius:18px;overflow:hidden"><div style="padding:22px 26px;background:#062c21;color:white"><div style="font-size:12px;letter-spacing:.16em;font-weight:700">ETOS ID PALU</div><div style="font-size:20px;font-weight:700;margin-top:7px">Awardee Development</div></div><div style="padding:26px;font-size:14px;line-height:1.75">${escaped.replace(/\n/g,'<br>')}</div><div style="padding:16px 26px;border-top:1px solid #edf1ef;font-size:11px;color:#728078">Email ini dikirim melalui dashboard pembinaan ETOS ID Palu.</div></div></div></body></html>`;
}
async function overview(c,refreshProvider=false){
  const [s,st,templates,campaigns,rules,sessions,forms,ags,aw]=await Promise.all([
    settings(c),
    providerState(c,refreshProvider),
    q('/rest/v1/email_templates?select=*&order=updated_at.desc',c),
    q('/rest/v1/email_campaigns?select=id,name,subject,audience_type,mode,scheduled_at,status,recipient_count,accepted_count,failed_count,sent_at,created_at&order=created_at.desc&limit=40',c),
    q('/rest/v1/email_automation_rules?select=*&order=created_at.desc',c),
    q('/rest/v1/attendance_sessions?select=id,activity_name,activity_date,target_cohort&order=activity_date.desc,created_at.desc&limit=80',c),
    q('/rest/v1/reflection_forms?select=id,public_code,agenda_name,agenda_date,status&order=agenda_date.desc,created_at.desc&limit=80',c),
    q('/rest/v1/attendance_agendas?select=id,name,is_active&order=name.asc',c),
    baseRecipients(c)
  ]);
  const cohorts=[...new Set((aw||[]).filter(x=>String(x.status||'').toLowerCase()==='aktif').map(x=>String(x.angkatan||'')).filter(Boolean))].sort();
  const active=(aw||[]).filter(x=>String(x.status||'').toLowerCase()==='aktif');
  return{
    settings:{...s,keyConfigured:st.keyConfigured,providerReachable:st.providerReachable,ready:st.ready,domainStatus:st.domainStatus},
    templates:templates||[],campaigns:campaigns||[],rules:rules||[],
    sessions:sessions||[],forms:forms||[],agendas:ags||[],cohorts,
    awardees:active.map(x=>({id:x.id,legacyId:x.legacy_id,nama:x.name,angkatan:x.angkatan,email:x.email||'',hasEmail:validEmail(x.email)})),
    stats:{active:active.length,withEmail:active.filter(x=>validEmail(x.email)).length,missingEmail:active.filter(x=>!validEmail(x.email)).length}
  };
}
async function saveSettings(c,p){
  const senderName=clean(p.senderName||'ETOS ID Palu',120),senderEmail=clean(p.senderEmail||'info@etosidpalu.com',200),replyTo=clean(p.replyTo||'',200)||null;
  if(!validEmail(senderEmail))bad('Email pengirim tidak valid.');
  if(replyTo&&!validEmail(replyTo))bad('Reply-To tidak valid.');
  const rows=await q('/rest/v1/email_settings?id=eq.true&select=*',c,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({sender_name:senderName,sender_email:senderEmail,reply_to:replyTo,updated_at:new Date().toISOString()})});
  return rows?.[0]||null;
}
async function saveProviderKey(c,p){
  const apiKey=clean(p.apiKey,500);
  if(!/^re_[A-Za-z0-9_-]{8,}$/.test(apiKey))bad('Format Resend API key tidak valid.');
  await rpc('set_email_resend_secret',c,{p_secret:apiKey});
  return providerState(c,true);
}
async function verifyDomain(c){
  const s=await settings(c),key=await providerKey(c);
  if(!key)bad('Simpan Resend API key terlebih dahulu.',409);
  if(!s?.provider_domain_id)bad('ID domain Resend belum tersimpan.',409);
  try{await resend('/domains/'+encodeURIComponent(s.provider_domain_id)+'/verify',key,{method:'POST',body:'{}'})}catch(e){if(e.status!==409)throw e}
  return providerState(c,true);
}
async function saveTemplate(c,p){
  const id=clean(p.id,80),name=clean(p.name,160),category=clean(p.category||'Umum',80),subject=clean(p.subject,240),bodyText=clean(p.bodyText,12000);
  if(name.length<2||subject.length<2||bodyText.length<3)bad('Nama, subjek, dan isi template wajib diisi.');
  const data={name,category,subject,body_text:bodyText,is_active:p.isActive!==false,updated_at:new Date().toISOString()};
  if(id){
    const rows=await q('/rest/v1/email_templates?id=eq.'+encodeURIComponent(id)+'&select=*',c,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(data)});
    if(!rows?.length)bad('Template tidak ditemukan.',404);
    return rows[0];
  }
  const rows=await q('/rest/v1/email_templates?select=*',c,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify([{...data,created_at:new Date().toISOString()}])});
  return rows?.[0]||null;
}
async function deleteTemplate(c,p){
  const id=clean(p.id,80);if(!id)bad('ID template wajib ada.');
  await q('/rest/v1/email_templates?id=eq.'+encodeURIComponent(id),c,{method:'DELETE',headers:{Prefer:'return=minimal'}});
  return{deleted:true,id};
}
async function saveRule(c,p){
  const data={
    name:clean(p.name,160),trigger_type:clean(p.triggerType,60),enabled:!!p.enabled,
    agenda_id:clean(p.agendaId,80)||null,template_id:clean(p.templateId,80)||null,
    offset_minutes:Number.isFinite(Number(p.offsetMinutes))?Number(p.offsetMinutes):0,
    audience_type:clean(p.audienceType||'active_all',60),config:p.config&&typeof p.config==='object'?p.config:{},
    updated_at:new Date().toISOString()
  };
  if(!data.name||!['agenda_reminder','reflection_reminder','report_reminder'].includes(data.trigger_type))bad('Nama dan tipe otomasi tidak valid.');
  const id=clean(p.id,80);
  if(id){
    const rows=await q('/rest/v1/email_automation_rules?id=eq.'+encodeURIComponent(id)+'&select=*',c,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(data)});
    return rows?.[0]||null;
  }
  const rows=await q('/rest/v1/email_automation_rules?select=*',c,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify([{...data,created_at:new Date().toISOString()}])});
  return rows?.[0]||null;
}
async function campaign(c,p){
  const s=await settings(c),st=await providerState(c,true);
  if(!st.ready||!s?.is_enabled)bad('Email belum aktif. Verifikasi domain dan Resend API key di tab Setup.',409);
  const key=await providerKey(c);
  const preview=await resolveRecipients(c,p);
  if(!preview.recipients.length)bad('Tidak ada penerima dengan email valid.',409);
  const name=clean(p.name||p.subject||'Kampanye Email',180),subjectTpl=clean(p.subject,240),bodyTpl=clean(p.bodyText,12000),mode=p.mode==='scheduled'?'scheduled':'now',ctx=p.context&&typeof p.context==='object'?p.context:{};
  if(!subjectTpl||!bodyTpl)bad('Subjek dan isi email wajib diisi.');
  let scheduledAt=null;
  if(mode==='scheduled'){
    const d=new Date(p.scheduledAt);if(Number.isNaN(d.getTime()))bad('Jadwal kirim tidak valid.');
    if(d.getTime()<Date.now()+60_000)bad('Jadwal minimal 1 menit dari sekarang.');
    if(d.getTime()>Date.now()+30*24*60*60*1000)bad('Resend mendukung penjadwalan maksimal 30 hari.');
    scheduledAt=d.toISOString();
  }
  const token=clean(p.clientToken,120)||('mail-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  const existing=await q('/rest/v1/email_campaigns?client_token=eq.'+encodeURIComponent(token)+'&select=*&limit=1',c);
  if(existing?.length)return{campaign:existing[0],deduplicated:true,preview};
  const cr=await q('/rest/v1/email_campaigns?select=*',c,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify([{
    name,template_id:clean(p.templateId,80)||null,subject:subjectTpl,body_text:bodyTpl,
    audience_type:clean(p.audienceType||'active_all',60),audience_filter:p.filter||{},context:ctx,mode,scheduled_at:scheduledAt,
    status:mode==='scheduled'?'sending':'sending',recipient_count:preview.recipients.length,client_token:token
  }])});
  const camp=cr?.[0];if(!camp)bad('Kampanye gagal dibuat.',500);
  const deliveries=[];
  const commonFrom=`${s.sender_name} <${s.sender_email}>`,replyTo=s.reply_to?[s.reply_to]:undefined;
  try{
    if(mode==='now'){
      const payload=preview.recipients.map(r=>{
        const vars=varsFor(r,ctx),text=renderVars(bodyTpl,vars),subject=renderVars(subjectTpl,vars);
        return{from:commonFrom,to:[r.email],subject,text,html:htmlFromText(text),reply_to:replyTo,tags:[{name:'campaign_id',value:String(camp.id).replace(/[^A-Za-z0-9_-]/g,'_')}]};
      });
      for(let i=0;i<payload.length;i+=100){
        const chunk=payload.slice(i,i+100),rr=preview.recipients.slice(i,i+100);
        try{
          const result=await resend('/emails/batch',key,{method:'POST',headers:{'Idempotency-Key':token+'-'+i},body:JSON.stringify(chunk)});
          const data=Array.isArray(result?.data)?result.data:Array.isArray(result)?result:[];
          rr.forEach((r,j)=>deliveries.push({campaign_id:camp.id,awardee_id:r.id,recipient_name:r.nama,recipient_email:r.email,status:'accepted',provider_email_id:data[j]?.id||null,sent_at:new Date().toISOString(),last_event:'accepted',last_event_at:new Date().toISOString(),metadata:{legacy_id:r.legacyId}}));
        }catch(e){
          rr.forEach(r=>deliveries.push({campaign_id:camp.id,awardee_id:r.id,recipient_name:r.nama,recipient_email:r.email,status:'failed',error_message:clean(e.message,1000),last_event:'failed',last_event_at:new Date().toISOString(),metadata:{legacy_id:r.legacyId}}));
        }
      }
    }else{
      for(const r of preview.recipients){
        const vars=varsFor(r,ctx),text=renderVars(bodyTpl,vars),subject=renderVars(subjectTpl,vars);
        try{
          const result=await resend('/emails',key,{method:'POST',headers:{'Idempotency-Key':token+'-'+r.legacyId},body:JSON.stringify({
            from:commonFrom,to:[r.email],subject,text,html:htmlFromText(text),reply_to:replyTo,scheduled_at:scheduledAt,
            tags:[{name:'campaign_id',value:String(camp.id).replace(/[^A-Za-z0-9_-]/g,'_')}]
          })});
          deliveries.push({campaign_id:camp.id,awardee_id:r.id,recipient_name:r.nama,recipient_email:r.email,status:'scheduled',provider_email_id:result?.id||result?.data?.id||null,scheduled_at:scheduledAt,last_event:'scheduled',last_event_at:new Date().toISOString(),metadata:{legacy_id:r.legacyId}});
        }catch(e){
          deliveries.push({campaign_id:camp.id,awardee_id:r.id,recipient_name:r.nama,recipient_email:r.email,status:'failed',error_message:clean(e.message,1000),scheduled_at:scheduledAt,last_event:'failed',last_event_at:new Date().toISOString(),metadata:{legacy_id:r.legacyId}});
        }
      }
    }
    if(deliveries.length)await q('/rest/v1/email_deliveries',c,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(deliveries)});
    const accepted=deliveries.filter(x=>['accepted','scheduled'].includes(x.status)).length,failed=deliveries.filter(x=>x.status==='failed').length;
    const status=failed===0?(mode==='scheduled'?'scheduled':'sent'):accepted>0?'partial':'failed';
    const rows=await q('/rest/v1/email_campaigns?id=eq.'+camp.id+'&select=*',c,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({
      status,accepted_count:accepted,failed_count:failed,sent_at:mode==='now'?new Date().toISOString():null,updated_at:new Date().toISOString()
    })});
    return{campaign:rows?.[0]||camp,preview,deliveries:{accepted,failed}};
  }catch(e){
    await q('/rest/v1/email_campaigns?id=eq.'+camp.id,c,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'failed',failed_count:preview.recipients.length,updated_at:new Date().toISOString()})}).catch(()=>{});
    throw e;
  }
}
async function campaignDetail(c,p){
  const id=clean(p.id,80);if(!id)bad('ID kampanye wajib ada.');
  const [rows,deliveries]=await Promise.all([
    q('/rest/v1/email_campaigns?id=eq.'+encodeURIComponent(id)+'&select=*',c),
    q('/rest/v1/email_deliveries?campaign_id=eq.'+encodeURIComponent(id)+'&select=*&order=created_at.asc',c)
  ]);
  if(!rows?.length)bad('Kampanye tidak ditemukan.',404);
  return{campaign:rows[0],deliveries:deliveries||[]};
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return out(res,405,{success:false,error:'Method not allowed'});
  if(!session.verify(req))return out(res,401,{success:false,error:'PIN fasilitator diperlukan untuk Email Center.'});
  try{
    const c=session.credential(req);if(!c)return out(res,401,{success:false,error:'Session PIN tidak valid.'});
    const action=clean(req.body?.action||'overview',60),p=req.body?.data||{};
    let data;
    if(action==='overview')data=await overview(c,!!p.refreshProvider);
    else if(action==='preview')data=await resolveRecipients(c,p);
    else if(action==='save_settings')data=await saveSettings(c,p);
    else if(action==='save_provider_key')data=await saveProviderKey(c,p);
    else if(action==='verify_domain')data=await verifyDomain(c);
    else if(action==='save_template')data=await saveTemplate(c,p);
    else if(action==='delete_template')data=await deleteTemplate(c,p);
    else if(action==='save_rule')data=await saveRule(c,p);
    else if(action==='send_campaign')data=await campaign(c,p);
    else if(action==='campaign_detail')data=await campaignDetail(c,p);
    else return out(res,404,{success:false,error:'Aksi Email Center tidak ditemukan.'});
    return out(res,200,{success:true,data});
  }catch(e){
    console.error('[email-center]',e);
    return out(res,Number(e.status)||500,{success:false,error:e.message||String(e)});
  }
};