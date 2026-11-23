/**
 * منصة الأنصار — الجزء (ب): الصفحة العامة + شكاوي ومقترحات + لينكات فيسبوك
 * ملف جديد (B_PublicPage.gs). بيعتمد على أدوات ملف A_Help_Notifications.gs (nxSS_, nxSheet_, nxRows_, nxCol_, nxUser_, notify_).
 *
 * دوال عامة (من غير PIN — الصفحة العامة):
 *   pubInfo()                          → أعضاء المجلس والمنتسبين (الاسم والصفة بس)، أرقام التبرع، لينكات فيسبوك
 *   feedbackSubmit(form)               → شكوى أو اقتراح (الهوية اختيارية) → تاب شكاوي_ومقترحات + إشعار
 * دوال المنصة (بالـ PIN):
 *   feedbackList(pin)                  → للإدارة ومدير النظام
 *   feedbackSet(pin, id, status, note) → تغيير الحالة (جديدة / اتقرت / اتحلّت) + ملاحظة
 *   fbList(pin) / fbAdd(pin, url, title) / fbHide(pin, id)  → لينكات فيسبوك (مدير النظام والإدارة)
 * إعداد مرة واحدة: setupPublic()
 *
 * قاعدة: pubInfo ما بترجّعش أي رقم قومي ولا تليفون أشخاص ولا اسم مستفيد.
 */

var PB = {
  T_BOARD: 'أعضاء_الصفحة_العامة',
  T_FB: 'روابط_فيسبوك',
  T_FEED: 'شكاوي_ومقترحات',
  T_SET: 'الإعدادات',
  FEED_MAX_PER_HOUR: 40
};
var PB_BOARD_HDR = ['الترتيب', 'الاسم', 'الصفة', 'النوع', 'يظهر'];
var PB_FB_HDR = ['المعرّف', 'التاريخ', 'الرابط', 'العنوان', 'يظهر', 'أضافه'];
var PB_FEED_HDR = ['المعرّف', 'التاريخ', 'النوع', 'الرسالة', 'الاسم', 'التليفون', 'الحالة', 'ملاحظة_الإدارة', 'آخر_تعديل'];

function pbSettings_() {
  var t = nxRows_(nxSheet_(PB.T_SET)), o = {};
  t.rows.forEach(function (r) { if (r[0]) o[String(r[0]).trim()] = String(r[1] == null ? '' : r[1]).trim(); });
  return o;
}
function pbYes_(v) { return /^(نعم|yes|true|1|✔|✅)$/i.test(String(v).trim()); }

/* ---------- الصفحة العامة ---------- */
function pubInfo() {
  var c = CacheService.getScriptCache(), hit = c.get('pubInfo');
  if (hit) return JSON.parse(hit);
  var out = { board: [], nums: [], whatsapp: '', instapay: '', wallet: '', walletName: '', fb: [] };
  // أعضاء المجلس والمنتسبين — الاسم والصفة والنوع بس
  var b = nxRows_(nxSheet_(PB.T_BOARD));
  var cO = nxCol_(b.hdr, ['الترتيب']), cN = nxCol_(b.hdr, ['الاسم']), cT = nxCol_(b.hdr, ['الصفة']), cK = nxCol_(b.hdr, ['النوع']), cV = nxCol_(b.hdr, ['يظهر']);
  b.rows.forEach(function (r) {
    if (cV >= 0 && String(r[cV]).trim() && !pbYes_(r[cV])) return;
    out.board.push({ o: Number(r[cO]) || 99, name: String(r[cN] || '').trim(), title: String(r[cT] || '').trim(), kind: /منتسب/.test(String(r[cK])) ? 'منتسب' : 'عامل' });
  });
  out.board.sort(function (a, b2) { return a.o - b2.o; });
  // أرقام الجمعية من تاب الإعدادات (الصفحة نفسها بتعرض الرقم بس لو موجود في قائمتها الرسمية)
  var s = pbSettings_();
  ['رقم_1', 'رقم_2'].forEach(function (k) { if (s[k]) out.nums.push(s[k].replace(/\D/g, '')); });
  out.whatsapp = (s['رقم_واتساب'] || '').replace(/\D/g, '');
  out.instapay = s['رقم_InstaPay'] || '';
  out.wallet = (s['محفظة_فودافون_كاش'] || '').replace(/\D/g, '');
  out.walletName = s['اسم_صاحب_المحفظة'] || '';
  // لينكات فيسبوك اللي اتضافت من المنصة
  var f = nxRows_(nxSheet_(PB.T_FB));
  var fU = nxCol_(f.hdr, ['الرابط']), fT = nxCol_(f.hdr, ['العنوان']), fV = nxCol_(f.hdr, ['يظهر']);
  for (var i = f.rows.length - 1; i >= 0 && out.fb.length < 12; i--) {
    var r = f.rows[i], u = String(r[fU] || '').trim();
    if (!/^https:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.watch)\//.test(u)) continue;
    if (fV >= 0 && !pbYes_(r[fV])) continue;
    out.fb.push([u, String(r[fT] || '').trim()]);
  }
  c.put('pubInfo', JSON.stringify(out), 300);
  return out;
}

