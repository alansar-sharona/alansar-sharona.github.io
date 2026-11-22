/**
 * منصة الأنصار — الجزء (أ): «ساعدني» + إشعارات المديرين
 * ملف Apps Script جديد. انسخه كملف جديد في مشروع السيرفر (A_Help_Notifications.gs).
 * ما بيعدّلش أي دالة موجودة. خطوات التطبيق في server/README.md.
 *
 * الدوال اللي المنصة بتناديها (لازم تتضاف لقائمة الدوال المسموحة في doPost):
 *   helpVideos(pin)          → فيديوهات «ساعدني» حسب دور المستخدم
 *   notifList(pin)           → آخر الإشعارات + عدد غير المقروء (للإدارة ومدير النظام بس)
 *   notifRead(pin, ids)      → يعلّم إشعارات مقروءة للمستخدم ده بس
 *   contactAdmin(pin, msg)   → رسالة من عضو فريق لمدير النظام (بتطلع إشعار)
 * دوال داخلية:
 *   notify_(type, desc, user, recId, needsAck)  → تسجيل إشعار (تقدر تناديها من أي دالة)
 *   nxScan()                 → بيشتغل كل 10 دقايق (Trigger) ويطلّع إشعارات من سجل التعديلات والعطاءات والمستخدمين وكوبو
 *   setupHelpNotif()         → شغّلها مرة واحدة من المحرر: بتعمل التابات وتظبط نقطة البداية وتركّب الـ Trigger
 */

var NX = {
  SHEET_ID: '15Q7oe1blUl4_Dl7GwTWJRM771LrF_gYnXTN94QsKnuc',
  T_NOTIF: 'الإشعارات',
  T_VIDEOS: 'فيديوهات_المساعدة',
  T_USERS: 'المستخدمين',
  T_LOG: 'سجل_التعديلات',
  T_ACTS: 'الأنشطة',
  ADMIN_ROLES: ['مدير النظام', 'إدارة'],
  KOBO_ASSET: 'aj2LfgU3yMyhxj4QzHWjXa',
  KOBO_BASE: 'https://kf.kobotoolbox.org',
  /* اسم الخاصية اللي فيها مفتاح كوبو في Script Properties — غيّره لو مختلف عندك */
  KOBO_TOKEN_PROP: 'KOBO_TOKEN',
  KEEP: 2000 // أقصى عدد إشعارات محفوظة في التاب قبل ما الأقدم يتنقل للأرشيف
};
var NX_NOTIF_HDR = ['المعرّف', 'التاريخ', 'النوع', 'الوصف', 'المستخدم', 'معرّف_السجل', 'يحتاج_تأكيد', 'مقروء_لمين'];
var NX_VIDEO_HDR = ['معرّف_الموضوع', 'العنوان', 'الرابط', 'الأدوار', 'الترتيب', 'مفعّل'];
/* نفس المواضيع اللي في app/index.html (HELP) — الرابط فاضي لحد ما أحمد يضيفه */
var NX_TOPICS = [
  ['pin', 'نسيت الرقم السري (PIN) أو مش عارف أدخل', ''],
  ['res_new', 'إزاي أعمل بحث جديد من المنصة', 'إدارة، باحث'],
  ['kobo_offline', 'إزاي أبعت البحث من كوبو من غير نت', 'إدارة، باحث'],
  ['fam_search', 'إزاي أدور على ملف أسرة', 'إدارة، باحث'],
  ['fam_edit', 'إزاي أعدّل أو أحذف ملف أسرة', 'إدارة'],
  ['res_review', 'إزاي أراجع وأعتمد بحث', 'إدارة'],
  ['res_loc', 'إزاي أضيف لوكيشن لبيت الأسرة', 'إدارة، باحث'],
  ['act_new', 'إزاي أسجل عطاء جديد', 'إدارة'],
  ['dist_scan', 'إزاي أسجل استلام بالسكان في صفحة التوزيع', 'إدارة، توزيع'],
  ['act_done', 'إزاي أعمل «تم التوزيع»', 'إدارة'],
  ['act_photos', 'إزاي أرفع صور وفيديو التوثيق', 'إدارة'],
  ['print_list', 'إزاي أطبع كشف', 'إدارة'],
  ['print_forms', 'إزاي أطبع استمارة بحث', 'إدارة، باحث'],
  ['kafala_pay', 'إزاي أسجل صرف الكفالات', 'إدارة'],
  ['notif', 'الإشعارات (الجرس)', 'إدارة'],
  ['sys_user', 'إزاي أضيف مستخدم جديد للمنصة', 'مدير النظام'],
  ['sys_video', 'إزاي أضيف فيديو لـ «ساعدني»', 'مدير النظام']
];

