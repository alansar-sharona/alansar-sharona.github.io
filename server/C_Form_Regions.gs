/**
 * منصة الأنصار — الجزء (ج): المناطق الجديدة + تعديلات استمارة البحث + بيانات الفرز والطباعة
 * ملف جديد (C_Form_Regions.gs). بيعتمد على أدوات ملف A (nxSheet_, nxRows_, nxCol_).
 * ده ملف مساعد: فيه الجداول والدوال اللي السيرفر الحالي محتاج يناديها في 3 أماكن (التفاصيل في server/README.md).
 */

/* المناطق: كود كوبو ← [الاسم في الشيت، أول رقم في رقم الملف] */
var REGIONS = {
  bahary: ['بحري', 1], qebly: ['قبلي', 2], sharq: ['شرق', 3], wast: ['وسط', 4],
  oqda: ['العقدة', 5], salam: ['عزبة السلام', 6]
};
/* منطقة التوزيع: كود كوبو ← الاسم في الشيت */
var ZONES = { bahary: 'بحري', qebly: 'قبلي', sharq_b: 'شرق ب', sharq_q: 'شرق ق', wast: 'وسط', oqda: 'العقدة', salam: 'عزبة السلام' };
/* حالة المبنى: كود كوبو ← القيمة في الشيت (آيل = آيل للسقوط، زي ما هو في القوائم) */
var BSTATE = { good: 'جيد', mid: 'متوسط', poor: 'رديء', bad: 'آيل' };

/** أول رقم في رقم الملف من اسم المنطقة أو كودها (للـ resNextFn) */
function regionPrefix_(r) {
  r = String(r || '').trim();
  if (REGIONS[r]) return REGIONS[r][1];
  for (var k in REGIONS) if (REGIONS[k][0] === r) return REGIONS[k][1];
  return null;
}
function regionName_(code) { return REGIONS[code] ? REGIONS[code][0] : String(code || ''); }
function zoneName_(code) { return ZONES[code] || String(code || ''); }
function bstateName_(code) { return BSTATE[code] || String(code || ''); }

/** يحوّل بحث كوبو (JSON) لأسماء خانات من غير اسم الجروب: 'g_family/members' → members */
function koboFlat_(sub) {
  var o = {};
  Object.keys(sub || {}).forEach(function (k) {
    var v = sub[k], n = k.split('/').pop();
    if (k.charAt(0) === '_') { o[n] = v; return; }          // _geolocation و_attachments وغيرهم — مش صفوف أسئلة
    if (Array.isArray(v)) o[n] = v.map(function (row) { var r = {}; if (row && typeof row === 'object') Object.keys(row).forEach(function (kk) { r[kk.split('/').pop()] = row[kk]; }); return r; });
    else o[n] = v;
  });
  return o;
}

/** الأقارب اللي ليهم أبحاث → نص لعمود «رقم_ملف_قريب_مسجل»: «20030 (أخ)، 21034 (عم)» */
function relativesText_(sub) {
  var f = koboFlat_(sub);
  if (f.relative !== 'yes') return '';
  if (Array.isArray(f.relatives_r) && f.relatives_r.length)
    return f.relatives_r.map(function (r) { return String(r.rel_id || '').trim() + (r.rel_rel ? ' (' + r.rel_rel + ')' : ''); }).filter(String).join('، ');
  return f.relative_fn ? String(f.relative_fn) + (f.relative_rel ? ' (' + f.relative_rel + ')' : '') : ''; // الأبحاث القديمة
}

/** خانات «أخرى» → نص يتكتب جنب القيمة: «أخرى: ...» */
function otherText_(sub) {
  var f = koboFlat_(sub), out = {};
  if (f.appliances_other) out['كماليات_السكن_أخرى'] = f.appliances_other;
  if (f.inc_other_desc) out['دخل_آخر_وصف'] = f.inc_other_desc;
  if (f.job_other) out['عمل_آخر'] = f.job_other;
  return out;
}

/** أسماء صور «مرفقات أخرى» (لحد 7) */
function attachmentsList_(sub) {
  var f = koboFlat_(sub), n = Math.min(7, Number(f.att_n) || 0), L = [];
  for (var i = 1; i <= n; i++) if (f['att_' + i]) L.push(f['att_' + i]);
  return L;
}

/** عدد الأيتام من البحث: لو رب الأسرة أرملة/أرمل، العيال (ابن/ابنة/حفيد) تحت 18 */
function orphansFromKobo_(sub) {
  var f = koboFlat_(sub);
  if (f.marital !== 'widow') return 0;
  return (f.members_r || []).filter(function (m) {
    var kid = ['son', 'daughter', 'grandchild'].indexOf(m.m_rel) >= 0, age = Number(m.m_age);
    return kid && (isNaN(age) || !m.m_age ? ['kg', 'primary', 'prep', 'secondary'].indexOf(m.m_edu) >= 0 : age < 18);
  }).length;
}

