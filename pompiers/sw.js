/* Ancienne adresse de Montée en véhicule : supprime ses copies hors ligne et se désinstalle */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => /^monter-vehicule-v\d+$/.test(k)).map(k => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type:'window' })).then(cs => cs.forEach(c => c.navigate(c.url))));
});
