const CACHE='sceneplan-focus-v4-20261113';
const ASSETS=['./','./index.html','./style.css','./app.js','./arrus-import.js','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('sceneplan-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})())});
self.addEventListener('fetch',event=>{if(event.request.method==='GET'&&new URL(event.request.url).origin===location.origin){event.respondWith(caches.open(CACHE).then(c=>fetch(event.request).then(response=>{if(response.ok)c.put(event.request,response.clone());return response}).catch(()=>c.match(event.request))))}});
