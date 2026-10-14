/* Client-side compressed, share-ready 1200x630 JPEG article cover images. */
(()=>{'use strict';
const G=window.GG,$=G.$,s=G.s;
function preview(url){const b=$('cover-preview-box');b.style.backgroundImage=url?'url('+JSON.stringify(url)+')':'';b.innerHTML=url?'':'<span>✦</span><small>FOTO SAMPUL TULISAN</small>'}
async function drawImage(file){
 if(!file)return null;
 const ok=/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)||/\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name);
 if(!ok)throw Error('Gunakan foto JPG, PNG, WebP atau HEIC.');
 if(file.size>30*1024*1024||file.size<1)throw Error('Foto harus berukuran 1 byte sampai 30 MB.');
 let bitmap=null;
 try{if(typeof createImageBitmap==='function')bitmap=await createImageBitmap(file)}catch(e){}
 if(bitmap)return bitmap;
 const url=URL.createObjectURL(file);
 try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Foto tidak terbaca oleh browser. Jika HEIC, gunakan screenshot JPG/PNG.'));img.src=url})}
 finally{URL.revokeObjectURL(url)}
}
function paragraph(ctx,text,width,maxLines){
 const words=String(text).trim().split(/\s+/),lines=[];let current='';
 for(const word of words){const next=current?current+' '+word:word;if(ctx.measureText(next).width>width&&current){lines.push(current);current=word}else current=next}
 if(current)lines.push(current);return lines.slice(0,maxLines);
}
function canvasToJPEG(cv,quality){return new Promise((resolve,reject)=>cv.toBlob(blob=>blob?resolve(blob):reject(Error('Browser tidak dapat mengompresi gambar.')),'image/jpeg',quality))}
async function prepare(file,title,category){
 const cv=document.createElement('canvas');cv.width=1200;cv.height=630;
 const c=cv.getContext('2d');if(!c)throw Error('Browser tidak mendukung Canvas untuk kompresi gambar.');
 if(file){
  const im=await drawImage(file);
  try{const scale=Math.max(1200/im.width,630/im.height),w=im.width*scale,h=im.height*scale;c.drawImage(im,(1200-w)/2,(630-h)/2,w,h)}
  finally{im.close?.()}
 }else{
  c.fillStyle='#15314c';c.fillRect(0,0,1200,630);
  c.strokeStyle='#ffffff20';c.lineWidth=2;c.beginPath();c.arc(1090,70,250,0,Math.PI*2);c.stroke();
  c.fillStyle='#e1bd90';c.font='bold 22px system-ui';c.fillText('RUANG GAGASAN   ·   ETOS ID PALU',72,87);
  c.fillStyle='#fff';c.font='68px Georgia,serif';
  paragraph(c,title,1040,4).forEach((line,i)=>c.fillText(line,72,230+i*84));
  c.fillStyle='#e1bd90';c.font='bold 19px system-ui';c.fillText(String(category).toUpperCase(),72,570);
 }
 let blob;
 for(const q of [.85,.77,.67,.57,.48,.4]){blob=await canvasToJPEG(cv,q);if(blob.size<=400*1024)break}
 if(blob.type!=='image/jpeg'||blob.size>512*1024)throw Error('Foto belum dapat diperkecil. Coba foto lain atau screenshot lebih sederhana.');
 return blob;
}
async function upload(file,title,category){
 if(!s.user?.id)throw Error('Silakan masuk ke akun Awardee.');
 const blob=await prepare(file,title,category),id=window.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
 const path=s.user.id+'/'+id+'.jpg';
 const {error}=await G.sb.storage.from('gagasan-covers').upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});
 if(error)throw Error('Storage menolak foto: '+error.message);
 return path;
}
async function cleanup(path){if(!path)return;try{await G.sb.storage.from('gagasan-covers').remove([path])}catch(e){}}
let objectUrl=null;
function selected(){
 const f=$('article-cover').files?.[0];return f||null;
}
$('article-cover').addEventListener('change',()=>{
 const file=selected();if(!file)return;
 if(file.size>30*1024*1024){$('article-cover').value='';G.notice('Foto maksimal 30 MB.',true);return}
 if(objectUrl)URL.revokeObjectURL(objectUrl);
 objectUrl=URL.createObjectURL(file);preview(objectUrl);G.notice('Foto dipilih. Saat disimpan, foto dikompresi otomatis.');
});
$('remove-cover').addEventListener('click',()=>{
 $('article-cover').value='';if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;
 const existing=s.articles.find(x=>x.id===s.editing);preview(existing?G.cover(existing):null);
 G.notice('Pilihan foto baru dibatalkan. Sampul lama tetap ada.');
});
window.GGCovers={prepare,upload,cleanup,preview,selected};
})();