/**
 * (هـ) مراجعة الأبحاث — عرض البحث كامل، تعديله، إرجاعه للباحث، وملخص التغييرات عن ملف الأسرة
 * محتاج: الرمز.gs (kobo_ و user_ و table_ و lab_ و normAddr_) + ملفات (أ) و(ج) و(د)
 *
 * دوال doPost: resGet, resEdit, resReturn, resResubmit, resPhoto, resEditFull
 * حالات البحث في كوبو:
 *   من غير حالة  → مستني اعتماد
 *   on_hold      → مرجّع للباحث للتعديل (الملاحظة في تاب ملاحظات_الأبحاث)
 *   approved     → معتمد ومتكتب في ملف الأسرة
 *   not_approved → مرفوض
 */
var RV = {
  T_NOTES: 'ملاحظات_الأبحاث',
  NOTES_HDR: ['الوقت', 'رقم_البحث', 'رقم_الملف', 'النوع', 'الملاحظة', 'المستخدم'],
  HOLD: 'validation_status_on_hold',
  ADMIN: ['مدير النظام', 'إدارة']
};

/** خانات ملف الأسرة اللي البحث بيكتبها وقت الاعتماد (نفس اللي resDecide بيستخدمه) */
function resFields_(sub) {
  function g(k) { var v = sub[k]; return v == null ? '' : String(v).trim(); }
  var inc = function (k) { return Number(g('g_income/inc_' + k)) || 0; };
  var addr = [g('g_house/access'), g('g_house/addr_building'), g('g_house/addr_road'), g('g_house/addr_block'), g('g_house/addr_area')].filter(String).join(' — ');
  var loc = g('g_house/location').split(' '), locS = loc.length >= 2 && Number(loc[0]) ? 'https://maps.google.com/?q=' + loc[0] + ',' + loc[1] : g('g_house/map_link');
  var job = g('g_family/job') === 'other' ? g('g_family/job_other') : lab_('job', g('g_family/job'));
  var st = { active: 'نشط', wait: 'انتظار', excluded: 'مستبعد' }[g('g_result/file_status')] || lab_('fstatus', g('g_result/file_status'));
  var rg = g('g_file/region'), zn = g('g_file/zone'), bs = g('g_house/bstate');
  var apl = lab_('appliances', g('g_house/appliances')), aplO = g('g_house/appliances_other');
  var oblig = ' ' + g('g_income/oblig') + ' ';
  var F = {
    'اسم_رب_الأسرة': g('g_family/name'), 'الرقم_القومي': g('g_family/nid') ? "'" + g('g_family/nid') : '', 'الهاتف': g('g_family/phone') ? "'" + g('g_family/phone') : '',
    'هاتف_بديل': g('g_family/alt_phone') ? "'" + g('g_family/alt_phone') : '', 'صاحب_الهاتف_البديل': g('g_family/alt_owner'), 'عمل_رب_الأسرة': job,
    'الجنس': lab_('gender', g('g_family/gender')), 'الحالة_الاجتماعية': lab_('marital', g('g_family/marital')), 'الحالة_الصحية': lab_('health', g('g_family/health')),
    'نوع_المرض': lab_('disease', g('g_family/disease')), 'وصف_الحالة_الصحية': g('g_family/hdesc'),
    'عدد_الأفراد': g('g_family/members'), 'عدد_الأطفال': g('g_family/kids'), 'طلاب_المدارس': g('g_family/school'), 'طلاب_الجامعة': g('g_family/uni'), 'عدد_المرضى': g('g_family/sick_n'),
    'المنطقة': rg ? regionName_(rg).replace(/\s*\(\d\)/, '') : '', 'منطقة_التوزيع': zn ? zoneName_(zn) : '',
    'العنوان_الوصفي': normAddr_(addr), 'الشارع_الحارة': normAddr_(g('g_house/street')), 'علامة_مميزة': normAddr_(g('g_house/landmark')), 'اللوكيشن': locS,
    'نوع_السكن': lab_('house', g('g_house/house')), 'قيمة_الإيجار': g('g_house/rent'), 'عدد_الغرف': g('g_house/rooms'), 'حالة_المبنى': bs ? bstateName_(bs) : '',
    'السقف': lab_('roof', g('g_house/roof')), 'الحوائط': lab_('walls', g('g_house/walls')), 'المرافق': lab_('utilities', g('g_house/utilities')),
    'كماليات_السكن': [apl, aplO].filter(String).join(' — '),
    'راتب_معاش': inc('salary') || '', 'تأمينات': inc('insur') || '', 'مساعدات_الشئون': inc('shoun') || '', 'حياة_كريمة': inc('karima') || '', 'أيتام_أرامل': inc('orphan') || '',
    'نفقة': inc('nafaqa') || '', 'تكافل_وكرامة': inc('takaful') || '', 'دخل_آخر': (inc('daily') + inc('relatives') + inc('other')) || '',
    'مجموع_الإيرادات': g('g_income/inc_total'), 'مجموع_الالتزامات': g('g_income/obl_total'), 'صافي_الدخل': g('g_income/net'),
    'أصول': [lab_('assets', g('g_income/assets')), g('g_income/assets_desc')].filter(String).join(' — '),
    'التصنيف': lab_('grade', g('g_result/grade')), 'حالة_الملف': st, 'مصدر_الترشيح': lab_('referral', g('g_file/referral')), 'اسم_المرشح': g('g_file/referrer'),
    'رقم_ملف_قريب_مسجل': relativesText_(sub), 'تاريخ_آخر_بحث': g('g_file/research_date'), 'موعد_البحث_القادم': g('g_result/next_research'), 'تاريخ_آخر_تحديث': fmt_(now_(), 'yyyy-MM-dd'),
    // أعمدة إضافية — بتتكتب بس لو العمود موجود في تاب الأسر (addFamilyColumns)
    'عدد_الأيتام': orphansFromKobo_(sub), 'علاج_شهري': oblig.indexOf(' meds ') >= 0 ? 'نعم' : 'لا',
    'مرفقات_أخرى': attachmentsList_(sub).length || ''
  };
  if (F['عدد_الأيتام'] === null || F['عدد_الأيتام'] === undefined) F['عدد_الأيتام'] = '';
  return F;
}

