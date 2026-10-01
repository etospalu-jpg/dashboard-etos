const fs=require('fs');
const path=require('path');
const root=__dirname,out=path.join(root,'public');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const allowed=new Set(['.html','.js','.css','.svg','.png','.jpg','.jpeg','.webp','.ico','.xml','.txt','.webmanifest']);
const skip=new Set(['build-static.js','tailwind.input.css','tailwind.config.js']);
for(const name of fs.readdirSync(root)){
  const src=path.join(root,name);if(!fs.statSync(src).isFile()||skip.has(name)||!allowed.has(path.extname(name).toLowerCase()))continue;
  fs.copyFileSync(src,path.join(out,name));
}
if(!fs.existsSync(path.join(out,'index.html')))throw new Error('index.html missing from static output');
if(!fs.existsSync(path.join(out,'tailwind.generated.css')))throw new Error('tailwind.generated.css missing from static output');
console.log('Static dashboard packaged:',fs.readdirSync(out).length,'files');
