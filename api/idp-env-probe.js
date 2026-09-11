module.exports=async function handler(req,res){
 const names=Object.keys(process.env).filter(k=>/google|sheet|drive|service.*account/i.test(k)).sort();
 res.status(200).setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.end(JSON.stringify({names}));
};
