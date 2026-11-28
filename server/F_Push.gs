/**
 * (و) إشعارات الموبايل — Firebase Cloud Messaging (للمتبرعين والفريق)
 * محتاج: الرمز.gs (user_ و ss_ و fmt_ و now_) + A_Help_Notifications.gs
 *
 * الإعداد مرة واحدة (Script Properties):
 *   FCM_SA = محتوى ملف مفتاح «حساب الخدمة» بتاع مشروع Firebase (JSON) — سري، ما يتحطش في الكود
 *
 * دوال doPost: pushRegister, pushUnregister, pushSendAdmin, pushStats
 * من الكود: pushSend_(title, body, link, audience) — audience: donors | team | admins | all | role:باحث | name:الاسم
 */
var PU = {
  T_DEV: 'أجهزة_الإشعارات',
  DEV_HDR: ['الرقم', 'النوع', 'الاسم', 'الدور', 'أول_تسجيل', 'آخر_تحديث', 'الجهاز'],
  T_LOG: 'سجل_الإشعارات_المرسلة',
  LOG_HDR: ['الوقت', 'المرسل', 'الجمهور', 'العنوان', 'الرسالة', 'اللينك', 'وصل', 'فشل'],
  ADMIN: ['مدير النظام', 'إدارة'],
  AUD: { donors: 'المتبرعين', team: 'الفريق كله', admins: 'الإدارة', all: 'الكل' },
  SITE: 'https://alansar-sharona.github.io'
};
function puSheet_(name, hdr) {
  var ss = ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(hdr); sh.setFrozenRows(1); sh.setRightToLeft(true); sh.getRange(1, 1, 1, hdr.length).setFontWeight('bold'); }
  return sh;
}

/** تسجيل موبايل — المتبرع من غير PIN، والفريق بالـ PIN بتاعه */
function pushRegister(pin, token, kind, ua) {
  token = String(token || '').trim();
  if (!/^[\w:\-]{20,400}$/.test(token)) throw new Error('رقم الجهاز مش صحيح');
  var name = '', role = '', type = 'متبرع';
  if (kind === 'team') { var u = user_(pin, true); name = u.name; role = u.role; type = 'فريق'; }
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = puSheet_(PU.T_DEV, PU.DEV_HDR), n = sh.getLastRow(), now = now_();
    var toks = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    var i = toks.indexOf(token), row = [token, type, name, role, now, now, String(ua || '').slice(0, 120)];
    if (i >= 0) { var old = sh.getRange(i + 2, 5).getValue(); row[4] = old || now; sh.getRange(i + 2, 1, 1, 7).setValues([row]); }
    else sh.appendRow(row);
  } finally { lock.releaseLock(); }
  return { ok: true };
}
function pushUnregister(token) {
  var sh = puSheet_(PU.T_DEV, PU.DEV_HDR), n = sh.getLastRow();
  if (n < 2) return { ok: true };
  var v = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === String(token)) sh.deleteRow(i + 2);
  return { ok: true };
}

/* ---------- مفتاح Google لإرسال الإشعارات (من حساب الخدمة) ---------- */
function puCfg_() {
  var raw = PropertiesService.getScriptProperties().getProperty('FCM_SA');
  if (!raw) throw new Error('الإشعارات لسه ما اتجهزتش — مفتاح FCM_SA مش متحط في إعدادات السيرفر');
  return JSON.parse(raw);
}
function puToken_() {
  var c = CacheService.getScriptCache(), hit = c.get('fcm_tok');
  if (hit) return hit;
  var sa = puCfg_(), now = Math.floor(Date.now() / 1000);
  function b64(o) { return Utilities.base64EncodeWebSafe(typeof o === 'string' ? o : JSON.stringify(o)).replace(/=+$/, ''); }
  var head = b64({ alg: 'RS256', typ: 'JWT' }),
      body = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(head + '.' + body, sa.private_key)).replace(/=+$/, '');
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + body + '.' + sig } });
  if (r.getResponseCode() >= 300) throw new Error('مفتاح الإشعارات مرفوض من جوجل (' + r.getResponseCode() + ')');
  var tok = JSON.parse(r.getContentText()).access_token;
  c.put('fcm_tok', tok, 3000);
  return tok;
}

