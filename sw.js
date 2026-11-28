/* تطبيق «جمعية الأنصار» للمتبرعين — شغال من غير نت + إشعارات */
var PREFIX = 'ansar-pub-', CACHE = PREFIX + 'v1', HOME = '/', ICON = '/icon-192.png';
var SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
/* الإشعارات: بتيجي من Firebase Cloud Messaging — بنعرضها هنا من غير مكتبة firebase */
self.addEventListener('push', function (e) {
  var p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) { p = { notification: { body: e.data ? e.data.text() : '' } }; }
  var n = p.notification || {}, d = p.data || {};
  var title = n.title || d.title || 'جمعية الأنصار';
  e.waitUntil(self.registration.showNotification(title, {
    body: n.body || d.body || '', icon: ICON, badge: ICON, dir: 'rtl', lang: 'ar',
    data: { link: d.link || (p.fcmOptions && p.fcmOptions.link) || HOME }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.link) || HOME;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if (cs[i].url.indexOf(HOME) >= 0 && 'focus' in cs[i]) { cs[i].navigate(url); return cs[i].focus(); }
    return clients.openWindow(url);
  }));
});
/* الصفحات: من النت الأول، ولو مفيش نت من النسخة المحفوظة */
self.addEventListener('install', function (e) { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(r).then(function (res) {
    if (res && res.ok) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); }
    return res;
  }).catch(function () { return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match(SHELL[0]); }); }));
});
