const VERSION='36.25';
const STATIC_CACHE='etos-pwa-static-'+VERSION;
const RUNTIME_CACHE='etos-pwa-runtime-'+VERSION;
const CORE=[
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/pwa-icon.svg',
  '/brand-etos.svg'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(STATIC_CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('etos-pwa-')&&![STATIC_CACHE,RUNTIME_CACHE].includes(k)).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||req.headers.has('range'))return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(req.mode==='navigate'){
    event.respondWith(
      fetch(req).then(res=>{
        if(res&&res.ok){const copy=res.clone();caches.open(RUNTIME_CACHE).then(c=>c.put(req,copy)).catch(()=>{})}
        return res;
      }).catch(async()=>await caches.match(req)||await caches.match('/offline.html'))
    );
    return;
  }
  const asset=/\.(?:js|css|svg|png|jpg|jpeg|webp|ico|woff2?)$/i.test(url.pathname)||url.pathname==='/manifest.webmanifest'||url.pathname==='/shell.html';
  if(!asset)return;
  event.respondWith(
    caches.match(req).then(hit=>{
      const network=fetch(req).then(res=>{
        if(res&&res.ok){const copy=res.clone();caches.open(RUNTIME_CACHE).then(c=>c.put(req,copy)).catch(()=>{})}
        return res;
      }).catch(()=>hit);
      return hit||network;
    })
  );
});
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});