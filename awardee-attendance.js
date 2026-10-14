/* Kehadiran Saya · ETOS Palu. Read-only and private to the signed-in Awardee. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const bridge=()=>window.ETOS_AWARDEE_BRIDGE;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'" :'&#39;'}[c]));
const labels={Hadir:'Hadir',Izin:'Izin',Sakit:'Sakit',Alpa:'Alpa'};
const demoRecords=[
 ['2026-09-27','Pembinaan Wilayah','wilayah','Hadir'],
 ['2026-10-01','Kajian Keislaman','wilayah','Hadir'],
 ['2026-10-05','Coaching Mingguan','wilayah','Izin'],
 ['2026-10-07','Asrama · Drilling Vocab','asrama','Hadir'],
 ['2026-10-08','Asrama · Kajian Islam','asrama','Hadir'],
 ['2026-10-09','Asrama · Tahsin WAFA / Tahfizh','asrama','Hadir'],
 ['2026-10-12','Asrama · Kajian Islam','asrama','Hadir'],
 ['2026-10-13','Asrama · Sharing Knowledge','asrama','Izin']
].map(([date,agenda,type,status])=>({date,agenda,type,status}));
const counts=(items)=>items.reduce((a,x)=>{if(labels[x.status])a[x.status]++;return a},{Hadir:0,Izin:0,Sakit:0,Alpa:0});
const pct=c=>{const t=c.Hadir+c.Izin+c.Sakit+c.Alpa;return t?Math.round(c.Hadir/t*100):null};
function fmtDate(date){
 try{return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(new Date(String(date).slice(0,10)+'T12:00:00+08:00'))}
 catch{return String(date||'')}
}
function month(date){
 const mm=String(date||'').slice(0,7);
 const [y,m]=mm.split('-');return (['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][Math.max(0,Number(m)-1)]||mm)+' '+y;
}
function metric(label,value,detail){
 return '<div class="attendance-kpi"><strong>'+escape(value)+'</strong><span>'+escape(label)+'</span>'+(detail?'<small>'+escape(detail)+'</small>':'')+'</div>';
}
function bySource(rows,source){
 const data=rows.filter(x=>x.type===source),c=counts(data),rate=pct(c);
 return '<div class="attendance-source-card"><div class="attendance-source-top"><div><small>PEMBINAAN '+(source==='asrama'?'ASRAMA':'WILAYAH')+'</small><h4>'+data.length+' pertemuan tercatat</h4></div><strong>'+(rate===null?'—':rate+'%')+'</strong></div>'+
 '<div class="attendance-progress"><i style="width:'+(rate||0)+'%"></i></div>'+
 '<p>'+c.Hadir+' Hadir · '+c.Izin+' Izin · '+c.Sakit+' Sakit · '+c.Alpa+' Alpa</p></div>';
}
function render(report){
 const all=(report.records||[]).filter(x=>labels[x.status]&&['asrama','wilayah'].includes(x.type));
 const ordered=[...all].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const summary=counts(ordered),rate=pct(summary);
 $('awardee-attendance-stats').innerHTML=
  metric('Tingkat kehadiran',rate===null?'—':rate+'%','dari agenda berstatus')+
  metric('Hadir',summary.Hadir,'pertemuan')+
  metric('Izin / Sakit',summary.Izin+summary.Sakit,'dicatat terpisah')+
  metric('Alpa',summary.Alpa,'pertemuan');
 let advice='';
 if(!ordered.length)advice='Belum ada status kehadiran yang tercatat untuk akunmu. Absensi akan tampil setelah fasilitator menyimpan data kegiatan.';
 else if(ordered.length===1)advice='Kehadiran pertamamu sudah tercatat. Ikuti agenda berikutnya untuk mulai melihat perkembangan konsistensimu.';
 else if(rate>=85)advice='Kehadiranmu tercatat cukup konsisten. Pertahankan partisipasi dan manfaatkan setiap kegiatan untuk belajar hal baru.';
 else advice='Setiap agenda memberi kesempatan belajar. Perhatikan jadwal pembinaan berikutnya dan komunikasikan kendala ke fasilitator.';
 $('awardee-attendance-advice').textContent=advice;
 const monthly=new Map();
 for(const x of ordered){
  const key=String(x.date).slice(0,7);
  if(!monthly.has(key))monthly.set(key,[]);
  monthly.get(key).push(x);
 }
 $('awardee-attendance-monthly').innerHTML=monthly.size?
  [...monthly.entries()].slice(-8).map(([k,entries])=>{
   const c=counts(entries),value=pct(c);
   return '<div class="attendance-month-row"><div><b>'+escape(month(k))+'</b><small>'+entries.length+' agenda tercatat</small></div>'+
    '<div class="attendance-progress"><i style="width:'+(value||0)+'%"></i></div><strong>'+(value===null?'—':value+'%')+'</strong></div>';
  }).join(''):'<div class="attendance-empty">Grafik akan terbentuk setelah ada absensi yang tercatat.</div>';
 const wilayah=ordered.filter(x=>x.type==='wilayah'),asrama=ordered.filter(x=>x.type==='asrama');
 const isAsrama=report.cohort==='2026';
 $('awardee-attendance-sources').innerHTML=bySource(ordered,'wilayah')+
  (isAsrama?bySource(ordered,'asrama'):
   '<div class="attendance-source-card attendance-not-applicable"><small>PEMBINAAN ASRAMA</small><h4>Tidak berlaku untuk angkatanmu</h4><p>Rekapmu hanya menghitung kegiatan wilayah yang ditujukan kepadamu.</p></div>');
 const list=ordered.slice().reverse();
 $('awardee-attendance-history').innerHTML=list.length?list.map(x=>
   '<div class="attendance-history-row"><div><b>'+escape(x.agenda)+'</b><small>'+escape(fmtDate(x.date))+' · '+(x.type==='asrama'?'Asrama':'Wilayah')+'</small></div><span class="attendance-label" data-state="'+escape(x.status)+'">'+escape(x.status)+'</span></div>'
 ).join(''):'<p>Belum ada riwayat kehadiran.</p>';
 if(bridge()?.getIsDemo?.()){
   $('awardee-attendance-advice').textContent='Mode Demo — '+advice;
 }
 const h=$('attendance-panel').querySelector('.section-intro p');
 if(h)h.textContent=isAsrama?'Rekap kehadiran pembinaan wilayah dan asrama yang tercatat khusus untuk akunmu.':'Rekap pembinaan wilayah yang memang tercatat untuk akunmu.';
}
async function load(){
 if(!bridge()?.getAwardee?.())return;
 if(bridge().getIsDemo?.()){render({cohort:'2026',records:demoRecords});return}
 $('awardee-attendance-stats').innerHTML='<p>Memuat catatan kehadiranmu…</p>';
 const {data,error}=await bridge().client.rpc('my_attendance_report');
 if(error)throw error;
 render(data||{cohort:'',records:[]});
}
$('go-to-reflections').addEventListener('click',()=>{
 bridge()?.openPanel?.('tahsin');
 $('tahsin-panel').scrollIntoView({behavior:'smooth',block:'start'});
});
window.addEventListener('readmap:panel',event=>{
 if(event.detail?.panel==='attendance')load().catch(e=>{
  $('awardee-attendance-stats').textContent='Kehadiran belum dapat dimuat: '+e.message;
 });
});
window.addEventListener('readmap:ready',()=>{
 // Load on demand; no request is made on every page visit.
 if(!($('attendance-panel')?.hidden))load().catch(()=>{});
});
})();