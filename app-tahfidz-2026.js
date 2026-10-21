/* Tahfidz 2026 — integrated monitoring; single designated operator. */
(function(){
'use strict';
const rootId='ki-tahfidz-root',esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=null,selected=null,busy=false;
const card=(label,v)=>'<div class="tf-metric"><small>'+label+'</small><strong>'+esc(v)+'</strong></div>';
async function api(params){
 const r=await fetch('/api/public-attendance',{
  method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'tahfidz2026',params})
 });
 const j=await r.json().catch(()=>({}));
 if(!r.ok||j.success===false)throw Error(j.error||'Koneksi Tahfidz gagal.');
 return j.data;
}

function accepted(plan){
 const seen=new Set();
 const base=(data.baselines||[]).filter(x=>x.awardee_id===plan.awardee_id);
 for(const b of base)for(let i=1;i<=Number(b.accepted_until);i++)seen.add(b.surah_no+':'+i);
 for(const s of data.submissions||[])if(s.awardee_id===plan.awardee_id&&!s.voided_at&&s.kind==='Baru'&&s.grade==='L')for(let i=Number(s.ayah_from);i<=Number(s.ayah_to);i++)seen.add(s.surah_no+':'+i);
 return seen;
}
function current(){
 const p=data?.plans?.find(x=>x.awardee_id===selected);return p||data?.plans?.[0];
}
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
function render(){
 const root=document.getElementById(rootId);if(!root||!data)return;
 const plans=data.plans||[],surahs=data.surahs||[],total=surahs.reduce((a,x)=>a+Number(x.ayah_count),0);
 const p=current();if(!p){root.innerHTML='<div class="card p-6">Belum ada peserta Tahfidz 2026.</div>';return}selected=p.awardee_id;
 const seen=accepted(p),pct=total?Math.round(seen.size/total*1000)/10:0,done=surahs.filter(s=>Array.from({length:Number(s.ayah_count)},(_,i)=>seen.has(s.surah_no+':'+(i+1))).every(Boolean)).length;
 const days=p.target_date?Math.max(0,Math.ceil((new Date(p.target_date+'T00:00:00Z')-new Date(today()+'T00:00:00Z'))/86400000)):null;
 const weekly=days===null?'Tentukan target':days===0?(total-seen.size?'Lewat target':'Selesai'):Math.ceil((total-seen.size)/(days/7))+' ayat / pekan';
 const entries=(data.submissions||[]).filter(x=>x.awardee_id===p.awardee_id).slice(0,80);
 root.innerHTML='<div class="tf-root"><div class="tf-hero"><div class="tf-overline">ETOS ID PALU · PEMBINAAN KEISLAMAN / 2026</div><h3>Tahfidz Intelligence</h3><p>Satu kartu kontrol digital. Dicatat oleh fasilitator / admin keuangan.</p><div class="tf-summary"><span>'+plans.length+' peserta</span><span>37 surah</span><span>'+total+' ayat</span></div></div>'+
 '<div class="tf-roster">'+plans.map(x=>{const n=accepted(x).size;return '<button type="button" class="tf-person '+(x.awardee_id===selected?'active':'')+'" data-person="'+esc(x.awardee_id)+'"><span>'+esc(x.awardees?.name||'Awardee')+'</span><small>'+n+' / '+total+' ayat</small><i style="width:'+Math.min(100,n/total*100)+'%"></i></button>'}).join('')+'</div>'+
 '<div class="tf-metrics">'+card('Tercatat',seen.size+' ayat')+card('Sisa hafalan',(total-seen.size)+' ayat')+card('Progres',pct+'%')+card('Surah tuntas',done+' / 37')+'</div>'+
 '<div class="tf-block"><div class="tf-title"><div><small>KARTU KONTROL JUZ 30</small><h4>'+esc(p.awardees?.name||'Awardee')+'</h4></div><button type="button" class="tf-reload" data-refresh>↻ Perbarui</button></div><div class="tf-bar"><i style="width:'+pct+'%"></i></div><p class="tf-caption">'+pct+'% selesai · '+(total-seen.size)+' ayat tersisa</p>'+
 '<form id="tf-target"><div class="tf-fields"><label>Mulai <input name="start_date" type="date" value="'+esc(p.start_date||'')+'"></label><label>Target selesai <input name="target_date" type="date" value="'+esc(p.target_date||'')+'"></label><button type="submit" class="tf-button tf-outline">Simpan target</button></div></form><p class="tf-target">Kebutuhan menuju target: <b>'+esc(weekly)+'</b></p></div>'+
 '<div class="tf-columns"><div class="tf-block"><div class="tf-title"><h4>Catat Setoran</h4><small>Langsung tersimpan tanpa verifikasi berlapis</small></div><form id="tf-form" class="tf-form"><label>Tanggal <input type="date" name="submitted_on" required value="'+today()+'"></label><label>Surah<select name="surah_no" required>'+surahs.map(s=>'<option value="'+s.surah_no+'">'+esc(s.name)+' · '+s.ayah_count+' ayat</option>').join('')+'</select></label><div class="tf-fields"><label>Ayat awal<input type="number" name="ayah_from" value="1" min="1" required></label><label>Ayat akhir<input type="number" name="ayah_to" value="1" min="1" required></label></div><div class="tf-fields"><label>Jenis<select name="kind"><option value="Baru">Setoran baru</option><option value="M">Murajaah</option></select></label><label>Nilai<select name="grade"><option value="L">L · Lancar</option><option value="KL">KL · Kurang lancar</option><option value="U">U · Ulang</option></select></label></div><label>Catatan koreksi (opsional)<textarea name="notes" maxlength="500" rows="2" placeholder="Contoh: tajwid mad perlu diperhatikan"></textarea></label><button type="submit" class="tf-button">Simpan Setoran <span>→</span></button><p class="tf-caption">Hanya setoran baru bernilai L yang menambah ayat tercapai. Murajaah dan U/KL tetap ada di riwayat.</p></form></div>'+
 '<div class="tf-block"><div class="tf-title"><h4>37 Surah</h4><small>Progres ayat unik</small></div><div class="tf-surahs">'+surahs.map(s=>{let n=0;for(let i=1;i<=s.ayah_count;i++)if(seen.has(s.surah_no+':'+i))n++;return '<div class="tf-surah"><div><b>'+String(s.surah_no).padStart(2,'0')+'</b> '+esc(s.name)+'</div><span>'+n+'/'+s.ayah_count+'</span><i class="'+(n===s.ayah_count?'done':'')+'" style="width:'+(100*n/s.ayah_count)+'%"></i></div>'}).join('')+'</div></div></div>'+
 '<div class="tf-block"><div class="tf-title"><h4>Riwayat Setoran</h4><small>'+entries.filter(x=>!x.voided_at).length+' catatan terbaru</small></div><div class="tf-history">'+(entries.length?entries.map(s=>'<div class="tf-entry '+(s.voided_at?'void':'')+'"><div><b>'+esc(surahs.find(x=>x.surah_no===s.surah_no)?.name||s.surah_no)+'</b><small>'+esc(s.submitted_on)+' · '+esc(s.kind)+' · Ayat '+s.ayah_from+'–'+s.ayah_to+' · '+esc(s.grade)+'</small>'+(s.notes?'<small>'+esc(s.notes)+'</small>':'')+'</div>'+(s.voided_at?'<span>Dibatalkan</span>':'<button type="button" data-void="'+esc(s.id)+'" title="Batalkan catatan salah">Batalkan</button>')+'</div>').join(''):'<p class="tf-caption">Belum ada setoran baru. Progres awal berasal dari kartu kontrol Excel.</p>')+'</div></div></div>';
 window.lucide?.createIcons?.();
}
async function reload(){const root=document.getElementById(rootId);if(root)root.innerHTML='<div class="card p-6">Mengambil data Tahfidz 2026…</div>';try{data=await api({action:'list'});render()}catch(e){if(root)root.innerHTML='<div class="card p-6">Tidak dapat membuka Tahfidz: '+esc(e.message)+'</div>'}}
document.addEventListener('click',async ev=>{
 const root=document.getElementById(rootId);if(!root?.contains(ev.target))return;
 const p=ev.target.closest('[data-person]');if(p){selected=p.dataset.person;render();return}
 if(ev.target.closest('[data-refresh]')){await reload();return}
 const btn=ev.target.closest('[data-void]');if(btn){if(busy)return;if(!confirm('Batalkan catatan ini? Riwayat tidak dihapus.'))return;busy=true;try{await api({action:'void',id:btn.dataset.void});await reload()}catch(e){alert(e.message)}finally{busy=false}}
});
document.addEventListener('submit',async ev=>{
 if(!['tf-form','tf-target'].includes(ev.target?.id))return;
 ev.preventDefault();if(busy)return;busy=true;const form=ev.target,btn=form.querySelector('button[type=submit]');if(btn)btn.disabled=true;
 try{const fields=Object.fromEntries(new FormData(form).entries());await api(form.id==='tf-target'?{action:'target',awardee_id:selected,...fields}:{action:'save',awardee_id:selected,...fields});await reload()}catch(e){alert(e.message)}finally{busy=false;if(btn)btn.disabled=false}
});
function checkAccess(){
 const valid=typeof state!=='undefined'&&!!(state.auth&&state.session?.kind==='pin');
 window.ETOS_TAHFIDZ_ALLOWED=valid;
 if(!valid)data=null;
 return valid;
}
window.ETOSTahfidz2026={load:reload,checkAccess};
})();
