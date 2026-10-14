/**
 * ETOS ID PALU · Sinkronisasi Absensi Asrama 2026
 * Pasang sebagai Apps Script TERIKAT pada Google Spreadsheet jurnal pembinaan asrama.
 * Spreadsheet tetap sumber data; script hanya MEMBACA sel, tidak mengubah nilai/formula.
 * Versi: 2026-10-14
 */
const ETOS_SHEET_ID = '1GlzHEfjY0QDZNs7lntoUEjoANqiRN5JYRVlG-Em0aVA';
const ETOS_ENDPOINT = 'https://weklmapqizeldfdalbgs.supabase.co/functions/v1/asrama-sheet-sync';
const ETOS_PROP = 'ETOS_ASRAMA_SYNC_KEY';
const ETOS_ATTENDANCE_TAB = '02 Kehadiran';
const ETOS_JOURNAL_TAB = '01 Silabus & Jurnal';
const ETOS_STATUSES = {hadir:'Hadir',izin:'Izin',sakit:'Sakit',alpa:'Alpa'};
const ETOS_MONTHS = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',okt:'10',des:'12'};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('ETOS · Asrama')
    .addItem('1 · Masukkan kunci sinkronisasi','etosSetKey')
    .addItem('2 · Pasang pemicu otomatis','etosInstallTriggers')
    .addItem('Sinkronisasi sekarang','etosSyncNow')
    .addToUi();
}
function etosSetKey() {
  const ui=SpreadsheetApp.getUi();
  const prompt=ui.prompt('Kunci Sinkronisasi ETOS','Tempel kunci dari Dashboard Superadmin. Kunci disimpan di Script Properties dan tidak ditulis ke sel spreadsheet.',ui.ButtonSet.OK_CANCEL);
  if(prompt.getSelectedButton()!==ui.Button.OK)return;
  const secret=String(prompt.getResponseText()||'').trim();
  if(!/^[a-f0-9]{64}$/.test(secret))throw Error('Kunci tidak valid. Salin ulang dari Dashboard Superadmin.');
  PropertiesService.getScriptProperties().setProperty(ETOS_PROP,secret);
  ui.alert('Kunci tersimpan di Script Properties.');
}
function etosInstallTriggers() {
  const doc=SpreadsheetApp.getActiveSpreadsheet();
  if(doc.getId()!==ETOS_SHEET_ID)throw Error('Script harus dipasang pada spreadsheet jurnal asrama yang benar.');
  const handlers=new Set(['etosOnEdit','etosScheduledSync']);
  ScriptApp.getProjectTriggers().filter(t=>handlers.has(t.getHandlerFunction())).forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('etosOnEdit').forSpreadsheet(doc).onEdit().create();
  ScriptApp.newTrigger('etosScheduledSync').timeBased().everyMinutes(5).create();
  SpreadsheetApp.getUi().alert('Pemicu terpasang: otomatis setelah mengubah absensi, ditambah pemeriksaan setiap 5 menit. Jalankan "Sinkronisasi sekarang" sekali untuk memulai.');
}
function etosOnEdit(e) {
  const range=e&&e.range;
  if(!range)return;
  const sh=range.getSheet();
  const inAttendance=sh.getName()===ETOS_ATTENDANCE_TAB && range.getLastRow()>=5 &&
    range.getColumn()<=11 && range.getLastColumn()>=1;
  const inJournal=sh.getName()===ETOS_JOURNAL_TAB;
  if(inAttendance||inJournal)etosSyncNow();
}
function etosScheduledSync(){etosSyncNow()}
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
  const file=SpreadsheetApp.getActiveSpreadsheet();
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
    if(!token)throw Error('Belum ada kunci. Pilih menu ETOS · Asrama → Masukkan kunci sinkronisasi.');
    const events=etosReadSnapshot();
    const result=UrlFetchApp.fetch(ETOS_ENDPOINT,{
      method:'post',contentType:'application/json',
      headers:{'x-etos-asrama-key':token},
      payload:JSON.stringify({sourceSpreadsheetId:ETOS_SHEET_ID,events}),
      muteHttpExceptions:true
    });
    const data=JSON.parse(result.getContentText());
    if(result.getResponseCode()!==200||!data.success)throw Error(data.error||'Sinkronisasi gagal (HTTP '+result.getResponseCode()+').');
    console.log('Sinkronisasi ETOS berhasil: sesi '+data.data.sessions+', catatan '+data.data.records+'.');
    return data.data;
  }finally{lock.releaseLock()}
}
