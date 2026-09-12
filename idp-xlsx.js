const zlib=require('zlib');
function dec(s){return String(s||'').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')}
function attr(s,k){const m=String(s).match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"'));return m?dec(m[1]):''}
function col(ref){let n=0;for(const c of (String(ref).match(/^[A-Z]+/)||['A'])[0])n=n*26+c.charCodeAt(0)-64;return n}
function zipMap(buf){let e=-1;for(let i=buf.length-22;i>=Math.max(0,buf.length-66000);i--)if(buf.readUInt32LE(i)===0x06054b50){e=i;break}if(e<0)throw new Error('XLSX ZIP invalid.');let off=buf.readUInt32LE(e+16),count=buf.readUInt16LE(e+10),m=new Map();for(let n=0;n<count;n++){if(buf.readUInt32LE(off)!==0x02014b50)break;const method=buf.readUInt16LE(off+10),cs=buf.readUInt32LE(off+20),nl=buf.readUInt16LE(off+28),xl=buf.readUInt16LE(off+30),cl=buf.readUInt16LE(off+32),lo=buf.readUInt32LE(off+42),name=buf.slice(off+46,off+46+nl).toString();m.set(name,{method,cs,lo});off+=46+nl+xl+cl}return m}
function entry(buf,map,name){const x=map.get(name);if(!x)return null;const lo=x.lo,nl=buf.readUInt16LE(lo+26),el=buf.readUInt16LE(lo+28),start=lo+30+nl+el,d=buf.slice(start,start+x.cs);return x.method===8?zlib.inflateRawSync(d):d}
function parseBook(buf){
  const zm=zipMap(buf),wbe=entry(buf,zm,'xl/workbook.xml'),re=entry(buf,zm,'xl/_rels/workbook.xml.rels');
  if(!wbe||!re)throw new Error('Struktur workbook IDP tidak valid.');
  const wb=wbe.toString(),rels=re.toString(),rel={};
  for(const m of rels.matchAll(/<Relationship\b([^>]*)\/?\s*>/g))rel[attr(m[1],'Id')]=attr(m[1],'Target');
  let shared=[];const ss=entry(buf,zm,'xl/sharedStrings.xml');
  if(ss){for(const m of ss.toString().matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)){let t='';for(const q of m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))t+=dec(q[1]);shared.push(t)}}
  const sheets=[];
  for(const m of wb.matchAll(/<sheet\b([^>]*)\/?\s*>/g)){
    const title=attr(m[1],'name'),rid=attr(m[1],'r:id'),target=rel[rid];if(!target)continue;
    const raw=entry(buf,zm,'xl/'+target.replace(/^\//,'').replace(/^xl\//,''));if(!raw)continue;
    const xml=raw.toString(),vals=new Map();let maxR=0,maxC=0;
    for(const c of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
      const ref=attr(c[1],'r'),r=Number((ref.match(/\d+$/)||['0'])[0]),cc=col(ref),typ=attr(c[1],'t');
      if(!r||r>400||cc>40)continue;maxR=Math.max(maxR,r);maxC=Math.max(maxC,cc);
      let v='',vm=c[2].match(/<v[^>]*>([\s\S]*?)<\/v>/);
      if(typ==='s'&&vm)v=shared[Number(vm[1])]||'';
      else if(typ==='inlineStr'){for(const q of c[2].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))v+=dec(q[1])}
      else if(vm)v=dec(vm[1]);
      if(String(v).trim())vals.set(r+':'+cc,String(v));
    }
    const values=[];let filledRows=0,filledCells=0,lastRow=0,lastColumn=0;
    for(let r=1;r<=maxR;r++){const row=[];let used=false;for(let cc=1;cc<=maxC;cc++){const v=vals.get(r+':'+cc)||'';row.push(v);if(v){used=true;filledCells++;lastColumn=Math.max(lastColumn,cc)}}while(row.length&&!row[row.length-1])row.pop();values.push(row);if(used){filledRows++;lastRow=r}}
    while(values.length&&!values[values.length-1].length)values.pop();
    sheets.push({title,values,summary:{filledRows,filledCells,lastRow,lastColumn,truncated:maxR>=400||maxC>=40}});
  }
  return sheets;
}
module.exports={parseBook};
