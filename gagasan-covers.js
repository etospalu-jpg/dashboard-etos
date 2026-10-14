/* Ruang Gagasan v2: what-you-see-is-what-gets-uploaded JPEG cover pipeline. */
(()=>{'use strict';
const G=window.GG,$=G.$,s=G.s;
let cache=null,previewUrl=null,sequence=0;
const input=$('article-cover'),previewImage=$('cover-preview-image'),placeholder=$('cover-placeholder'),info=$('cover-output-info');
const formatBytes=n=>n<1024*1024?Math.round(n/1024)+' KB':(n/1024/1024).toFixed(1)+' MB';
function picture(url){
 previewImage.hidden=!url;
 placeholder.hidden=!!url;
 if(url)previewImage.src=url;
 else previewImage.removeAttribute('src');
}
function preview(url){
 sequence++;
 cache=null;
 if(previewUrl)URL.revokeObjectURL(previewUrl);
 previewUrl=null;
 picture(url||null);
 info.textContent=url?'Sampul tersimpan. Ganti foto bila diperlukan.':'JPG / PNG / WebP · Maksimal 30 MB sebelum dikompresi';
}
async function decode(file){
 if(!file)throw Error('Pilih foto terlebih dahulu.');
 const accepted=/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)||/\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name||'');
 if(!accepted)throw Error('Gunakan foto JPG, PNG atau WebP. HEIC hanya jika browser mendukungnya.');
 if(!file.size||file.size>30*1024*1024)throw Error('Ukuran foto harus kurang dari 30 MB.');
 try{if(typeof createImageBitmap==='function')return await createImageBitmap(file)}catch(_){}
 const object=URL.createObjectURL(file);
 try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Foto gagal dibaca oleh browser. Coba screenshot JPG/PNG.'));img.src=object})}
 finally{URL.revokeObjectURL(object)}
}
const jpeg=(canvas,quality)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Kompresi foto tidak didukung browser ini.')),'image/jpeg',quality));
function lines(ctx,text,maxWidth,limit=3){
 const words=String(text||'').split(/\s+/),array=[];let line='';
 for(const w of words){const next=line?line+' '+w:w;if(ctx.measureText(next).width>maxWidth&&line){array.push(line);line=w}else line=next}
 if(line)array.push(line);return array.slice(0,limit);
}
async function prepare(file,title,category){
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;
 const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Browser tidak mendukung pemrosesan gambar.');
 ctx.fillStyle='#112945';ctx.fillRect(0,0,1200,630);
 if(file){
  const img=await decode(file);
  try{
   if(!img.width||!img.height)throw Error('Dimensi foto tidak valid.');
   // Blurred edge-to-edge ambient background; foreground always fully visible.
   const fill=Math.max(1200/img.width,630/img.height),bgW=img.width*fill,bgH=img.height*fill;
   ctx.save();ctx.filter='blur(28px) brightness(.65)';ctx.drawImage(img,(1200-bgW)/2-24,(630-bgH)/2-24,bgW+48,bgH+48);ctx.restore();
   const fit=Math.min(1200/img.width,630/img.height),width=Math.round(img.width*fit),height=Math.round(img.height*fit);
   const x=Math.round((1200-width)/2),y=Math.round((630-height)/2);
   ctx.drawImage(img,x,y,width,height);
  }finally{img.close?.()}
 }else{
  const grd=ctx.createLinearGradient(0,0,1200,630);grd.addColorStop(0,'#12365d');grd.addColorStop(1,'#09213b');ctx.fillStyle=grd;ctx.fillRect(0,0,1200,630);
  ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(1060,65,290,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#b9d5f2';ctx.font='700 22px system-ui';ctx.fillText('ETOS ID PALU   /   RUANG GAGASAN',76,92);
  ctx.fillStyle='#fff';ctx.font='700 65px system-ui';lines(ctx,title,1040,4).forEach((line,i)=>ctx.fillText(line,76,235+76*i));
  ctx.fillStyle='#a9caec';ctx.font='700 19px system-ui';ctx.fillText(String(category||'OPINI').toUpperCase(),76,578);
 }
 let result;
 for(const quality of [.84,.75,.65,.55,.44,.34]){result=await jpeg(canvas,quality);if(result.size<=400*1024)break}
 if(!result||result.type!=='image/jpeg'||result.size>512*1024)throw Error('Foto masih terlalu besar setelah kompresi. Pilih foto lain.');
 return result;
}
function selected(){return input.files?.[0]||null}
async function showSelected(file){
 const serial=++sequence;
 info.textContent='Mengolah pratinjau foto…';
 try{
  const blob=await prepare(file,$('article-title').value.trim(),$('article-category').value);
  if(serial!==sequence||selected()!==file)return;
  if(previewUrl)URL.revokeObjectURL(previewUrl);
  previewUrl=URL.createObjectURL(blob);
  cache={file,blob};
  picture(previewUrl);
  info.textContent='Foto asli '+formatBytes(file.size)+' → hasil akhir '+formatBytes(blob.size)+' · 1200 × 630 · JPEG. Gambar ini persis yang akan diunggah.';
 }catch(err){if(serial!==sequence)return;cache=null;input.value='';picture(null);info.textContent=err.message;G.notice(err.message,true)}
}
function uuid(){
 if(window.crypto?.randomUUID)return window.crypto.randomUUID();
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:((r&3)|8)).toString(16)});
}
async function upload(file,title,category){
 if(!s.user?.id)throw Error('Sesi penulis sudah berakhir. Silakan masuk kembali.');
 const blob=file&&cache?.file===file?cache.blob:await prepare(file,title,category);
 const path=s.user.id+'/'+uuid()+'.jpg';
 const {error}=await G.sb.storage.from('gagasan-covers').upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});
 if(error)throw Error('Penyimpanan foto gagal: '+error.message);
 return path;
}
async function cleanup(path){if(!path)return;try{await G.sb.storage.from('gagasan-covers').remove([path])}catch(_){}}
input.addEventListener('change',()=>{const file=selected();if(file)showSelected(file)});
$('cover-preview-box').addEventListener('click',()=>input.click());
$('cover-preview-box').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}});
$('remove-cover').addEventListener('click',()=>{input.value='';const old=s.articles.find(a=>a.id===s.editing);preview(old?G.cover(old):null);G.notice('Pilihan foto dibatalkan. Sampul yang sebelumnya tersimpan tetap aman.')});
window.GGCovers={prepare,upload,cleanup,preview,selected};
})();