/* ---------- أدوات مشتركة ---------- */
function nxSS_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  return ss || SpreadsheetApp.openById(NX.SHEET_ID);
}
function nxSheet_(name, hdr) {
  var ss = nxSS_(), sh = ss.getSheetByName(name);
  if (!sh && hdr) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, hdr.length).setValues([hdr]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
  }
  return sh;
}
function nxRows_(sh) {
  if (!sh || sh.getLastRow() < 2) return { hdr: sh ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [], rows: [] };
  var v = sh.getDataRange().getValues();
  return { hdr: v[0].map(String), rows: v.slice(1) };
}
function nxCol_(hdr, names) {
  for (var i = 0; i < names.length; i++) { var k = hdr.indexOf(names[i]); if (k >= 0) return k; }
  return -1;
}
function nxFmt_(d) {
  return Utilities.formatDate(d instanceof Date ? d : new Date(d), 'Africa/Cairo', 'yyyy-MM-dd HH:mm');
}
/**
 * التحقق من الـ PIN — بيقرا تاب المستخدمين مباشرة.
 * لو السيرفر عنده دالة تحقق جاهزة (زي اللي بتستخدمها home)، الأفضل تبدّل جسم الدالة دي بيها.
 */
function nxUser_(pin) {
  pin = String(pin == null ? '' : pin).trim();
  if (!pin) throw new Error('الرقم السري مطلوب');
  var t = nxRows_(nxSheet_(NX.T_USERS));
  var cP = nxCol_(t.hdr, ['PIN', 'الرقم_السري']), cN = nxCol_(t.hdr, ['الاسم']), cR = nxCol_(t.hdr, ['الدور']), cA = nxCol_(t.hdr, ['فعّال', 'فعال']);
  for (var i = 0; i < t.rows.length; i++) {
    var r = t.rows[i];
    if (String(r[cP]).trim() !== pin) continue;
    if (cA >= 0 && /^(لا|no|false|0)$/i.test(String(r[cA]).trim())) break;
    var role = String(r[cR] || '').trim();
    return { name: String(r[cN] || '').trim(), role: role, admin: NX.ADMIN_ROLES.indexOf(role) >= 0 };
  }
  throw new Error('الرقم السري غلط');
}
function nxAdmin_(pin) {
  var u = nxUser_(pin);
  if (!u.admin) throw new Error('الشاشة دي للإدارة بس');
  return u;
}

/* ---------- فيديوهات «ساعدني» ---------- */
function helpVideos(pin) {
  var u = nxUser_(pin);
  var t = nxRows_(nxSheet_(NX.T_VIDEOS));
  if (!t.rows.length) return { list: [] };
  var cI = nxCol_(t.hdr, ['معرّف_الموضوع']), cT = nxCol_(t.hdr, ['العنوان']), cU = nxCol_(t.hdr, ['الرابط']),
      cR = nxCol_(t.hdr, ['الأدوار']), cO = nxCol_(t.hdr, ['الترتيب']), cE = nxCol_(t.hdr, ['مفعّل', 'مفعل']);
  var list = [];
  t.rows.forEach(function (r) {
    var url = String(r[cU] || '').trim(), id = String(r[cI] || '').trim();
    if (!id || !url) return;
    if (cE >= 0 && !/^(نعم|yes|true|1|✔|✅)$/i.test(String(r[cE]).trim())) return;
    var roles = String(r[cR] || '').split(/[،,]/).map(function (x) { return x.trim(); }).filter(String);
    if (roles.length && roles.indexOf('الكل') < 0 && roles.indexOf(u.role) < 0 && !(u.role === 'مدير النظام')) return;
    list.push({ id: id, title: String(r[cT] || ''), url: url, order: Number(r[cO]) || 99 });
  });
  list.sort(function (a, b) { return a.order - b.order; });
  return { list: list };
}

