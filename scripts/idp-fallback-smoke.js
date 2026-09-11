'use strict';
const fallback=require('../idp-drive-fallback');
(async()=>{
  const h=await fallback.health(true);
  if(!h||h.mode!=='drive-verified-fallback'||Number(h.sheetCount)<16)throw new Error(`IDP fallback smoke gagal: ${JSON.stringify(h)}`);
  const detail=await fallback.detail('Afifah Khairunnisa','2023',false);
  if(!Array.isArray(detail?.values)||detail.values.length<40||Number(detail?.summary?.filledRows)<40)throw new Error('IDP fallback detail tidak terbaca utuh.');
  console.log(`✓ IDP verified fallback sehat: ${h.sheetCount} tab, Afifah ${detail.summary.filledRows} baris terisi`);
})().catch(e=>{console.error('✗',e?.stack||e);process.exit(1)});