/** كود التقييم الإلكتروني لكل بحث في القايمة — من غير ما يوقّع القايمة لو حصل خطأ */
function scSafe_(r) {
  try { return typeof scoreKobo_ === 'function' ? scoreKobo_(r) : null; } catch (e) { return null; }
}

function rvNotesSheet_() {
  var ss = ss_(), sh = ss.getSheetByName(RV.T_NOTES);
  if (!sh) { sh = ss.insertSheet(RV.T_NOTES); sh.appendRow(RV.NOTES_HDR); sh.setFrozenRows(1); sh.setRightToLeft(true); sh.getRange(1, 1, 1, RV.NOTES_HDR.length).setFontWeight('bold'); }
  return sh;
}
/** آخر ملاحظة إرجاع لكل بحث: { id: 'نص — مين — امتى' } */
function resNotes_() {
  var sh = ss_().getSheetByName(RV.T_NOTES), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
    if (String(r[3]) !== 'إرجاع للتعديل') { if (String(r[3]) === 'رجع للمراجعة') delete out[String(r[1])]; return; }
    out[String(r[1])] = String(r[4]) + ' — ' + String(r[5]) + (r[0] instanceof Date ? ' — ' + fmt_(r[0], 'dd/MM') : '');
  });
  return out;
}
function rvNote_(id, fn, type, note, user) {
  rvNotesSheet_().appendRow([now_(), 'K' + id, fn ? "'" + fn : '', type, String(note || ''), user]);
}
function rvSub_(id) { return kobo_('/api/v2/assets/' + KOBO_ASSET + '/data/' + Number(id) + '/?format=json'); }
function rvStatus_(sub) { return (sub._validation_status && sub._validation_status.uid) || ''; }
function rvAdmin_(u) { return RV.ADMIN.indexOf(u.role) >= 0; }