/** الأجهزة حسب الجمهور */
function puTargets_(aud) {
  var sh = ss_().getSheetByName(PU.T_DEV);
  if (!sh || sh.getLastRow() < 2) return [];
  aud = String(aud || 'all');
  return sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().filter(function (r) {
    var t = String(r[1]), nm = String(r[2]), rl = String(r[3]);
    if (!r[0]) return false;
    if (aud === 'all') return true;
    if (aud === 'donors') return t === 'متبرع';
    if (aud === 'team') return t === 'فريق';
    if (aud === 'admins') return t === 'فريق' && PU.ADMIN.indexOf(rl) >= 0;
    if (aud.indexOf('role:') === 0) return t === 'فريق' && rl === aud.slice(5);
    if (aud.indexOf('name:') === 0) return t === 'فريق' && nm === aud.slice(5);
    return false;
  }).map(function (r) { return { token: String(r[0]), type: String(r[1]) }; });
}

/** إرسال فعلي — بيرجّع عدد اللي وصل والفاشل، وبيشيل الأجهزة اللي اتلغت */
function pushSend_(title, body, link, aud) {
  var T = puTargets_(aud);
  if (!T.length) return { sent: 0, failed: 0 };
  var sa = puCfg_(), tok = puToken_(), url = 'https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send';
  var reqs = T.map(function (t) {
    var home = t.type === 'متبرع' ? PU.SITE + '/' : PU.SITE + '/app/';
    var lk = String(link || '') || home;
    if (!/^https:\/\//.test(lk)) lk = home;
    return { url: url, method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tok },
      payload: JSON.stringify({ message: { token: t.token,
        notification: { title: String(title).slice(0, 80), body: String(body).slice(0, 300) },
        data: { link: lk, title: String(title).slice(0, 80), body: String(body).slice(0, 300) },
        webpush: { fcm_options: { link: lk }, headers: { Urgency: 'high', TTL: '86400' } } } }) };
  });
  var sent = 0, failed = 0, dead = [];
  for (var i = 0; i < reqs.length; i += 50) {
    UrlFetchApp.fetchAll(reqs.slice(i, i + 50)).forEach(function (r, j) {
      var c = r.getResponseCode();
      if (c < 300) { sent++; return; }
      failed++;
      if (c === 404 || c === 410 || /UNREGISTERED|INVALID_ARGUMENT/.test(r.getContentText())) dead.push(T[i + j].token);
    });
  }
  dead.forEach(function (d) { try { pushUnregister(d); } catch (e) {} });
  return { sent: sent, failed: failed };
}
/** إرسال من غير ما يوقّع أي عملية تانية لو الإشعارات مش متجهزة */
function pushSafe_(title, body, link, aud) { try { return pushSend_(title, body, link, aud); } catch (e) { return { sent: 0, failed: 0, error: e.message }; } }

/** شاشة «إرسال إشعار» — للإدارة */
function pushSendAdmin(pin, title, body, link, aud) {
  var u = user_(pin, true);
  if (PU.ADMIN.indexOf(u.role) < 0) throw new Error('إرسال الإشعارات للإدارة بس');
  title = String(title || '').trim(); body = String(body || '').trim(); link = String(link || '').trim();
  if (!title || !body) throw new Error('اكتب العنوان والرسالة');
  if (link && !/^https:\/\//.test(link)) throw new Error('اللينك لازم يبدأ بـ https://');
  var r = pushSend_(title, body, link, aud);
  puSheet_(PU.T_LOG, PU.LOG_HDR).appendRow([now_(), u.name, puAudLabel_(aud), title, body, link, r.sent, r.failed]);
  return r;
}
function puAudLabel_(a) { a = String(a || ''); return PU.AUD[a] || (a.indexOf('role:') === 0 ? a.slice(5) : a.indexOf('name:') === 0 ? a.slice(5) : a); }
function pushStats(pin) {
  var u = user_(pin, true);
  if (PU.ADMIN.indexOf(u.role) < 0) throw new Error('للإدارة بس');
  var d = 0, t = 0, sh = ss_().getSheetByName(PU.T_DEV);
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { if (r[0] === 'متبرع') d++; else if (r[0] === 'فريق') t++; });
  var log = [], lg = ss_().getSheetByName(PU.T_LOG);
  if (lg && lg.getLastRow() > 1) {
    var n = Math.min(15, lg.getLastRow() - 1);
    log = lg.getRange(lg.getLastRow() - n + 1, 1, n, 8).getValues().reverse().map(function (r) {
      return { dt: r[0] instanceof Date ? fmt_(r[0], 'dd/MM/yyyy hh:mm a') : String(r[0]), by: String(r[1]), aud: String(r[2]), title: String(r[3]), body: String(r[4]), sent: Number(r[6]) || 0 };
    });
  }
  return { donors: d, team: t, log: log };
}
function setupPush() { puSheet_(PU.T_DEV, PU.DEV_HDR); puSheet_(PU.T_LOG, PU.LOG_HDR); return 'تم: تاب أجهزة_الإشعارات وسجل_الإشعارات_المرسلة'; }
