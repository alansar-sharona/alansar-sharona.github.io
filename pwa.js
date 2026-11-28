/* جمعية الأنصار — تثبيت التطبيق على الموبايل + إشعارات Firebase
 * بيستخدمه تطبيق المتبرعين (/) وتطبيق الفريق (/app/). الإعداد قبل تحميل الملف:
 *   window.ANSAR_PWA = { sw:'/sw.js', scope:'/', kind:'donor'|'team', api:API, pin:function(){return PIN}, onChange:function(){} }
 */
(function () {
  var C = window.ANSAR_PWA || {};
  /* إعدادات Firebase (مشروع الجمعية) — مش سرية، دي بتتحط في أي صفحة ويب */
  var FCM = {
    apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '',
    vapidKey: ''
  };
  var A = window.ANSAR_APP = {}, deferred = null;
  A.standalone = function () { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; };
  A.ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if ('serviceWorker' in navigator && C.sw) A.reg = navigator.serviceWorker.register(C.sw, { scope: C.scope }).catch(function () { return null; });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; A.refresh(); });
  window.addEventListener('appinstalled', function () { deferred = null; A.refresh(); });
  A.canInstall = function () { return !A.standalone() && (!!deferred || A.ios || /android/i.test(navigator.userAgent)); };
  A.install = function () {
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; A.refresh(); }); return; }
    if (A.ios) alert('على الآيفون:\n1) دوس زرار المشاركة ⬆️ اللي تحت في Safari\n2) اختار «إضافة إلى الشاشة الرئيسية»\n3) دوس «إضافة»');
    else alert('من قايمة المتصفح ⋮ فوق، اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»');
  };
  A.pushConfigured = function () { return !!(FCM.apiKey && FCM.vapidKey); };
  A.pushSupported = function () { return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window; };
  /* on | off | denied | ios-install (آيفون لازم يتضاف للشاشة الأول) | na */
  A.pushState = function () {
    if (!A.pushConfigured()) return 'na';
    if (A.ios && !A.standalone()) return 'ios-install';
    if (!A.pushSupported()) return 'na';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.permission === 'granted' && localStorage.getItem('ansar_push_' + C.kind) ? 'on' : 'off';
  };
  function loadFb(cb) {
    if (window.firebase && firebase.messaging) return cb();
    var v = '10.12.2', s = ['firebase-app-compat.js', 'firebase-messaging-compat.js'], n = 0;
    (function nx() {
      if (n >= s.length) return cb();
      var e = document.createElement('script'); e.src = 'https://www.gstatic.com/firebasejs/' + v + '/' + s[n++];
      e.onload = nx; e.onerror = function () { cb('مش قادر أحمّل خدمة الإشعارات — اتأكد من النت'); };
      document.head.appendChild(e);
    })();
  }
  function api(fn, args) {
    return fetch(C.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args }) })
      .then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) throw new Error(j.error || 'حصل خطأ'); return j.data; });
  }
  A.enablePush = function (done) {
    done = done || function () {};
    var st = A.pushState();
    if (st === 'na') return done(A.pushConfigured() ? 'المتصفح ده مش بيدعم الإشعارات' : 'الإشعارات لسه بتتجهز');
    if (st === 'ios-install') return done('على الآيفون: ضيف التطبيق للشاشة الرئيسية الأول، وافتحه منها، وبعدين فعّل الإشعارات');
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') return done('الإشعارات مش مسموحة — تقدر تسمح بيها من إعدادات المتصفح للموقع');
      loadFb(function (err) {
        if (err) return done(err);
        try { if (!firebase.apps.length) firebase.initializeApp(FCM); } catch (e) {}
        navigator.serviceWorker.ready
          .then(function (reg) { return firebase.messaging().getToken({ vapidKey: FCM.vapidKey, serviceWorkerRegistration: reg }); })
          .then(function (tok) {
            if (!tok) throw new Error('مفيش رقم جهاز');
            return api('pushRegister', [C.kind === 'team' && C.pin ? C.pin() : '', tok, C.kind, navigator.userAgent.slice(0, 120)])
              .then(function () { localStorage.setItem('ansar_push_' + C.kind, tok); A.refresh(); done(null); });
          })
          .catch(function (e) { done('حصلت مشكلة في تفعيل الإشعارات: ' + ((e && e.message) || e)); });
      });
    });
  };
  A.disablePush = function (done) {
    var tok = localStorage.getItem('ansar_push_' + C.kind);
    localStorage.removeItem('ansar_push_' + C.kind);
    (tok ? api('pushUnregister', [tok]) : Promise.resolve()).then(function () { A.refresh(); done && done(null); }, function () { A.refresh(); done && done(null); });
  };
  /* الفريق: لو الجهاز متسجل، بنحدّث صاحبه بعد الدخول (لو اتغيّر المستخدم على نفس الموبايل) */
  A.syncTeam = function () {
    var tok = localStorage.getItem('ansar_push_' + C.kind);
    if (tok && C.kind === 'team' && C.pin && C.pin()) api('pushRegister', [C.pin(), tok, C.kind, navigator.userAgent.slice(0, 120)]).catch(function () {});
  };
  A.refresh = function () { if (C.onChange) try { C.onChange(); } catch (e) {} };
})();
