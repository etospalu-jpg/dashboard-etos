const session=require('../server-session');

const KEY='ETOS2026PHOTO_SYNC_29SEP_A8F1C7';
const FILES=[
  {code:'AWD-0017',name:'Awaina',id:'1JYLqM15Ulk8d6uEXij9L39PCQ3gyVJ-c'},
  {code:'AWD-0018',name:'Jelita',id:'158Q-mCmgDrDOI69tOxRB4lRME5RG8j18'},
  {code:'AWD-0019',name:'Nur Afni',id:'1dEggTDm04LTiSdOr1WhcaUwjQcbTU-x0'},
  {code:'AWD-0020',name:'Putri',id:'1Cj4ga4rYqcH9qs475Lgg4oFybfQDXbui'},
  {code:'AWD-0021',name:'Risky Maharani Putri',id:'1n5SQ6m5cT9xrl-vOVSyxedUZ251Bhj8A'},
  {code:'AWD-0022',name:'Wiwid Awrel',id:'1JNQGL-jRL3ErSvY3AgfXuE4zSoJpPP-0'},
  {code:'AWD-0023',name:'Zahratun Sita Ramadhani',id:'1maDeRaUFSzsodcmWZvR-wdKGLFhIya_u'}
];
function out(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
async function driveBytes(id){
  const urls=[
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}&confirm=t`
  ];
  let last='';
  for(const url of urls){
    const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0'}});
    const type=String(r.headers.get('content-type')||'').toLowerCase();
    if(r.ok&&type.startsWith('image/'))return{bytes:Buffer.from(await r.arrayBuffer()),type};
    last=`${r.status} ${type}`;
  }
  throw new Error('Drive download gagal: '+last);
}
async function upload(code,bytes,type){
  const secret=session.secret();
  if(!secret)throw new Error('Supabase server key tidak tersedia.');
  const path=`2026/${code}.jpg`;
  const url=`${session.PROJECT_URL}/storage/v1/object/awardee-photos/${path}`;
  const r=await fetch(url,{method:'POST',headers:{
    apikey:secret,
    Authorization:`Bearer ${secret}`,
    'Content-Type':type||'image/jpeg',
    'x-upsert':'true',
    'cache-control':'31536000'
  },body:bytes});
  const text=await r.text();
  if(!r.ok)throw new Error(`Storage ${r.status}: ${text.slice(0,240)}`);
  return{path,url:`${session.PROJECT_URL}/storage/v1/object/public/awardee-photos/${path}`,size:bytes.length};
}
module.exports=async function handler(req,res){
  if(req.method!=='GET')return out(res,405,{success:false,error:'Method not allowed'});
  if(String(req.query?.key||'')!==KEY)return out(res,404,{success:false,error:'Not found'});
  const results=[];
  for(const f of FILES){
    try{
      const src=await driveBytes(f.id);
      const saved=await upload(f.code,src.bytes,src.type);
      results.push({...f,ok:true,...saved});
    }catch(e){results.push({...f,ok:false,error:e.message||String(e)})}
  }
  const ok=results.filter(x=>x.ok).length;
  return out(res,ok===FILES.length?200:207,{success:ok===FILES.length,ok,total:FILES.length,results});
};