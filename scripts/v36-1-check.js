'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(ROOT,n),'utf8');
const errors=[];
const need=(text,tokens,label)=>tokens.forEach(t=>{if(!text.includes(t))errors.push(`${label}: marker hilang: ${t}`)});
const forbid=(text,tokens,label)=>tokens.forEach(t=>{if(text.includes(t))errors.push(`${label}: marker terlarang: ${t}`)});

const polish=read('app-polish.js');
need(polish,["PIN_VIEWS=new Set(['coaching','mentoring','profile','system','datacenter','settings'])","secureViews.delete('attendance')","view==='attendance'","PIN_VIEWS.has(view)&&!pinReady()","openAttendanceEntry","saveAttendancePeriodForm","etos:enhancements-ready"],'PIN/public attendance policy');

const adapter=read('supabase-adapter.js');
need(adapter,["name==='getAbsensiList'","publicCall('getPublicAttendance',params)"],'Attendance public-read policy');
forbid(adapter,["publicCall('saveAbsensiEntry'","publicCall('saveAttendancePeriod'","publicCall('saveAttendanceAgenda'"],'Attendance write isolation');

const dispatch=read('api/secure.js');
need(dispatch,['ATTENDANCE_PIN_REQUIRED',"'getAbsensiEntryOptions'","'saveAbsensiEntry'","'getAttendanceSettings'","'saveAttendancePeriod'","session.verify(req)",'PIN Superadmin diperlukan untuk mengubah data absensi.'],'Attendance backend PIN gate');

const systemApi=read('api/system.js');
need(systemApi,['Promise.all(TABLES.map','monitorState(c)','source:{type:\'supabase-postgres\''],'System Center parallel health');

const systemUi=read('app-system.js');
need(systemUi,['retry=1','await wait(280)',"'warn'",'Data belum berhasil dimuat. Klik Perbarui untuk mencoba lagi.'],'System Center retry UX');

const idp=read('idp-live-v32.js');
need(idp,["FILE_ID='1OzW2RfiXL5SmqLOJx-t4Grimy7usdnSqVvSQszZ8WvQ'","SOURCE_GID='1973014346'",'serviceAccountConfigured()','sheets-live-public-readonly','gviz/tq?tqx=out:csv'],'IDP Palu source');
forbid(idp,['AIzaSy','-----BEGIN PRIVATE KEY-----'],'IDP secret hygiene');

if(errors.length){console.error(errors.map(x=>'✗ '+x).join('\n'));process.exit(1)}
console.log('✓ ETOS v36.1 regression gate LULUS');
