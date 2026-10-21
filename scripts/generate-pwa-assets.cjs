'use strict';
const fs=require('node:fs'),path=require('node:path');
const sharp=require('sharp');
(async()=>{
 const src=path.resolve(__dirname,'..','pwa-icon.svg');
 const out=path.resolve(__dirname,'..','public');
 for(const size of [192,512]){
  const target=path.join(out,'pwa-icon-'+size+'.png');
  await sharp(src,{density:192}).resize(size,size,{fit:'contain'}).png({compressionLevel:9}).toFile(target);
  const data=fs.readFileSync(target);
  if(data.length<500||data.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('PNG PWA '+size+' gagal.');
  console.log('PWA icon',size,'OK',data.length);
 }
})().catch(e=>{console.error(e);process.exitCode=1});
