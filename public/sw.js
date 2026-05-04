self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
  // Pass-through fetch to satisfy Chrome's PWA install requirement
});