/** البحث كامل + ملخص اللي هيتغيّر في ملف الأسرة لو اتعتمد */
function resGet(pin, id) {
  var u = resUser_(pin), sub = rvSub_(id), vs = rvStatus_(sub);
  var F = resFields_(sub), fn = String(sub['g_file/fn'] || '').replace(/\D/g, '');
  var t = table_('الأسر'), I = t.idx, ri = -1;
  for (var i = 0; fn && i < t.rows.length; i++) if (String(t.rows[i][I['رقم_الملف']]).trim() === fn) { ri = i; break; }
  var changes = [], fam = null, mem = null;
  if (ri >= 0) {
    var r = t.rows[ri];
    fam = { fn: fn, name: String(r[I['اسم_رب_الأسرة']] || ''), status: 'حالة_الملف' in I ? String(r[I['حالة_الملف']] || '') : '' };
    Object.keys(F).forEach(function (k) {
      if (!(k in I) || F[k] === '' || k === 'تاريخ_آخر_تحديث' || k === 'تاريخ_آخر_بحث') return;
      var ov = r[I[k]], old = ov instanceof Date ? fmt_(ov, 'yyyy-MM-dd') : String(ov == null ? '' : ov).replace(/^'/, '').trim(), nv = String(F[k]).replace(/^'/, '').trim();
      if (old === nv || (old !== '' && !isNaN(old) && Number(old) === Number(nv))) return;
      changes.push({ k: k, old: old, nv: nv });
    });
    // أفراد الأسرة: القديم من الشيت والجديد من البحث (البحث الجديد بيحل محل القديم وقت الاعتماد)
    var ms = sub['members_r'] || [];
    if (ms.length && ss_().getSheetByName('أفراد_الأسرة')) {
      var M = table_('أفراد_الأسرة'), MI = M.idx, cN = MI['الاسم'] != null ? MI['الاسم'] : 2;
      var oldN = M.rows.filter(function (x) { return String(x[MI['رقم_الملف']]).trim() === fn; }).map(function (x) { return String(x[cN]).trim(); });
      var newN = ms.map(function (m) { return String(m['members_r/m_name'] || '').trim(); });
      mem = { old: oldN, nv: newN, add: newN.filter(function (n) { return oldN.indexOf(n) < 0; }), del: oldN.filter(function (n) { return newN.indexOf(n) < 0; }) };
    }
  }
  var notes = [], sh = ss_().getSheetByName(RV.T_NOTES);
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (x) {
    if (String(x[1]) === 'K' + id) notes.push({ dt: x[0] instanceof Date ? fmt_(x[0], 'dd/MM/yyyy hh:mm a') : String(x[0]), type: String(x[3]), note: String(x[4]), by: String(x[5]) });
  });
  var clean = {};
  Object.keys(sub).forEach(function (k) { if (k.charAt(0) !== '_' && !/^(formhub|meta|__version__|start|end|deviceid)/.test(k)) clean[k] = sub[k]; });
  return {
    id: Number(id), sub: clean, vs: vs, isNew: ri < 0, fam: fam, changes: changes, members: mem, notes: notes,
    att: (sub._attachments || []).length, iid: String(sub['meta/instanceID'] || ''), by: String(sub['g_file/researcher'] || sub._submitted_by || ''),
    sc: scSafe_(sub), canEdit: vs !== 'validation_status_approved' && (rvAdmin_(u) || vs === RV.HOLD), admin: rvAdmin_(u)
  };
}

/** تعديل خانات البحث في كوبو (الإدارة — أو الباحث لو البحث مرجّع له). data = { 'g_family/name': 'قيمة' } */
function resEdit(pin, id, data) {
  var u = resUser_(pin), sub = rvSub_(id), vs = rvStatus_(sub);
  if (vs === 'validation_status_approved') throw new Error('البحث ده معتمد ومتكتب في ملف الأسرة — عدّل من ملف الأسرة نفسه');
  if (!rvAdmin_(u) && vs !== RV.HOLD) throw new Error('الباحث يقدر يعدّل البحث بس لما الإدارة ترجّعه له');
  var clean = {}, log = [], now = now_(), fn = String(sub['g_file/fn'] || '');
  Object.keys(data || {}).forEach(function (k) {
    if (!/^g_(file|family|house|income|result)\/[a-z0-9_]+$/.test(k)) throw new Error('خانة مش مسموح تتعدل: ' + k);
    var nv = norm_(data[k] == null ? '' : data[k]), ov = sub[k] == null ? '' : String(sub[k]);
    if (nv === ov) return;
    clean[k] = nv; log.push([now, u.name + ' (تعديل بحث K' + id + ')', "'" + fn, k, "'" + ov, "'" + nv]);
  });
  if (!log.length) return { ok: true, n: 0 };
  kobo_('/api/v2/assets/' + KOBO_ASSET + '/data/bulk/', 'patch', { payload: { submission_ids: [Number(id)], data: clean } });
  var lg = ss_().getSheetByName('سجل_التعديلات');
  if (!lg) { lg = ss_().insertSheet('سجل_التعديلات'); lg.appendRow(['الوقت', 'المستخدم', 'رقم_الملف', 'الحقل', 'القيمة_القديمة', 'القيمة_الجديدة']); lg.setRightToLeft(true); }
  lg.getRange(lg.getLastRow() + 1, 1, log.length, 6).setValues(log);
  return { ok: true, n: log.length };
}

