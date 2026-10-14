/* Superadmin writing reports & lightweight editorial controls.
   Authenticated exclusively through existing secure Superadmin session cookie. */
(()=>{'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const BASE='https://gagasan-etos-palu.vercel.app/t/',SB='https://weklmapqizeldfdalbgs.supabase.co';
const categories=['Opini','Esai','Resensi Buku','Refleksi','Gagasan & Inovasi','Artikel Ilmiah Populer'];
let all={awardees:[],articles:[]},busy=false;
async function api(action,params={}){
 const r=await fetch('/api/secure',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({function:'readmapAdmin',params:{action,...params}})});
 const obj=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(obj.error||'Sesi Superadmin belum aktif. Login PIN lewat Dashboard ETOS.');
 return obj;
}
function currentMonth(){const parts=new Intl.DateTimeFormat('en-US',{year:'numeric',month:'2-digit',timeZone:'Asia/Makassar'}).formatToParts(new Date());return parts.find(x=>x.type==='year').value+'-'+parts.find(x=>x.type==='month').value}
function periodArticle(a){const month=$('gagasan-period').value;const dt=a.status==='published'?a.published_at:a.created_at;return !month||String(dt||'').slice(0,7)===month}
function cohortList(){const select=$('gagasan-cohort'),prior=select.value,list=[...new Set(all.awardees.map(a=>a.angkatan).filter(Boolean))].sort();select.innerHTML='<option value="">Seluruh angkatan</option>'+list.map(x=>'<option>'+esc(x)+'</option>').join('');if(list.includes(prior))select.value=prior}
function authors(){
 const cohort=$('gagasan-cohort').value,roster=all.awardees.filter(a=>!cohort||a.angkatan===cohort);
 const relevant=all.articles.filter(a=>a.status==='published'&&periodArticle(a)),authors=new Map();
 relevant.forEach(a=>authors.set(a.awardee_id,(authors.get(a.awardee_id)||0)+1));
 const done=roster.filter(a=>authors.has(a.id)),missing=roster.filter(a=>!authors.has(a.id));
 $('gagasan-stats').innerHTML=[['Awardee Aktif',roster.length],['Sudah Menulis',done.length],['Belum Menulis',missing.length],['Artikel Terbit',relevant.filter(a=>roster.some(r=>r.id===a.awardee_id)).length]].map(([title,num])=>'<div class="metric"><b>'+num+'</b><small>'+esc(title)+'</small></div>').join('');
 $('gagasan-authors').innerHTML=roster.slice().sort((a,b)=>(authors.has(a.id)===authors.has(b.id)?a.name.localeCompare(b.name,'id'):authors.has(a.id)?1:-1)).map(a=>
  '<article class="item" style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><strong>'+esc(a.name)+'</strong><small>Angkatan '+esc(a.angkatan||'—')+' · '+(a.provisioned?'Akun aktif':'Akun Ruang Awardee belum dibuat')+'</small></div><span class="service-status">'+(authors.has(a.id)?'Sudah menulis · '+authors.get(a.id):'Belum menulis')+'</span></article>'
 ).join('')||'<p>Belum ada Awardee aktif untuk filter ini.</p>';
}
function cover(a){return a.cover_path?SB+'/storage/v1/object/public/gagasan-covers/'+a.cover_path:''}
function articleCard(a){
 const canShare=a.status==='published'&&a.share_enabled;
 return '<article class="item" data-gagasan-card="'+esc(a.id)+'"><details><summary style="cursor:pointer"><strong>'+esc(a.title||'Tanpa judul')+'</strong><small>'+esc(a.author_name)+' · '+esc(a.category)+' · '+(canShare?'Terbit':a.status==='draft'?'Draf':'Disembunyikan')+'</small></summary>'+
 '<div class="admin-service-edit" style="padding-top:15px;display:grid;gap:12px">'+
 (cover(a)?'<a href="'+esc(cover(a))+'" target="_blank" rel="noopener noreferrer"><img loading="lazy" width="190" style="max-width:100%;border-radius:9px" src="'+esc(cover(a))+'" alt="Sampul tulisan"></a>':'')+
 '<label>Judul tulisan<input data-field="title" value="'+esc(a.title)+'" maxlength="180"></label>'+
 '<label>Kategori<select data-field="category">'+categories.map(c=>'<option '+(a.category===c?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select></label>'+
 '<label>Ringkasan<textarea rows="3" data-field="excerpt" maxlength="400">'+esc(a.excerpt||'')+'</textarea></label>'+
 '<label>Isi tulisan<textarea rows="8" data-field="body" maxlength="50000">'+esc(a.body||'')+'</textarea></label>'+
 '<label>Ganti sampul (opsional, JPEG/PNG/WebP)<input data-field="cover" type="file" accept="image/jpeg,image/png,image/webp"></label>'+
 '<label>Status<select data-field="status"><option value="published" '+(a.status==='published'?'selected':'')+'>Terbit</option><option value="hidden" '+(a.status==='hidden'?'selected':'')+'>Disembunyikan</option><option value="draft" '+(a.status==='draft'?'selected':'')+'>Draf</option></select></label>'+
 '<div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" data-gagasan-save="'+esc(a.id)+'">Simpan Perubahan</button>'+(canShare?'<button type="button" class="secondary" data-gagasan-share="'+esc(a.id)+'">Salin Link</button>':'')+'</div></div></details></article>';
}
function renderArticles(){
 const cohort=$('gagasan-cohort').value,roster=new Set(all.awardees.filter(a=>!cohort||a.angkatan===cohort).map(a=>a.id));
 const list=all.articles.filter(a=>roster.has(a.awardee_id)&&periodArticle(a)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 $('gagasan-articles').innerHTML=list.map(articleCard).join('')||'<p>Tidak ada tulisan pada periode yang dipilih.</p>';
}
function render(){authors();renderArticles()}
async function load(){
 if(busy)return;busy=true;$('gagasan-refresh').disabled=true;
 try{all=await api('gagasanReport');cohortList();render()}
 catch(e){$('gagasan-stats').textContent='Laporan belum dapat dimuat: '+e.message;$('gagasan-authors').textContent='Sesi Superadmin diperlukan.';$('gagasan-articles').textContent=''}
 finally{busy=false;$('gagasan-refresh').disabled=false}
}
function fileJPEG(file){return new Promise(async(resolve,reject)=>{
 try{
  if(!file||file.size>30*1024*1024)throw Error('Foto asli maksimal 30 MB.');
  const url=URL.createObjectURL(file);
  let image;
  try{image=await new Promise((ok,fail)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>fail(Error('Foto tidak dapat dibaca.'));i.src=url})}
  finally{URL.revokeObjectURL(url)}
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;const c=canvas.getContext('2d');
  const scale=Math.max(1200/image.width,630/image.height),w=image.width*scale,h=image.height*scale;c.drawImage(image,(1200-w)/2,(630-h)/2,w,h);
  let blob;
  for(const q of [.82,.7,.55,.43]){blob=await new Promise((ok,fail)=>canvas.toBlob(x=>x?ok(x):fail(Error('Kompresi gagal.')),'image/jpeg',q));if(blob.size<=400*1024)break}
  if(blob.size>512*1024)throw Error('Foto masih terlalu besar.');
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Foto gagal dikodekan.'));reader.readAsDataURL(blob);
 }catch(e){reject(e)}
})}
$('gagasan-articles').addEventListener('click',async e=>{
 const share=e.target.closest('[data-gagasan-share]');if(share){const a=all.articles.find(x=>x.id===share.dataset.gagasanShare);if(!a)return;try{await navigator.clipboard.writeText(BASE+a.id+'-'+a.title.toLowerCase().replace(/[^a-z0-9]+/g,'-'));share.textContent='Disalin ✓'}catch{prompt('Salin link',BASE+a.id)}return}
 const save=e.target.closest('[data-gagasan-save]');if(!save)return;
 const id=save.dataset.gagasanSave,card=save.closest('[data-gagasan-card]');if(!card)return;
 const v=name=>card.querySelector('[data-field="'+name+'"]')?.value||'';
 save.disabled=true;save.textContent='Menyimpan…';
 try{
  const a=all.articles.find(x=>x.id===id),file=card.querySelector('[data-field="cover"]').files?.[0];
  let path=a.cover_path;
  if(file){save.textContent='Mengolah foto…';const image=await fileJPEG(file);const ticket=await api('gagasanCover',{image});path=ticket.path}
  await api('gagasanUpdate',{id,title:v('title'),category:v('category'),excerpt:v('excerpt'),body:v('body'),status:v('status'),cover_path:path});
  save.textContent='Tersimpan ✓';await load()
 }catch(err){alert('Gagal menyimpan: '+err.message);save.textContent='Simpan Perubahan'}
 finally{save.disabled=false}
});
$('gagasan-refresh').addEventListener('click',load);
$('gagasan-period').addEventListener('change',render);$('gagasan-cohort').addEventListener('change',render);
$('gagasan-period').value=currentMonth();load();
})();