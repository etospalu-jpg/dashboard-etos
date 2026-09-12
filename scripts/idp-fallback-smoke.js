'use strict';
const source=require('../idp-drive-fallback');
(async()=>{
  const h=await source.health(true);
  if(!h||h.mode!=='drive-live-readonly'||h.source!=='google-drive-live'||h.stale!==false||Number(h.sheetCount)<16)throw new Error(`IDP live Drive smoke gagal: ${JSON.stringify(h)}`);
  const detail=await source.detail('Afifah Khairunnisa','2023',false);
  if(detail?.sourceMode!=='drive-live-readonly'||detail?.stale!==false)throw new Error('IDP detail belum ditandai live Google Drive.');
  if(!Array.isArray(detail?.values)||detail.values.length<40||Number(detail?.summary?.filledRows)<40)throw new Error('IDP live Drive detail tidak terbaca utuh.');
  console.log(`✓ IDP live Google Drive sehat: ${h.sheetCount} tab, Afifah ${detail.summary.filledRows} baris terisi`);
})().catch(e=>{console.error('✗',e?.stack||e);process.exit(1)});