/** إرجاع البحث للباحث بملاحظة (الإدارة) */
function resReturn(pin, id, note) {
  var u = user_(pin, true);
  if (!rvAdmin_(u)) throw new Error('إرجاع الأبحاث للإدارة بس');
  note = String(note || '').trim(); if (!note) throw new Error('اكتب للباحث المطلوب يعدّل إيه');
  var sub = rvSub_(id);
  if (rvStatus_(sub) === 'validation_status_approved') throw new Error('البحث ده معتمد خلاص');
  kobo_('/api/v2/assets/' + KOBO_ASSET + '/data/' + Number(id) + '/validation_status/', 'patch', { 'validation_status.uid': RV.HOLD });
  var fn = String(sub['g_file/fn'] || ''), by = String(sub['g_file/researcher'] || sub._submitted_by || '');
  rvNote_(id, fn, 'إرجاع للتعديل', note, u.name);
  try { notify_('بحث مرجّع للتعديل', 'بحث ' + (fn ? 'ملف ' + fn : 'حالة جديدة') + ' اترجع للباحث ' + by + ': ' + note, u.name, id, false); } catch (e) {}
  if (typeof pushSafe_ === 'function') pushSafe_('↩ بحث مرجّع ليك للتعديل', (fn ? 'ملف ' + fn + ' — ' : '') + note, 'https://alansar-sharona.github.io/app/', 'name:' + by);
  return { ok: true };
}

/** الباحث خلّص التعديل ورجّع البحث للمراجعة */
function resResubmit(pin, id, note) {
  var u = resUser_(pin), sub = rvSub_(id);
  if (rvStatus_(sub) !== RV.HOLD) throw new Error('البحث ده مش مرجّع للتعديل');
  kobo_('/api/v2/assets/' + KOBO_ASSET + '/data/' + Number(id) + '/validation_status/', 'delete');
  var fn = String(sub['g_file/fn'] || '');
  rvNote_(id, fn, 'رجع للمراجعة', note || '', u.name);
  try { notify_('بحث رجع للمراجعة', 'بحث ' + (fn ? 'ملف ' + fn : 'حالة جديدة') + ' اتعدّل ورجع للاعتماد' + (note ? ': ' + note : ''), u.name, id, true); } catch (e) {}
  return { ok: true };
}

/* ---------------- صور البحث جوه المنصة ---------------- */
function rvAttach_(sub, name) {
  name = String(name || '').split('/').pop();
  var A = sub._attachments || [];
  for (var i = 0; i < A.length; i++) {
    var fnm = String(A[i].media_file_basename || A[i].filename || '').split('/').pop();
    if (fnm === name) return A[i];
  }
  return null;
}
function rvFetchAtt_(a, size) {
  var tok = PropertiesService.getScriptProperties().getProperty('KOBO_TOKEN');
  var url = (size && a['download_' + size + '_url']) || a.download_url;
  var r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Token ' + tok }, muteHttpExceptions: true, followRedirects: true });
  if (r.getResponseCode() >= 300) throw new Error('مش قادر أجيب الصورة من كوبو (' + r.getResponseCode() + ')');
  return r.getBlob();
}
/** صورة من صور البحث (للإدارة والباحثين) — size: small | medium | large | '' للأصلية */
function resPhoto(pin, id, name, size) {
  resUser_(pin);
  var sub = rvSub_(id), a = rvAttach_(sub, name);
  if (!a) throw new Error('الصورة مش موجودة في البحث');
  var b = rvFetchAtt_(a, size === undefined ? 'medium' : size);
  return { name: String(name), mime: b.getContentType() || a.mimetype || 'image/jpeg', b64: Utilities.base64Encode(b.getBytes()) };
}

/* ---------------- تعديل البحث كامل بنفس الاستمارة ----------------
 * بيبعت البحث لكوبو كتعديل على نفس البحث (deprecatedID) — نفس رقم البحث، وبيحتفظ بالصور القديمة اللي ما اتغيرتش */
