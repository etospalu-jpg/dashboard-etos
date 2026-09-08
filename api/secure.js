const secure=require('../secure-cookie');
const mentoringJournal=require('../mentoring-journal-handler');
const ruleAnalysis=require('../rule-analysis-handler');
const attendanceEntry=require('../attendance-entry-handler');
module.exports=async function handler(req,res){
  const fn=String(req.body?.function||'');
  if(fn==='getMentoringJournal'||fn==='saveMentoringJournal')return mentoringJournal(req,res);
  if(fn==='analyzeAwardeeWithRules')return ruleAnalysis(req,res);
  if(fn==='saveAbsensiEntry')return attendanceEntry(req,res);
  return secure(req,res);
};
