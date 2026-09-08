const secure=require('../secure-cookie');
const mentoringJournal=require('../mentoring-journal-handler');
module.exports=async function handler(req,res){
  const fn=String(req.body?.function||'');
  if(fn==='getMentoringJournal'||fn==='saveMentoringJournal')return mentoringJournal(req,res);
  return secure(req,res);
};