/**
 * بيانات إضافية لكل أسرة في printData (للفرز والطباعة).
 * f = صف الأسرة كـ object بأسماء الأعمدة (زي اللي famGet بيرجّعه).
 * بيرجّع: orph (عدد)، utm (المرافق الناقصة)، apm (الأجهزة الناقصة)، med (علاج شهري) — null لو مفيش بيانات.
 */
function famExtra_(f) {
  var out = { orph: null, utm: null, apm: null, med: null };
  // الأيتام: من عمود عدد_الأيتام لو موجود، وإلا من الحالة الاجتماعية + عدد الأطفال
  if (f['عدد_الأيتام'] !== undefined && f['عدد_الأيتام'] !== '') out.orph = Number(f['عدد_الأيتام']) || 0;
  else if (/ارمل/.test(String(f['الحالة_الاجتماعية'] || ''))) out.orph = Number(f['عدد_الأطفال']) || 0;
  else if (f['الحالة_الاجتماعية']) out.orph = 0;
  // المرافق: العمود فيه المتوفر — الناقص = الباقي
  var ut = String(f['المرافق'] || '').trim();
  if (ut) {
    var has = ut.split(/[،,]/).map(function (x) { return x.trim(); });
    out.utm = ['مياه', 'كهرباء', 'صرف صحي', 'غاز'].filter(function (u) { return has.indexOf(u) < 0; });
  }
  // الأجهزة: كماليات_السكن ممكن تكون قائمة أجهزة (من كوبو) أو وصف قديم (الاساسيات / بعض الاساسيات / لا يوجد)
  var ap = String(f['كماليات_السكن'] || '').trim();
  if (ap === 'لا يوجد') out.apm = ['ثلاجة', 'غسالة', 'بوتاجاز'];
  else if (ap === 'الاساسيات') out.apm = [];
  else if (ap && ap !== 'بعض الاساسيات') {
    var h2 = ap.split(/[،,]/).map(function (x) { return x.trim(); });
    out.apm = ['ثلاجة', 'غسالة', 'بوتاجاز'].filter(function (u) { return h2.indexOf(u) < 0; });
  }
  // العلاج الشهري: من عمود علاج_شهري لو موجود
  if (f['علاج_شهري'] !== undefined && f['علاج_شهري'] !== '') out.med = /^(نعم|✔|yes|true)$/i.test(String(f['علاج_شهري']).trim());
  // صف الأسرة كامل → فلاتر «أي خانة» في طباعة كشف (للإدارة بس، زي باقي printData)
  out.x = {};
  Object.keys(f).forEach(function (k) {
    var v = f[k];
    out.x[k] = v instanceof Date ? Utilities.formatDate(v, 'Africa/Cairo', 'yyyy-MM-dd') : (v == null ? '' : v);
  });
  return out;
}

/** إعداد مرة واحدة: يضيف المناطق الجديدة و«رديء» لتاب القوائم (من غير ما يمسح حاجة) */
function setupRegionsLists() {
  var sh = nxSheet_('القوائم'), hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), msgs = [];
  function add(col, vals) {
    var c = hdr.indexOf(col); if (c < 0) { msgs.push('مش لاقي عمود ' + col); return; }
    var v = sh.getRange(2, c + 1, Math.max(1, sh.getLastRow() - 1), 1).getValues().map(function (r) { return String(r[0]).trim(); });
    var last = v.filter(String).length;
    vals.forEach(function (x) { if (v.indexOf(x) < 0) { sh.getRange(2 + last, c + 1).setValue(x); last++; msgs.push(col + ' + ' + x); } });
  }
  add('المنطقة', ['العقدة', 'عزبة السلام']);
  add('منطقة_التوزيع', ['العقدة', 'عزبة السلام']);
  add('حالة_المبنى', ['رديء']);
  return msgs.join(' | ') || 'كل حاجة موجودة';
}

/** موافَق عليها من أحمد (22 نوفمبر): يضيف أعمدة جديدة في آخر تاب الأسر (عدد_الأيتام، علاج_شهري، مرفقات_أخرى). شغّلها بس لو كود السيرفر بيقرا الأعمدة بالاسم مش بالرقم. */
function addFamilyColumns() {
  var sh = nxSheet_('الأسر'), hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), added = [];
  ['عدد_الأيتام', 'علاج_شهري', 'مرفقات_أخرى'].forEach(function (h) {
    if (hdr.indexOf(h) < 0) { sh.getRange(1, sh.getLastColumn() + 1).setValue(h).setFontWeight('bold'); added.push(h); }
  });
  return added.length ? 'اتضاف: ' + added.join('، ') : 'الأعمدة موجودة';
}