/* ---------- الإشعارات ---------- */
/**
 * تسجيل إشعار جديد. type لازم يكون واحد من:
 * بحث جديد · تعديل ملف أسرة · عطاء جديد · عطاء اتقفل · تم التوزيع · رفع صور · حذف ناعم · مستخدم جديد · شكوى أو اقتراح · رسالة للمدير
 * ما تكتبش في الوصف رقم قومي ولا PIN ولا مفتاح.
 */
function notify_(type, desc, user, recId, needsAck) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) {}
  try {
    var sh = nxSheet_(NX.T_NOTIF, NX_NOTIF_HDR);
    var id = 'N' + Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
    sh.appendRow([id, new Date(), String(type), String(desc || '').slice(0, 500), String(user || ''), String(recId == null ? '' : recId), needsAck ? 'نعم' : 'لا', '']);
    if (sh.getLastRow() > NX.KEEP + 200) nxArchive_(sh);
    return id;
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
function nxArchive_(sh) {
  var n = sh.getLastRow() - 1 - NX.KEEP;
  if (n <= 0) return;
  var arc = nxSheet_(NX.T_NOTIF + '_أرشيف', NX_NOTIF_HDR);
  var v = sh.getRange(2, 1, n, NX_NOTIF_HDR.length).getValues();
  arc.getRange(arc.getLastRow() + 1, 1, n, NX_NOTIF_HDR.length).setValues(v);
  sh.deleteRows(2, n);
}
function notifList(pin) {
  var u = nxAdmin_(pin);
  var sh = nxSheet_(NX.T_NOTIF, NX_NOTIF_HDR), last = sh.getLastRow();
  if (last < 2) return { list: [], unread: 0 };
  var from = Math.max(2, last - 149), v = sh.getRange(from, 1, last - from + 1, NX_NOTIF_HDR.length).getValues();
  var unread = 0, list = [];
  for (var i = v.length - 1; i >= 0; i--) {
    var r = v[i], readers = String(r[7] || '').split('|'), read = readers.indexOf(u.name) >= 0;
    if (!read) unread++;
    list.push({ id: String(r[0]), dt: r[1] ? nxFmt_(r[1]) : '', type: String(r[2]), desc: String(r[3]), by: String(r[4]), rec: String(r[5]), ack: String(r[6]) === 'نعم', read: read });
  }
  return { list: list, unread: unread };
}
function notifRead(pin, ids) {
  var u = nxAdmin_(pin);
  ids = (ids || []).map(String);
  if (!ids.length) return { n: 0 };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) {}
  try {
    var sh = nxSheet_(NX.T_NOTIF, NX_NOTIF_HDR), last = sh.getLastRow();
    if (last < 2) return { n: 0 };
    var from = Math.max(2, last - 299), n = last - from + 1;
    var idc = sh.getRange(from, 1, n, 1).getValues(), rc = sh.getRange(from, 8, n, 1).getValues(), k = 0;
    for (var i = 0; i < n; i++) {
      if (ids.indexOf(String(idc[i][0])) < 0) continue;
      var rd = String(rc[i][0] || '').split('|').filter(String);
      if (rd.indexOf(u.name) < 0) { rd.push(u.name); rc[i][0] = rd.join('|'); k++; }
    }
    if (k) sh.getRange(from, 8, n, 1).setValues(rc);
    return { n: k };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
function contactAdmin(pin, msg) {
  var u = nxUser_(pin);
  msg = String(msg || '').trim().slice(0, 1000);
  if (msg.length < 3) throw new Error('اكتب رسالتك الأول');
  notify_('رسالة للمدير', msg, u.name + ' (' + u.role + ')', '', true);
  return { ok: 1 };
}

/* ---------- المسح الدوري (Trigger كل 10 دقايق) ---------- */
function nxScan() {
  var P = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    nxScanLog_(P);
    nxScanActs_(P);
    nxScanUsers_(P);
    nxScanKobo_(P);
  } finally { lock.releaseLock(); }
}
/* سجل التعديلات → تعديل ملف أسرة / حذف ناعم / رفع صور (بيجمّع تعديلات نفس الشخص على نفس الملف في إشعار واحد) */
function nxScanLog_(P) {
  var sh = nxSheet_(NX.T_LOG); if (!sh) return;
  var last = sh.getLastRow(), done = Number(P.getProperty('NX_LOG_ROW') || last);
  if (last <= done) { P.setProperty('NX_LOG_ROW', String(last)); return; }
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var v = sh.getRange(done + 1, 1, last - done, hdr.length).getValues();
  var cU = nxCol_(hdr, ['المستخدم']), cF = nxCol_(hdr, ['رقم_الملف']), cK = nxCol_(hdr, ['الحقل']), cN = nxCol_(hdr, ['القيمة_الجديدة']);
  var G = {}, order = [];
  v.forEach(function (r) {
    var who = String(r[cU] || ''), rec = String(r[cF] || ''), fld = String(r[cK] || ''), nv = String(r[cN] || '');
    var type = 'تعديل ملف أسرة';
    if (/صور/.test(fld)) type = 'رفع صور';
    else if (/حذف/.test(fld) || (fld === 'حالة_الملف' && nv === 'محذوف')) type = 'حذف ناعم';
    else if (/^ACT-/.test(rec)) return; // تعديلات العطاءات بتتغطى من nxScanActs_
    var k = type + '|' + who + '|' + rec;
    if (!G[k]) { G[k] = { type: type, who: who, rec: rec, f: [] }; order.push(k); }
    if (fld && G[k].f.indexOf(fld) < 0) G[k].f.push(fld.replace(/_/g, ' '));
  });
  order.forEach(function (k) {
    var g = G[k], d;
    if (g.type === 'رفع صور') d = 'صور توثيق جديدة على ' + g.rec;
    else if (g.type === 'حذف ناعم') d = 'اتحذف (حذف ناعم): ' + g.rec;
    else d = 'ملف ' + g.rec + ' — ' + g.f.slice(0, 6).join('، ') + (g.f.length > 6 ? ' و' + (g.f.length - 6) + ' غيرهم' : '');
    notify_(g.type, d, g.who, g.rec, g.type === 'حذف ناعم');
  });
  P.setProperty('NX_LOG_ROW', String(last));
}
/* العطاءات → عطاء جديد / عطاء اتقفل / تم التوزيع */
function nxScanActs_(P) {
  var t = nxRows_(nxSheet_(NX.T_ACTS)); if (!t.rows.length) return;
  var cC = nxCol_(t.hdr, ['كود_النشاط']), cN = nxCol_(t.hdr, ['اسم_النشاط']), cO = nxCol_(t.hdr, ['مفتوح_للتوزيع']), cS = nxCol_(t.hdr, ['حالة_العطاء']), cF = nxCol_(t.hdr, ['عدد_الأسر_الإجمالي']);
  var old = JSON.parse(P.getProperty('NX_ACTS') || 'null'), now = {};
  t.rows.forEach(function (r) {
    var c = String(r[cC] || '').trim(); if (!c) return;
    now[c] = [String(r[cO] || ''), String(r[cS] || '')];
    if (!old) return;
    var name = String(r[cN] || c), o = old[c];
    if (!o) { notify_('عطاء جديد', name, '', c, false); return; }
    if (now[c][1] !== o[1] && /تم التوزيع/.test(now[c][1])) notify_('تم التوزيع', name + (r[cF] ? ' — ' + r[cF] + ' أسرة' : ''), '', c, false);
    else if (now[c][0] !== o[0] && /^(لا|مقفول|FALSE|false|0)$/.test(now[c][0])) notify_('عطاء اتقفل', name, '', c, false);
  });
  P.setProperty('NX_ACTS', JSON.stringify(now));
}
/* المستخدمين → مستخدم جديد (من غير PIN طبعاً) */
function nxScanUsers_(P) {
  var t = nxRows_(nxSheet_(NX.T_USERS)); if (!t.rows.length) return;
  var cN = nxCol_(t.hdr, ['الاسم']), cR = nxCol_(t.hdr, ['الدور']);
  var names = t.rows.map(function (r) { return String(r[cN] || '').trim(); }).filter(String);
  var old = JSON.parse(P.getProperty('NX_USERS') || 'null');
  if (old) t.rows.forEach(function (r) {
    var n = String(r[cN] || '').trim();
    if (n && old.indexOf(n) < 0) notify_('مستخدم جديد', n + ' — ' + String(r[cR] || ''), '', '', true);
  });
  P.setProperty('NX_USERS', JSON.stringify(names));
}
/* كوبو → بحث جديد مستني اعتماد (من كوبو أو من المنصة) */
function nxScanKobo_(P) {
  var tok = P.getProperty(NX.KOBO_TOKEN_PROP); if (!tok) return;
  var url = NX.KOBO_BASE + '/api/v2/assets/' + NX.KOBO_ASSET + '/data/?format=json&limit=30&sort=' + encodeURIComponent('{"_id":-1}') +
    '&fields=' + encodeURIComponent('["_id","_submitted_by","g_file/researcher","g_file/fn","_validation_status"]');
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Token ' + tok }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return;
  var L = JSON.parse(res.getContentText()).results || [], seen = Number(P.getProperty('NX_KOBO_ID') || 0), top = seen;
  if (!seen) { if (L.length) P.setProperty('NX_KOBO_ID', String(L[0]._id)); return; }
  L.slice().reverse().forEach(function (s) {
    if (s._id <= seen) return;
    top = Math.max(top, s._id);
    var vs = s._validation_status && s._validation_status.uid;
    if (vs) return; // اتراجع خلاص
    var fn = s['g_file/fn'] || '', by = s['g_file/researcher'] || s._submitted_by || '';
    notify_('بحث جديد', 'بحث ' + (fn ? 'لملف ' + fn : 'لحالة جديدة') + ' مستني اعتماد', by, s._id, true);
  });
  P.setProperty('NX_KOBO_ID', String(top));
}

/* ---------- الإعداد (مرة واحدة من المحرر) ---------- */
function setupHelpNotif() {
  nxSheet_(NX.T_NOTIF, NX_NOTIF_HDR);
  var vs = nxSheet_(NX.T_VIDEOS, NX_VIDEO_HDR);
  if (vs.getLastRow() < 2) {
    var rows = NX_TOPICS.map(function (t, i) { return [t[0], t[1], '', t[2], i + 1, 'نعم']; });
    vs.getRange(2, 1, rows.length, NX_VIDEO_HDR.length).setValues(rows);
    vs.getRange(2, 6, rows.length, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['نعم', 'لا']).build());
  }
  // نقطة البداية: الإشعارات تبدأ من دلوقتي، من غير ما تطلّع إشعارات للتاريخ القديم
  var P = PropertiesService.getScriptProperties();
  var log = nxSheet_(NX.T_LOG); if (log) P.setProperty('NX_LOG_ROW', String(log.getLastRow()));
  P.deleteProperty('NX_ACTS'); P.deleteProperty('NX_USERS'); P.deleteProperty('NX_KOBO_ID');
  nxScanActs_(P); nxScanUsers_(P); nxScanKobo_(P);
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'nxScan') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('nxScan').timeBased().everyMinutes(10).create();
  return 'تم: تاب الإشعارات وتاب الفيديوهات جاهزين، والمسح كل 10 دقايق شغال';
}
