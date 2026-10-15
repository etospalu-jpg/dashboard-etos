(function(){
'use strict';
if(window.ETOS_SKI_READY)return;
window.ETOS_SKI_READY='v1';
const REPORT='https://portal-etos-id.vercel.app/login';
const FORM='https://docs.google.com/forms/d/e/1FAIpQLSdBixfOizFknYwwj1Ais4K8J__oGV-fosLETKJ66wh-ptwReA/viewform';
const LOOKER='https://datastudio.google.com/u/0/reporting/978106c1-dc1a-4edc-9a78-219fe6f4ae73/page/p_93dsqdpx7d';
const PERIODS={
'2026-2':[
['pembinaan','Implementasi pembinaan',21,'90% silabus, tugas, dan kehadiran pembinaan reguler','Absensi telah tercatat; silabus dan penugasan belum sepenuhnya terpetakan.'],
['kualitas','Kualitas pembinaan',16,'80% Awardee menunjukkan profil INSPIRATIF; sesuai SOP dan asesmen sah','Observasi dan bukti SOP tetap memerlukan penilaian manusia.'],
['penokohan','Penokohan kampus & daerah',15,'50% tingkat 3–4 strategis; 50% tingkat 1–2 aktif; minimal 1 berpengaruh','Riwayat jabatan perlu diverifikasi beserta dampak dan SK.'],
['akademik','IPK & prestasi akademik',11,'90% IPK minimal 3,00; 30% prestasi nasional','Data prestasi eksternal belum dapat tersinkron otomatis.'],
['publikasi','Publikasi & media wilayah',8,'Minimal 6 konten Instagram tiap bulan dan 1 tulisan media eksternal','Ruang Gagasan internal bukan bukti artikel media eksternal.'],
['capacity','Capacity Building fasilitator',7,'Mengikuti minimal 90% kegiatan Tim Pusat','Bukti kehadiran dan penerapan hasil diperlukan.'],
['coaching','Coaching Awardee',6,'2 sesi bermakna per Awardee per semester dan tindak lanjut','Sesi dicatat di modul Coaching dashboard.'],
['duta','Seleksi Duta Inspiratif',5,'1–2 perwakilan wilayah','Butuh berita acara atau keputusan penetapan.'],
['espresi','Pelaporan ESPRESI',5,'Pembaruan ESPRESI maksimal tanggal 25 setiap bulan','Terpisah dari formulir prestasi Awardee.'],
['yic','Youth Inspiraction Camp',3,'Minimal 90% Awardee mengikuti YIC','Bukti partisipasi kegiatan diperlukan.'],
['bulanan','Pelaporan perkembangan diri',3,'100% laporan perkembangan diri Awardee, maksimal tanggal 10 setiap bulan','Laporan Awardee melalui portal ETOS, bukan formulir baru.']
],
'2027-1':[
['seleksi','Seleksi penerima manfaat',8,'Minimal 200 pendaftar wilayah; 7 PM angkatan 2027','Bukti proses seleksi dan penetapan diperlukan.'],
['ktg','Kuliah Tak Gentar',5,'90% Awardee mengikuti KTG','Bukti partisipasi diperlukan.'],
['capacity','Capacity Building fasilitator',5,'Mengikuti minimal 90% agenda Tim Pusat','Bukti kehadiran diperlukan.'],
['coaching','Coaching Awardee',8,'2 sesi per Awardee per semester','Dokumentasikan tindak lanjut.'],
['akademik','IPK & prestasi',4,'90% IPK minimal 3,00; 30% prestasi nasional','Periksa bukti resmi per periode.'],
['espresi','Pelaporan ESPRESI',3,'Pembaruan maksimal tanggal 24 setiap bulan','Tenggat berbeda dengan 2026.'],
['anggaran','Serapan anggaran',9,'Minimal 98% serapan tiap bulan','Rekap dan konfirmasi Adminkeu.'],
['uang_muka','Uang muka',4,'Laporan 100% sebelum tanggal 27; bukti tidak kedaluwarsa','Dokumen keuangan privat.'],
['arsip','Database & arsip wilayah',4,'Database dan arsip digital selalu mutakhir','Rekap dokumen dan inventaris.'],
['bulanan','Pelaporan pembinaan',7,'100% laporan fasilitator dan perkembangan diri Awardee sebelum tanggal 10','Dua pelaporan berbeda di portal masing-masing.'],
['pembinaan','Implementasi pembinaan',13,'90% silabus, penugasan dan kehadiran','Periksa penyelesaian kegiatan.'],
['penokohan','Penokohan kampus & daerah',9,'50% tingkat 3–4 strategis; 50% tingkat 1–2 aktif; minimal 1 berpengaruh','Bukti posisi dan aktivitas.'],
['kualitas','Kualitas pembinaan',16,'80% IPK pembinaan >3,00, sesuai SOP, asesmen sah dan monev','Gunakan bukti sah, bukan persepsi.'],
['publikasi','Publikasi & media wilayah',5,'6 konten IG per bulan dan 1 artikel media eksternal','Verifikasi tautan terbit.']
]};
const reportKinds=[
['fasilitator','Laporan Bulanan Fasilitator','Laporan Anda disampaikan melalui Portal ETOS, bukan melalui dashboard ini.',REPORT,'Buka portal laporan'],
['awardee_reminder','Pengingat Laporan Awardee','Awardee melapor di portal masing-masing. Dashboard hanya membantu mengingatkan.',REPORT,'Buka portal Awardee'],
['espresi','Pembaruan ESPRESI','Catat bukti pembaruan data ESPRESI Anda. Formulir prestasi Awardee dipisahkan.',FORM,'Formulir prestasi Awardee'],
['prestasi','Pemantauan Prestasi','Pantau Looker Studio dan catat hasil yang dapat dibuktikan.',LOOKER,'Buka pemantauan prestasi']
];
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&amp;','>':'&gt;','"':'&quot;',"'":'&#39;','"':'&quot;'}[c]));
const toastS=(v,type='warn')=>window.toast?.(v,type);
const monthNow=()=>{const d=new Date(Date.now()+8*60*60*1000);return d.toISOString().slice(0,7)};
let tab='overview',period='2026-2',month=monthNow(),loaded=null,gate=null,busy=false;
const pin=()=>{try{return state.auth&&state.session?.kind==='pin'}catch{return false}};
function safeLink(url,label){return '<a class="ski-link" href="'+E(url)+'" target="_blank" rel="noopener noreferrer">'+E(label)+' ↗</a>'}
function safeErr(msg){return '<div class="ski-alert">'+E(msg)+'</div>'}
async function call(action,data){
 const r=await fetch('/api/secure',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({function:'skiPrivate',params:{action,data:data||{}}})});
 const b=await r.json().catch(()=>({}));if(!r.ok||b.success===false)throw new Error(b.error||'Layanan SKI belum tersedia.');
 return b.data;
}
function ensure(){
 const nav=document.querySelector('#sidebar nav'),host=document.querySelector('.content-pad');
 if(nav&&!document.getElementById('ski-nav')){const b=document.createElement('button');b.id='ski-nav';b.className='nav-btn';b.type='button';b.dataset.view='ski';b.style.display='none';b.innerHTML='<i data-lucide="shield-check" class="w-4 h-4"></i>SKI Saya · Privat<span class="nav-dot"></span>';b.onclick=()=>window.openSki();const anchor=nav.querySelector('[data-view="mentoring"]');anchor?.after(b);}
 if(host&&!document.getElementById('view-ski')){const box=document.createElement('section');box.id='view-ski';box.className='view ski-page';host.appendChild(box);}
 syncNav();window.lucide?.createIcons?.();
}
function syncNav(){const n=document.getElementById('ski-nav');if(n)n.style.display=pin()?'flex':'none'}
const origUpdate=window.updateAuthUI;
if(typeof origUpdate==='function')window.updateAuthUI=function(){const r=origUpdate.apply(this,arguments);syncNav();return r};
try{secureViews.add('ski');titles.ski='SKI Saya'}catch(_){}
window.openSki=async function(){
 ensure();if(!pin()){if(!state.auth){state.afterAuth=()=>window.openSki();window.openLogin?.()}else toastS('SKI pribadi hanya melalui akses operasional PIN.','warn');return}
 await window.goView('ski');await load();
};
async function load(){
 const root=document.getElementById('view-ski');if(!root)return;root.innerHTML='<div class="ski-loading">Memeriksa akses privat SKI…</div>';
 try{
  gate=await call('status');
  if(!gate.unlocked){loaded=null;renderGate();return}
  loaded=await call('overview');render();
 }catch(e){root.innerHTML=safeErr(e.message)}
}
function base(head,sub){return '<div class="ski-head"><div><span class="ski-eyebrow">RUANG KERJA PRIBADI · TEAM LEADER</span><h2>'+head+'</h2><p>'+sub+'</p></div><span class="ski-seal">🔒 Privat</span></div>'}
function renderGate(){
 const root=document.getElementById('view-ski');if(!root)return;
 const setup=!gate?.configured;
 root.innerHTML=base('SKI Saya','Satu ruang untuk memantau target, pelaporan, bukti, dan pekerjaan pribadi.')+
 '<div class="ski-gate"><div class="ski-gate-mark">✦</div><h3>'+(setup?'Buat kunci pribadi SKI':'Buka ruang kerja pribadi')+'</h3><p>'+(setup?'Kunci ini berbeda dari PIN operasional dan hanya Anda yang mengetahuinya. Simpan baik-baik; tidak tersedia pemulihan otomatis.':'Masukkan kunci SKI Anda. PIN operasional saja tidak memberikan akses ke data SKI pribadi.')+'</p><form id="ski-gate-form"><label for="ski-pass">Kunci pribadi (minimal 12 karakter)</label><input class="ski-input" id="ski-pass" type="password" autocomplete="'+(setup?'new-password':'current-password')+'" minlength="12" maxlength="128" required placeholder="Masukkan kunci pribadi">'+(setup?'<label for="ski-confirm">Konfirmasi kunci pribadi</label><input class="ski-input" id="ski-confirm" type="password" autocomplete="new-password" minlength="12" required placeholder="Ulangi kunci pribadi">':'')+'<button class="ski-primary" type="submit">'+(setup?'Buat dan buka SKI Saya':'Buka SKI Saya')+'</button></form><p class="ski-small">Kunci disimpan sebagai hash di server, bukan di penyimpanan browser. Setelah keluar, ruang kerja harus dibuka kembali.</p></div>';
 document.getElementById('ski-gate-form').onsubmit=async ev=>{ev.preventDefault();const pass=document.getElementById('ski-pass').value;if(setup&&pass!==document.getElementById('ski-confirm').value)return toastS('Konfirmasi kunci tidak cocok.','warn');const btn=ev.target.querySelector('button');btn.disabled=true;try{await call(setup?'setup':'unlock',{passphrase:pass});gate={configured:true,unlocked:true};toastS('Ruang SKI terbuka.','success');await load()}catch(e){toastS(e.message,'warn')}finally{btn.disabled=false}};
}
function render(){
 const root=document.getElementById('view-ski');if(!root||!loaded)return;
 const nav=[['overview','Ikhtisar'],['reports','Pelaporan'],['evidence','Bukti SKI'],['monitor','Prestasi & Sinkronisasi']];
 root.innerHTML=base('SKI Saya','Juli–Desember 2026 · kelola laporan dan bukti tanpa menggantikan sistem pusat.')+
 '<div class="ski-actions"><button type="button" class="ski-subtle" onclick="skiReload()">↻ Perbarui</button><button type="button" class="ski-subtle" onclick="skiExport()">↓ Unduh rekap</button><button type="button" class="ski-subtle" onclick="skiLock()">Kunci SKI</button></div>'+
 '<div class="ski-nav-tabs">'+nav.map(x=>'<button class="'+(tab===x[0]?'active':'')+'" type="button" onclick="skiTab(\''+x[0]+'\')">'+x[1]+'</button>').join('')+'</div>'+
 '<div class="ski-panel">'+(tab==='overview'?overview():tab==='reports'?reports():tab==='evidence'?evidence():monitor())+'</div>';
 root.querySelectorAll('button').forEach(b=>{if(!b.disabled)b.title=b.title||''});
 window.lucide?.createIcons?.();
}
function fmt(n){return Number.isFinite(Number(n))?Number(n).toLocaleString('id-ID'):'—'}
function mini(label,value,note){return '<div class="ski-mini"><div class="ski-mini-title">'+E(label)+'</div><strong>'+E(value)+'</strong><p>'+E(note)+'</p></div>'}
function overview(){
 const m=loaded.metrics||{},ev=loaded.evidence||[],tot=PERIODS[period]||[],all=ev.filter(x=>x.semester===period);
 return '<div class="ski-dark"><span class="ski-eyebrow">SATU RUANG, TIDAK PERLU REKAP BERULANG</span><h3>Kelola pekerjaan. Pastikan buktinya.</h3><p>Angka di bawah adalah ringkasan data sumber—bukan nilai SKI. Capaian akhir menunggu bukti dan verifikasi Anda.</p></div>'+
 '<div class="ski-stats">'+mini('Indikator SKI',tot.length,'Total bobot 100%')+mini('Awardee aktif',fmt(m.awardeeActive),'Sasaran tiap indikator harus diperiksa')+mini('Bukti terverifikasi',all.filter(x=>x.is_verified).length,'Verifikasi oleh Anda')+mini('Nilai SKI','—','Belum ada formula penilaian sah')+'</div>'+
 '<div class="ski-headrow"><div><h3>Indikator & kewajiban</h3><p>Buka Bukti SKI untuk menambahkan dokumen pendukung.</p></div><select class="ski-input" style="max-width:220px" onchange="skiPeriod(this.value)"><option value="2026-2" '+(period==='2026-2'?'selected':'')+'>Juli–Desember 2026</option><option value="2027-1" '+(period==='2027-1'?'selected':'')+'>Februari–Juni 2027</option></select></div>'+
 '<div class="ski-indicators">'+tot.map(x=>{const n=all.filter(a=>a.indicator_code===x[0]);return '<article class="ski-indicator"><div class="ski-indicator-top"><strong>'+E(x[1])+'</strong><span class="ski-weight">'+x[2]+'%</span></div><p>'+E(x[3])+'</p><div class="ski-indicator-bottom"><span>'+n.filter(a=>a.is_verified).length+' bukti diverifikasi · '+n.length+' tersimpan</span><button type="button" onclick="skiEvidenceFor(\''+x[0]+'\')">Kelola bukti →</button></div></article>'}).join('')+'</div>'+
 '<div class="ski-footnote">Bobot dan target mengikuti dokumen SKI Team Leader. Data tersedia tidak sama dengan target terpenuhi; sejumlah indikator berisi subtarget yang belum memiliki rubrik penilaian resmi.</div>';
}
function reportRecord(kind){return (loaded.reports||[]).find(x=>x.report_kind===kind&&String(x.month_start).slice(0,7)===month)||null}
function reports(){
 return '<div class="ski-headrow"><div><h3>Pusat Pelaporan</h3><p>ESPRESI, laporan fasilitator, dan pengingat Awardee tetap terpisah.</p></div><label class="ski-period">Bulan laporan<input class="ski-input" type="month" min="2026-07" max="2027-06" value="'+E(month)+'" onchange="skiMonth(this.value)"></label></div>'+
 '<div class="ski-report-grid">'+reportKinds.map(([key,title,desc,url,cta])=>{const row=reportRecord(key);return '<article class="ski-report"><div class="ski-report-top"><h4>'+E(title)+'</h4><span class="ski-pill">'+E(row?.status||'belum dicatat')+'</span></div><p>'+E(desc)+'</p><div class="ski-report-links">'+safeLink(url,cta)+(key==='awardee_reminder'?'<button class="ski-link ski-internal" onclick="skiRemind()">Siapkan email pengingat →</button>':'')+'</div><form class="ski-report-form" data-kind="'+E(key)+'"><label>Status pekerjaan<select class="ski-input" name="status">'+[['belum','Belum dikerjakan'],['proses','Sedang disusun'],['siap','Siap dikirim'],['terkirim','Sudah dikirim'],['terverifikasi','Terverifikasi']].map(v=>'<option value="'+v[0]+'" '+((row?.status||'belum')===v[0]?'selected':'')+'>'+v[1]+'</option>').join('')+'</select></label><label>Tautan bukti (wajib jika dikirim / terverifikasi)<input class="ski-input" name="proofUrl" placeholder="https://..." value="'+E(row?.proof_url||'')+'"></label><label>Catatan pribadi<textarea class="ski-input ski-textarea" name="notes" placeholder="Perkembangan, kendala, tanggal, atau tindak lanjut">'+E(row?.notes||'')+'</textarea></label><button class="ski-primary" type="submit">Simpan catatan</button></form></article>'}).join('')+'</div>'+
 '<div class="ski-footnote">Tenggat dokumen SKI 2026: laporan perkembangan diri Awardee tanggal 10; ESPRESI tanggal 25. Periode 2027: ESPRESI tanggal 24. Jangan menandai laporan sebagai terkirim tanpa bukti.</div>';
}
function evidence(){
 const list=(loaded.evidence||[]).filter(x=>x.semester===period),inds=PERIODS[period]||[];
 return '<div class="ski-headrow"><div><h3>Pusat Bukti SKI</h3><p>Arsip privat yang bisa Anda verifikasi; tidak menggantikan unggah data ke portal pusat.</p></div><select class="ski-input" style="max-width:210px" onchange="skiPeriod(this.value)"><option value="2026-2" '+(period==='2026-2'?'selected':'')+'>Semester 2026</option><option value="2027-1" '+(period==='2027-1'?'selected':'')+'>Semester 2027</option></select></div>'+
 '<div class="ski-report-grid"><form id="ski-evidence-form" class="ski-report"><h4>Tambahkan bukti</h4><label>Indikator<select id="ski-code" class="ski-input" name="code">'+inds.map(x=>'<option value="'+x[0]+'">'+E(x[1])+'</option>').join('')+'</select></label><label>Judul bukti<input class="ski-input" name="title" maxlength="160" required placeholder="Contoh: Rekap coaching Oktober"></label><label>Tautan dokumen / bukti<input class="ski-input" name="evidenceUrl" placeholder="https://..."></label><label>Catatan<textarea class="ski-input ski-textarea" name="notes" placeholder="Konteks dan tindak lanjut"></textarea></label><label class="ski-checkbox"><input type="checkbox" name="verified"> Sudah diperiksa dan saya verifikasi</label><button class="ski-primary" type="submit">Simpan bukti SKI</button></form><div class="ski-report"><h4>Bukti tersimpan</h4>'+(list.length?list.map(x=>'<div class="ski-proof"><strong>'+E(x.title)+'</strong><span class="ski-pill">'+(x.is_verified?'Terverifikasi':'Belum diverifikasi')+'</span><p>'+E(inds.find(y=>y[0]===x.indicator_code)?.[1]||x.indicator_code)+'</p>'+(x.evidence_url?safeLink(x.evidence_url,'Lihat bukti'):'')+(x.notes?'<p>'+E(x.notes)+'</p>':'')+'<button class="ski-link ski-danger" type="button" onclick="skiDelete(\''+E(x.id)+'\')">Hapus bukti</button></div>').join(''):'<div class="ski-empty">Belum ada bukti SKI pribadi. Anda bisa mulai menambahkan dokumen sekarang.</div>')+'</div></div>';
}
function monitor(){
 const m=loaded.metrics||{},w=loaded.weekly||null;
 return '<div class="ski-headrow"><div><h3>Prestasi & pemantauan mingguan</h3><p>Pemeriksaan dijalankan oleh sistem Vercel, bukan tugas ChatGPT.</p></div>'+safeLink(LOOKER,'Buka Looker Studio')+'</div>'+
 '<div class="ski-stats">'+mini('Catatan prestasi lokal',fmt(m.achievements),'Dari database Dashboard ETOS')+mini('Awardee prestasi nasional',fmt(m.achievementNationalAwardees),'Label nasional 2026; verifikasi bukti')+mini('Catatan dengan tautan bukti',fmt(m.achievementEvidence),'Bukan jumlah prestasi terverifikasi')+mini('Liputan IPK',fmt(m.academicCovered)+' / '+fmt(m.awardeeActive),'Belum tentu nilai IPK semester terbaru')+'</div>'+
 '<div class="ski-monitor"><h4>Status sumber Looker Studio</h4><p>'+(!w?'Belum ada hasil pemeriksaan mesin yang tercatat.':E(w.summary))+'</p><span class="ski-pill">Status: '+E(w?.access_state||'belum diperiksa')+'</span><span class="ski-pill">Terakhir: '+E(w?.checked_at?new Date(w.checked_at).toLocaleString('id-ID',{timeZone:'Asia/Makassar'}):'—')+'</span><div class="ski-footnote">Pengecekan tautan bukan sinkronisasi data prestasi. Selama tidak ada akses data terstruktur yang sah, sistem tidak akan mengimpor atau mengarang prestasi dari Looker Studio.</div></div>'+
 '<div class="ski-report-grid"><div class="ski-report"><h4>Formulir prestasi Awardee</h4><p>Untuk Awardee mengirim pembaruan prestasi melalui kanal resmi.</p>'+safeLink(FORM,'Buka formulir prestasi')+'</div><div class="ski-report"><h4>Pelaporan bulanan</h4><p>Portal resmi untuk laporan fasilitator dan Awardee.</p>'+safeLink(REPORT,'Buka portal ETOS')+'</div></div>';
}
function gather(){const page=document.getElementById('view-ski');if(!page)return;
 page.querySelectorAll('form.ski-report-form').forEach(f=>f.onsubmit=async ev=>{ev.preventDefault();if(busy)return;const fd=new FormData(f);busy=true;try{await call('save_report',{kind:f.dataset.kind,month,status:fd.get('status'),proofUrl:fd.get('proofUrl'),notes:fd.get('notes')});toastS('Catatan pelaporan tersimpan.','success');loaded=await call('overview');render()}catch(e){toastS(e.message,'warn')}finally{busy=false}});
 const e=document.getElementById('ski-evidence-form');
 if(e)e.onsubmit=async ev=>{ev.preventDefault();if(busy)return;const fd=new FormData(e);busy=true;try{await call('save_evidence',{semester:period,code:fd.get('code'),title:fd.get('title'),evidenceUrl:fd.get('evidenceUrl'),notes:fd.get('notes'),verified:fd.get('verified')==='on'});toastS('Bukti SKI tersimpan.','success');loaded=await call('overview');render()}catch(err){toastS(err.message,'warn')}finally{busy=false}};
}
const originalRender=render;
render=function(){originalRender();gather()};
window.skiTab=function(t){if(!['overview','reports','evidence','monitor'].includes(t))return;tab=t;render()};
window.skiPeriod=function(v){if(!PERIODS[v])return;period=v;render()};
window.skiMonth=function(v){if(!/^20(26|27)-(0[1-9]|1[0-2])$/.test(v))return;month=v;render()};
window.skiReload=async function(){try{loaded=await call('overview');render();toastS('SKI diperbarui.','success')}catch(e){toastS(e.message,'warn')}};
window.skiLock=async function(){try{await call('lock');gate={configured:true,unlocked:false};loaded=null;renderGate()}catch(e){toastS(e.message,'warn')}};
window.skiEvidenceFor=function(code){tab='evidence';render();const x=document.getElementById('ski-code');if(x)x.value=code};
window.skiDelete=async function(id){if(!confirm('Hapus bukti pribadi ini?'))return;try{await call('delete_evidence',{id});loaded=await call('overview');render();toastS('Bukti dihapus.','success')}catch(e){toastS(e.message,'warn')}};
window.skiRemind=function(){
 const body='Halo {{nama}},\n\nPengingat dari ETOS ID Palu untuk menyelesaikan Laporan Perkembangan Diri bulanan melalui Portal ETOS ID:\n'+REPORT+'\n\nMohon lakukan pengisian sesuai tenggat yang berlaku. Jika sudah menyelesaikan laporan, abaikan pengingat ini.\n\nTerima kasih.';
 if(typeof window.openEmailCenter!=='function')return toastS('Email Center belum tersedia.','warn');
 window.openEmailCenter({name:'Pengingat Laporan Bulanan Awardee '+month,subject:'Pengingat Laporan Bulanan ETOS ID Palu',bodyText:body,audienceType:'active_all',context:{agenda:'Laporan Bulanan Awardee'}});
};
window.skiExport=function(){
 if(!loaded)return;const lines=['REKAP KERJA SKI PRIBADI','Periode: '+period,'Diekspor: '+new Date().toLocaleString('id-ID'),'Data sumber tidak otomatis menjadi nilai SKI.','','INDIKATOR'];
 for(const x of PERIODS[period])lines.push(x[1]+' ('+x[2]+'%): '+x[3]);
 lines.push('','LAPORAN');for(const r of loaded.reports||[])lines.push(r.month_start+' | '+r.report_kind+' | '+r.status+' | '+(r.proof_url||'-')+' | '+(r.notes||''));
 lines.push('','BUKTI');for(const x of (loaded.evidence||[]).filter(x=>x.semester===period))lines.push(x.indicator_code+' | '+x.title+' | '+(x.is_verified?'Terverifikasi':'Belum')+' | '+(x.evidence_url||''));
 const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='SKI-Saya-'+period+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)
};
ensure();
})();