function feedbackSubmit(form) {
  form = form || {};
  if (form.website) return { ok: 1 }; // فخ للسبام: الخانة دي مخفية عن الناس
  var msg = String(form.msg || '').trim().slice(0, 1500);
  if (msg.length < 5) throw new Error('اكتب رسالتك (5 حروف على الأقل)');
  var type = ['شكوى', 'اقتراح', 'سؤال'].indexOf(form.type) >= 0 ? form.type : 'اقتراح';
  var name = String(form.name || '').trim().slice(0, 80), phone = String(form.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
  var c = CacheService.getScriptCache(), n = Number(c.get('pbFeedN') || 0);
  if (n >= PB.FEED_MAX_PER_HOUR) throw new Error('فيه ضغط رسايل دلوقتي — جرّب بعد شوية أو كلّمنا تليفونياً');
  c.put('pbFeedN', String(n + 1), 3600);
  var lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) {}
  var id;
  try {
    var sh = nxSheet_(PB.T_FEED, PB_FEED_HDR);
    id = 'F' + Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
    sh.appendRow([id, new Date(), type, msg, name, phone, 'جديدة', '', '']);
  } finally { try { lock.releaseLock(); } catch (e) {} }
  if (typeof notify_ === 'function') notify_('شكوى أو اقتراح', type + ': ' + msg.slice(0, 140) + (msg.length > 140 ? '…' : ''), name || 'من غير اسم', id, true);
  return { ok: 1 };
}

/* ---------- جوه المنصة ---------- */
function feedbackList(pin) {
  nxAdmin_(pin);
  var t = nxRows_(nxSheet_(PB.T_FEED, PB_FEED_HDR)), L = [];
  for (var i = t.rows.length - 1; i >= 0 && L.length < 300; i--) {
    var r = t.rows[i];
    L.push({ id: String(r[0]), dt: r[1] ? nxFmt_(r[1]) : '', type: String(r[2]), msg: String(r[3]), name: String(r[4]), phone: String(r[5]), st: String(r[6] || 'جديدة'), note: String(r[7] || '') });
  }
  return { list: L };
}
function feedbackSet(pin, id, status, note) {
  var u = nxAdmin_(pin);
  if (['جديدة', 'اتقرت', 'اتحلّت'].indexOf(status) < 0) throw new Error('حالة غير معروفة');
  var sh = nxSheet_(PB.T_FEED, PB_FEED_HDR), v = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(id)) {
    sh.getRange(i + 1, 7, 1, 3).setValues([[status, String(note || '').slice(0, 500), u.name + ' — ' + nxFmt_(new Date())]]);
    return { ok: 1 };
  }
  throw new Error('الرسالة مش موجودة');
}
function fbList(pin) {
  nxAdmin_(pin);
  var t = nxRows_(nxSheet_(PB.T_FB, PB_FB_HDR)), L = [];
  for (var i = t.rows.length - 1; i >= 0; i--) { var r = t.rows[i]; L.push({ id: String(r[0]), dt: r[1] ? nxFmt_(r[1]) : '', url: String(r[2]), title: String(r[3]), on: pbYes_(r[4]), by: String(r[5]) }); }
  return { list: L };
}
function fbAdd(pin, url, title) {
  var u = nxAdmin_(pin);
  url = String(url || '').trim(); title = String(title || '').trim().slice(0, 80);
  if (!/^https:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.watch)\//.test(url)) throw new Error('الصق لينك من فيسبوك (يبدأ بـ https://www.facebook.com)');
  if (!title) throw new Error('اكتب عنوان قصير للبوست');
  var id = 'P' + Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyMMddHHmmss');
  nxSheet_(PB.T_FB, PB_FB_HDR).appendRow([id, new Date(), url, title, 'نعم', u.name]);
  CacheService.getScriptCache().remove('pubInfo');
  return { id: id };
}
function fbHide(pin, id) {
  nxAdmin_(pin);
  var sh = nxSheet_(PB.T_FB, PB_FB_HDR), v = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(id)) { sh.getRange(i + 1, 5).setValue('لا'); CacheService.getScriptCache().remove('pubInfo'); return { ok: 1 }; }
  throw new Error('اللينك مش موجود');
}

/* ---------- إعداد مرة واحدة ---------- */
function setupPublic() {
  var b = nxSheet_(PB.T_BOARD, PB_BOARD_HDR);
  if (b.getLastRow() < 2) {
    // الصفات بس من تاب مجلس_الإدارة — الأسماء فاضية لحد ما أحمد يكتبها
    var titles = ['رئيس مجلس الإدارة', 'نائب رئيس مجلس الإدارة', 'أمين الصندوق', 'سكرتير', 'عضو', 'عضو', 'عضو'];
    var rows = titles.map(function (t, i) { return [i + 1, '', t, 'عامل', 'نعم']; });
    for (var k = 0; k < 3; k++) rows.push([20 + k, '', 'عضو منتسب', 'منتسب', 'نعم']);
    b.getRange(2, 1, rows.length, PB_BOARD_HDR.length).setValues(rows);
    b.getRange(2, 4, 200, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['عامل', 'منتسب']).build());
    b.getRange(2, 5, 200, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['نعم', 'لا']).build());
  }
  nxSheet_(PB.T_FB, PB_FB_HDR);
  var f = nxSheet_(PB.T_FEED, PB_FEED_HDR);
  f.getRange(2, 7, 1000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['جديدة', 'اتقرت', 'اتحلّت']).build());
  CacheService.getScriptCache().remove('pubInfo');
  return 'تم: أعضاء_الصفحة_العامة (أسماء فاضية) + روابط_فيسبوك + شكاوي_ومقترحات';
}
