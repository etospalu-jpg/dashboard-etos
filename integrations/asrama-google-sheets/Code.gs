/**
 * ETOS ID PALU · Sinkronisasi Absensi Asrama 2026
 * Buat proyek Apps Script STANDALONE di AKUN GOOGLE PALU (script.google.com), tanpa menyunting spreadsheet pusat.
 * Spreadsheet tetap sumber data; script hanya MEMBACA sel, tidak mengubah nilai/formula.
 * Versi: 2026-10-14
 */
const ETOS_SHEET_ID = '1GlzHEfjY0QDZNs7lntoUEjoANqiRN5JYRVlG-Em0aVA';
const ETOS_ENDPOINT = 'https://weklmapqizeldfdalbgs.supabase.co/functions/v1/asrama-sheet-sync';
const ETOS_PROP = 'ETOS_ASRAMA_SYNC_KEY';
const ETOS_ATTENDANCE_TAB = '02 Kehadiran';
const ETOS_STATUSES = {hadir:'Hadir',izin:'Izin',sakit:'Sakit',alpa:'Alpa'};
const ETOS_MONTHS = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',okt:'10',des:'12'};

// Mode mandiri: proyek Apps Script adalah MILIK PENGELOLA PALU,
// bukan proyek/script milik pemegang Google Sheet pusat.
// Tidak memerlukan hak editor maupun perubahan pada spreadsheet sumber.
const ETOS_DIGEST_PROP='ETOS_ASRAMA_LAST_SUCCESS_DIGEST';
function etosInstallTriggers() {
  // Read-only preflight. This succeeds when the signed-in Google account
  // already has permission to view the central sheet.
  const sheet=SpreadsheetApp.openById(ETOS_SHEET_ID);
  if(!sheet.getSheetByName(ETOS_ATTENDANCE_TAB))throw Error('Sheet Kehadiran tidak tersedia dari akun Google ini.');
  const key=PropertiesService.getScriptProperties().getProperty(ETOS_PROP);
  if(!/^[a-f0-9]{64}$/.test(String(key||'')))throw Error('Isi Script Properties: ETOS_ASRAMA_SYNC_KEY dahulu.');
  for(const trigger of ScriptApp.getProjectTriggers()) {
    if(trigger.getHandlerFunction()==='etosScheduledSync')ScriptApp.deleteTrigger(trigger);
  }
  // Optional weekly backup. Main weekly synchronization uses the connected Google Drive workflow, with no spreadsheet-owner changes.
  ScriptApp.newTrigger('etosScheduledSync').timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  console.log('Cadangan sinkronisasi PALU setiap Senin pagi terpasang. Sumber Google Sheet tidak diubah.');
}
function etosScheduledSync(){return etosSyncNow();}
function etosForceSync() {
  PropertiesService.getScriptProperties().deleteProperty(ETOS_DIGEST_PROP);
  return etosSyncNow();
}
function etosDigest(text){
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8)
   .map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function etosParseDate(value){
  const x=String(value||'').trim();
  const match=x.match(/^(\d{1,2})[\s/-]+([A-Za-z]{3})[\s/-]+(\d{2,4})$/);
  if(!match)throw Error('Tanggal tidak dikenal: '+x);
  const month=ETOS_MONTHS[match[2].toLowerCase()];
  if(!month)throw Error('Bulan tidak dikenal: '+x);
  let year=Number(match[3]);if(year<100)year+=2000;
  const iso=year+'-'+month+'-'+match[1].padStart(2,'0');
  if(new Date(iso+'T12:00:00Z').toISOString().slice(0,10)!==iso)throw Error('Tanggal tidak valid: '+x);
  return iso;
}
function etosReadSnapshot(){
  const file=SpreadsheetApp.openById(ETOS_SHEET_ID);
  if(file.getId()!==ETOS_SHEET_ID)throw Error('Spreadsheet sumber berbeda dengan integrasi ETOS.');
  const tab=file.getSheetByName(ETOS_ATTENDANCE_TAB);
  if(!tab)throw Error('Sheet 02 Kehadiran tidak ditemukan.');
  const max=Math.min(Math.max(tab.getLastRow()-3,2),110);
  const grid=tab.getRange(4,1,max,11).getDisplayValues();
  const names=grid[0].slice(4,11).map(x=>String(x).trim());
  const expected=['Awaina','Jelita','Nur Afni','Putri','Risky Maharani','Wiwid Awrel','Zahratun Sita'];
  if(names.join('|')!==expected.join('|'))throw Error('Judul kolom peserta berubah. Sinkronisasi dihentikan agar tidak salah mencocokkan nama.');
  const seen=new Set(),events=[];
  for(const row of grid.slice(1)){
    const agendaId=String(row[0]||'').trim();
    if(!/^AGD-\d{3}$/.test(agendaId))continue;
    if(seen.has(agendaId))throw Error('ID agenda berulang: '+agendaId);
    seen.add(agendaId);
    const status={};
    for(let i=0;i<names.length;i++){
      const text=String(row[i+4]||'').trim().toLowerCase();
      if(!text)continue;
      if(!ETOS_STATUSES[text])throw Error('Status belum dikenali pada agenda '+agendaId+' untuk '+names[i]+'.');
      status[names[i]]=ETOS_STATUSES[text];
    }
    events.push({agendaId:agendaId,date:etosParseDate(row[1]),title:String(row[3]||'').trim(),statuses:status});
  }
  if(events.length<60||events.length>100)throw Error('Jumlah agenda tidak lengkap. Ditemukan: '+events.length+'.');
  return events;
}
function etosSyncNow(){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(7000))return;
  try{
    const token=PropertiesService.getScriptProperties().getProperty(ETOS_PROP);
    if(!/^[a-f0-9]{64}$/.test(String(token||'')))throw Error('Tambahkan ETOS_ASRAMA_SYNC_KEY lewat Pengaturan Proyek → Properti skrip.');
    const events=etosReadSnapshot();
    const props=PropertiesService.getScriptProperties();
    const base=JSON.stringify({sourceSpreadsheetId:ETOS_SHEET_ID,events});
    const digest=etosDigest(base);
    const unchanged=props.getProperty(ETOS_DIGEST_PROP)===digest;
    // A heartbeat verifies continued access and avoids rewriting all
    // database records each minute when the Sheet has not changed.
    const payload=unchanged?JSON.stringify({sourceSpreadsheetId:ETOS_SHEET_ID,heartbeat:true}):base;
    const result=UrlFetchApp.fetch(ETOS_ENDPOINT,{
      method:'post',contentType:'application/json',
      headers:{'x-etos-asrama-key':token},
      payload,
      muteHttpExceptions:true
    });
    let data;try{data=JSON.parse(result.getContentText())}catch(e){throw Error('Server mengembalikan respons tidak valid')}
    if(result.getResponseCode()!==200||!data.success)throw Error(data.error||'Sinkronisasi gagal (HTTP '+result.getResponseCode()+').');
    if(!unchanged)props.setProperty(ETOS_DIGEST_PROP,digest);
    console.log(unchanged?'ETOS Palu: terhubung, belum ada perubahan.':'ETOS Palu: '+data.data.sessions+' agenda, '+data.data.records+' catatan tersinkron.');
    return data.data;
  }finally{lock.releaseLock()}
}