function resEditFull(pin, id, tree, files, meta) {
  var u = resUser_(pin), sub = rvSub_(id), vs = rvStatus_(sub), admin = rvAdmin_(u);
  if (vs === 'validation_status_approved') throw new Error('البحث ده معتمد ومتكتب في ملف الأسرة — عدّل من ملف الأسرة نفسه');
  if (!admin && vs !== RV.HOLD) throw new Error('الباحث يقدر يعدّل البحث بس لما الإدارة ترجّعه له');
  var oldIid = String(sub['meta/instanceID'] || '');
  if (!oldIid) throw new Error('البحث ده مالوش رقم في كوبو — مينفعش يتعدّل من المنصة');
  var tok = PropertiesService.getScriptProperties().getProperty('KOBO_TOKEN');
  var a = kobo_('/api/v2/assets/' + KOBO_ASSET + '/?format=json'), now = now_(), iso = Utilities.formatDate(now, TZ, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
  var uuid = (meta && /^[0-9a-f-]{36}$/.test(meta.uuid || '')) ? meta.uuid : Utilities.getUuid();
  var head = { start: sub.start || iso, end: iso, today: fmt_(now, 'yyyy-MM-dd'), deviceid: 'platform:' + u.name, username: u.name };
  var xml = '<?xml version="1.0" ?><' + KOBO_ASSET + ' id="' + KOBO_ASSET + '">' + toXml_(head) + toXml_(tree || {}) +
            '<__version__>' + a.deployed_version_id + '</__version__><meta><instanceID>uuid:' + uuid + '</instanceID><deprecatedID>' + xmlEsc_(oldIid) + '</deprecatedID></meta></' + KOBO_ASSET + '>';
  var payload = { xml_submission_file: Utilities.newBlob(xml, 'text/xml', 'submission.xml') }, sent = {};
  (files || []).forEach(function (f) { if (f && f.name && f.b64) { payload[f.name] = Utilities.newBlob(Utilities.base64Decode(f.b64), f.mime || 'image/jpeg', f.name); sent[f.name] = 1; } });
  // الصور القديمة اللي لسه متسجلة في البحث بتتبعت تاني عشان ما تضيعش
  var keep = 0;
  xml.replace(/>([^<>]+\.(?:jpe?g|png|webp|heic))</gi, function (m, nm) {
    if (sent[nm]) return m;
    var at = rvAttach_(sub, nm);
    if (at) { try { var b = rvFetchAtt_(at, ''); payload[nm] = b.setName(nm); sent[nm] = 1; keep++; } catch (e) {} }
    return m;
  });
  var r = UrlFetchApp.fetch('https://kc.kobotoolbox.org/submission', { method: 'post', muteHttpExceptions: true, headers: { Authorization: 'Token ' + tok, 'X-OpenRosa-Version': '1.0' }, payload: payload });
  if (r.getResponseCode() >= 300) throw new Error('كوبو رفض التعديل (' + r.getResponseCode() + ') — حاول تاني');
  var lg = ss_().getSheetByName('سجل_التعديلات');
  if (!lg) { lg = ss_().insertSheet('سجل_التعديلات'); lg.appendRow(['الوقت', 'المستخدم', 'رقم_الملف', 'الحقل', 'القيمة_القديمة', 'القيمة_الجديدة']); lg.setRightToLeft(true); }
  lg.appendRow([now, u.name + ' (تعديل بحث K' + id + ')', "'" + String(sub['g_file/fn'] || ''), 'تعديل البحث كامل من المنصة', "'" + oldIid, "'uuid:" + uuid]);
  return { ok: true, id: Number(id), kept: keep, by: u.name };
}

/** إعداد مرة واحدة لكل الأجزاء الجديدة (أ، ب، ج، د، هـ) — بيتشغّل من المحرر (Run) */
function setupAllNew() {
  var log = [];
  function step(name, fn) { try { log.push(name + ': ' + (fn() || 'تم')); } catch (e) { log.push(name + ': ✖ ' + e.message); } }
  step('الإشعارات وساعدني', setupHelpNotif);
  step('الصفحة العامة', setupPublic);
  step('المناطق الجديدة', setupRegionsLists);
  step('أعمدة الأيتام والعلاج والمرفقات', addFamilyColumns);
  step('إعدادات التقييم', setupScoring);
  step('ملاحظات الأبحاث', function () { rvNotesSheet_(); return 'تم'; });
  if (typeof setupPush === 'function') step('إشعارات الموبايل', setupPush);
  Logger.log(log.join('\n'));
  return log.join('\n');
}
