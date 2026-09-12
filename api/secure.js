const secure=require('../secure-cookie');
const mentoringJournal=require('../mentoring-journal-handler');
const ruleAnalysis=require('../rule-analysis-handler');
const attendanceEntry=require('../attendance-entry-handler');
const session=require('../server-session');
const JOURNAL=new Set(['getFacilitatorJournalHub','saveFacilitatorJournalEntry','deleteFacilitatorJournalEntry','generateFacilitatorMonthlySummary','getMentoringJournal','saveMentoringJournal']);
const ATTENDANCE=new Set(['getAbsensiList','getAbsensiEntryOptions','saveAbsensiEntry','getAttendanceSettings','saveAttendancePeriod','deleteAttendancePeriod','saveAttendanceAgenda','deleteAttendanceAgenda']);
const ATTENDANCE_PIN_REQUIRED=new Set(['getAbsensiEntryOptions','saveAbsensiEntry','getAttendanceSettings','saveAttendancePeriod','deleteAttendancePeriod','saveAttendanceAgenda','deleteAttendanceAgenda']);
const COACHING_PIN_REQUIRED=new Set(['saveCoaching']);
function deny(res,message){res.status(401);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({success:false,error:message}))}
module.exports=async function handler(req,res){
 const fn=String(req.body?.function||'');
 if(ATTENDANCE_PIN_REQUIRED.has(fn)&&!session.verify(req))return deny(res,'PIN Superadmin diperlukan untuk mengubah data absensi.');
 if(COACHING_PIN_REQUIRED.has(fn)&&!session.verify(req))return deny(res,'PIN Superadmin diperlukan untuk mencatat coaching.');
 if(JOURNAL.has(fn))return mentoringJournal(req,res);
 if(fn==='analyzeAwardeeWithRules')return ruleAnalysis(req,res);
 if(ATTENDANCE.has(fn))return attendanceEntry(req,res);
 return secure(req,res);
};
