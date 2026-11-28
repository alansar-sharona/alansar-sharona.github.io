/* جمعية الأنصار — تثبيت التطبيق على الموبايل + إشعارات Firebase
 * بيستخدمه تطبيق المتبرعين (/) وتطبيق الفريق (/app/). الإعداد قبل تحميل الملف:
 *   window.ANSAR_PWA = { sw:'/sw.js', scope:'/', kind:'donor'|'team', api:API, pin:function(){return PIN}, onChange:function(){} }
 */
(function () {
  var C = window.ANSAR_PWA || {};
  /* إعدادات Firebase (مشروع الجمعية) — مش سرية، دي بتتحط في أي صفحة ويب */
  var FCM = {
    apiKey: 'AIzaSyCxRlcCUIxNRsnCvORdywumeno_W3m_ruw', authDomain: 'alansar-sharona.firebaseapp.com', projectId: 'alansar-sharona',
    storageBucket: 'alansar-sharona.firebasestorage.app', messagingSenderId: '1090168626562', appId: '1:1090168626562:web:ee86fb484198adc3ad439b',
    vapidKey: 'BFB3Tq7Sy19BlljNlutmdiq3RI-hXwhXsCe28ugPTnfJ6s2XtbIWcFdPdLTtu9aZeY2vGOz2voMpboRwHtJYsRM'
  };
  var A = window.ANSAR_APP = {}, deferred = null;
  A.standalone = function () { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; };
  A.ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  /* التحديث التلقائي: أي نسخة جديدة بتتنزل لوحدها، والصفحة بتعمل reload مرة واحدة من غير ما حد يمسح التطبيق */
  if ('serviceWorker' in navigator && C.sw) {
    var hadCtl = !!navigator.serviceWorker.controller, reloaded = false;
    A.reg = navigator.serviceWorker.register(C.sw, { scope: C.scope, updateViaCache: 'none' }).catch(function () { return null; });
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadCtl && !reloaded) { reloaded = true; location.reload(); } });
    var chk = function () { A.reg.then(function (r) { if (r) r.update().catch(function () {}); }); };
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') chk(); });
    setInterval(chk, 30 * 60 * 1000);
  }
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
  /* كل خطوة ليها مهلة ورسالة واضحة، عشان لو حاجة وقفت نعرف هي فين */
  function step(p, sec, name) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('الخطوة «' + name + '» أخدت وقت أكتر من اللازم')); }, sec * 1000); })]);
  }
  A.enablePush = function (done, prog) {
    done = done || function () {}; prog = prog || function () {};
    var st = A.pushState();
    if (st === 'na') return done(A.pushConfigured() ? 'المتصفح ده مش بيدعم الإشعارات' : 'الإشعارات لسه بتتجهز');
    if (st === 'ios-install') return done('على الآيفون: ضيف التطبيق للشاشة الرئيسية الأول، وافتحه منها، وبعدين فعّل الإشعارات');
    prog('١/٤ بيطلب إذن الإشعارات…');
    step(Promise.resolve(Notification.requestPermission()), 60, 'إذن الإشعارات').then(function (p) {
      if (p !== 'granted') throw new Error('الإشعارات مش مسموحة — اسمح بيها من إعدادات المتصفح للموقع');
      prog('٢/٤ بيحمّل خدمة الإشعارات…');
      return step(new Promise(function (ok, no) { loadFb(function (err) { err ? no(new Error(err)) : ok(); }); }), 30, 'تحميل خدمة الإشعارات');
    }).then(function () {
      try { if (!firebase.apps.length) firebase.initializeApp(FCM); } catch (e) {}
      prog('٣/٤ بيجهز الموبايل للإشعارات…');
      var reg = navigator.serviceWorker.getRegistration(C.scope).then(function (r) { return r || navigator.serviceWorker.register(C.sw, { scope: C.scope }); })
        .then(function (r) { return r.active ? r : new Promise(function (ok) { var w = r.installing || r.waiting; if (!w) return ok(r); w.addEventListener('statechange', function () { if (w.state === 'activated') ok(r); }); }); });
      return step(reg, 30, 'تجهيز التطبيق').then(function (r) { return step(firebase.messaging().getToken({ vapidKey: FCM.vapidKey, serviceWorkerRegistration: r }), 40, 'رقم الجهاز من جوجل'); });
    }).then(function (tok) {
      if (!tok) throw new Error('جوجل ما ادّاش رقم للجهاز');
      prog('٤/٤ بيسجّل الموبايل…');
      return step(api('pushRegister', [C.kind === 'team' && C.pin ? C.pin() : '', tok, C.kind, navigator.userAgent.slice(0, 120)]), 40, 'التسجيل في السيرفر')
        .then(function () { localStorage.setItem('ansar_push_' + C.kind, tok); A.refresh(); done(null); });
    }).catch(function (e) { done('ما اتفعّلتش: ' + ((e && e.message) || e)); });
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
