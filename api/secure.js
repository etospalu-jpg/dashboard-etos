const secure=require('../secure-cookie');
const mentoringJournal=require('../mentoring-journal-handler');
const ruleAnalysis=require('../rule-analysis-handler');
const attendanceEntry=require('../attendance-entry-handler');
const JOURNAL=new Set(['getFacilitatorJournalHub','saveFacilitatorJournalEntry','deleteFacilitatorJournalEntry','generateFacilitatorMonthlySummary','getMentoringJournal','saveMentoringJournal']);
const ATTENDANCE=new Set(['getAbsensiList','getAbsensiEntryOptions','saveAbsensiEntry','getAttendanceSettings','saveAttendancePeriod','deleteAttendancePeriod','saveAttendanceAgenda','deleteAttendanceAgenda']);
module.exports=async function handler(req,res){
 const fn=String(req.body?.function||'');
 if(JOURNAL.has(fn))return mentoringJournal(req,res);
 if(fn==='analyzeAwardeeWithRules')return ruleAnalysis(req,res);
 if(ATTENDANCE.has(fn))return attendanceEntry(req,res);
 return secure(req,res);
};
