/**
 * منصة الأنصار — الجزء (د): مصفوفة التقييم الإلكتروني
 * ملف جديد (D_Scoring.gs). بيعتمد على ملف A (nxSheet_, nxRows_, nxUser_) وملف C (koboFlat_).
 * التفعيل مقفول من تاب «إعدادات_التقييم» لحد موافقة أحمد واللجنة.
 * دوال لـ doPost: scoreCfg
 * داخلية: scoreKobo_(sub) — تتنادى من researches · setupScoring() · scoreCalibrate()
 * ⚠️ دالة ansarScore هنا نسخة طبق الأصل من اللي في app/index.html — أي تعديل في المنطق يتعمل في الاتنين.
 */
/* ===== مصفوفة التقييم الإلكتروني — نفس الكود في المنصة (app/index.html) والسيرفر (D_Scoring.gs) ===== */
var SC_DEFAULTS={
  income_t1:500,income_t2:1000,income_t3:1500,income_p1:15,income_p2:10,income_p3:4,income_max:15,
  head_widow:14,head_sick:11,head_nojob:11,head_daily:7,head_employee:0,head_max:14,
  orphan_each:3,orphan_max:9,
  sick_chronic:3,sick_disab:4,sick_meds:3,sick_max:12,
  edu_each:1,edu_max:5,
  house_none:6,house_rent:5,house_family:3,house_own:0,
  b_collapse:10,b_poor:7,b_mid:3,roof_palm:5,roof_wood:3,walls_mud:3,b_max:18,
  util_each:3,util_max:12,
  app_each:2,app_max:6,
  debt:3,
  asset_each:-10,asset_min:-10,
  grade_a:80,grade_b:60,grade_c:40
};
/**
 * f: خانات البحث بأسماء كوبو (members, marital, job, health, disease, house, bstate, roof, walls, utilities, appliances,
 *    oblig, assets, inc_total أو inc_*, obl_*, school, uni, members_r: [{m_rel,m_age,m_edu,m_health}]).
 *    القيمة undefined = مش معروف (مش بتاخد نقط).
 * W: الأوزان (اللي مش موجود بياخد من SC_DEFAULTS).
 * بيرجّع: {score 0–100, grade أ/ب/ج/د, parts:[{k,label,pts}], reasons: أكتر 3 أسباب}
 */
function ansarScore(f,W){
  W=W||{};var w=function(k){var v=W[k];return v===undefined||v===null||v===''||isNaN(Number(v))?SC_DEFAULTS[k]:Number(v)};
  var num=function(x){x=Number(x);return isNaN(x)?0:x},has=function(list,k){return (' '+String(list||'')+' ').indexOf(' '+k+' ')>=0};
  var cap=function(v,mx){return Math.max(0,Math.min(v,mx))},P=[];
  var add=function(k,label,pts){if(pts)P.push({k:k,label:label,pts:Math.round(pts*10)/10})};
  var M=f.members_r||[],n=Math.max(1,num(f.members)||1+M.length);
  // 1) دخل الفرد
  var incKeys=['inc_salary','inc_insur','inc_shoun','inc_karima','inc_orphan','inc_nafaqa','inc_takaful','inc_daily','inc_relatives','inc_other'],oblKeys=['obl_rent','obl_build','obl_treat','obl_study','obl_gameya','obl_meds','obl_debt'];
  var inc=f.inc_total!==undefined&&f.inc_total!==''?num(f.inc_total):incKeys.reduce(function(s,k){return s+num(f[k])},0);
  var obl=f.obl_total!==undefined&&f.obl_total!==''?num(f.obl_total):oblKeys.reduce(function(s,k){return s+num(f[k])},0);
  var net=f.net!==undefined&&f.net!==''?num(f.net):inc-obl;
  if(f.income!==undefined||f.net!==undefined||f.inc_total!==undefined){var pc=Math.max(0,net)/n,ip=pc<w('income_t1')?w('income_p1'):pc<w('income_t2')?w('income_p2'):pc<w('income_t3')?w('income_p3'):0;
    add('income','دخل الفرد حوالي '+Math.round(pc)+' ج في الشهر',cap(ip,w('income_max')))}
  // 2) العائل
  var hp=null,hl='';
  if(f.marital==='widow'||f.marital==='divorced'){hp=w('head_widow');hl=f.marital==='widow'?'رب الأسرة أرمل/أرملة':'رب الأسرة مطلق/مطلقة'}
  else if(f.health==='sick'){hp=w('head_sick');hl='العائل مريض'+(f.disease==='disability'?' (إعاقة)':'')}
  else if(f.job==='none'||f.job==='housewife'){hp=w('head_nojob');hl='رب الأسرة لا يعمل'}
  else if(f.job==='daily'||f.job==='farmer'||f.job==='craft'||f.job==='other'){hp=w('head_daily');hl='شغل يومية / فلاحة'}
  else if(f.job==='employee'||f.job==='pension'){hp=w('head_employee');hl='موظف / معاش'}
  if(hp)add('head',hl,cap(hp,w('head_max')));
  // 3) الأيتام: الأسرة اللي رب الأسرة فيها أرمل/أرملة — العيال تحت 18
  var orph=0;if(f.marital==='widow'){orph=M.filter(function(m){var kid=['son','daughter','grandchild'].indexOf(m.m_rel)>=0,a=Number(m.m_age);return kid&&(m.m_age!==undefined&&m.m_age!==''&&!isNaN(a)?a<18:['kg','primary','prep','secondary'].indexOf(m.m_edu)>=0)}).length;
    if(!M.length&&f.kids!==undefined)orph=num(f.kids)}
  if(orph)add('orphans',orph===1?'يتيم واحد':orph+' أيتام',cap(orph*w('orphan_each'),w('orphan_max')));
  // 4) المرض
  var chron=(f.health==='sick'&&f.disease==='chronic'?1:0)+M.filter(function(m){return m.m_health==='chronic'}).length;
  var dis=(f.health==='sick'&&f.disease==='disability'?1:0)+M.filter(function(m){return m.m_health==='disability'}).length;
  var meds=has(f.oblig,'meds');
  var sp=chron*w('sick_chronic')+dis*w('sick_disab')+(meds?w('sick_meds'):0);
  if(sp)add('sick',[chron?chron+' مرض مزمن':'',dis?dis+' إعاقة':'',meds?'علاج شهري مستمر':''].filter(String).join(' + '),cap(sp,w('sick_max')));
  // 5) التعليم
  var st=M.filter(function(m){return ['kg','primary','prep','secondary','uni'].indexOf(m.m_edu)>=0}).length;
  st=Math.max(st,num(f.school)+num(f.uni));
  if(st)add('edu',st+' بيدرسوا',cap(st*w('edu_each'),w('edu_max')));
  // 6) حيازة السكن
  var hs={none:w('house_none'),rent:w('house_rent'),family:w('house_family'),own:w('house_own')}[f.house];
  if(hs)add('house',{none:'من غير سكن',rent:'سكن إيجار',family:'ساكن مع العيلة'}[f.house]||'',hs);
  // 7) حالة المبنى
  var bp=({bad:w('b_collapse'),poor:w('b_poor'),mid:w('b_mid')}[f.bstate]||0)+(f.roof==='palm'?w('roof_palm'):f.roof==='wood'?w('roof_wood'):0)+(f.walls==='mud'?w('walls_mud'):0);
  if(bp)add('building',[{bad:'مبنى آيل للسقوط',poor:'مبنى رديء',mid:'مبنى متوسط'}[f.bstate],f.roof==='palm'?'سقف جريد':f.roof==='wood'?'سقف خشب':'',f.walls==='mud'?'طوب ني':''].filter(Boolean).join(' + '),cap(bp,w('b_max')));
  // 8) المرافق الناقصة
  if(f.utilities!==undefined){var um=['water','elec','sewage','gas'].filter(function(u){return !has(f.utilities,u)}),un={water:'مياه',elec:'كهرباء',sewage:'صرف',gas:'غاز'};
    if(um.length)add('util','ناقص '+um.map(function(u){return un[u]}).join(' و'),cap(um.length*w('util_each'),w('util_max')))}
  // 9) الأجهزة الأساسية الناقصة
  if(f.appliances!==undefined){var am=['fridge','washer','stove'].filter(function(u){return !has(f.appliances,u)}),an={fridge:'ثلاجة',washer:'غسالة',stove:'بوتاجاز'};
    if(am.length)add('app','ناقص '+am.map(function(u){return an[u]}).join(' و'),cap(am.length*w('app_each'),w('app_max')))}
  // 10) الديون
  if(has(f.oblig,'debt')||has(f.oblig,'treat'))add('debt','ديون أو قسط علاج',w('debt'));
  // 11) الأصول (خصم)
  var as=['land','livestock','shop'].filter(function(a){return has(f.assets,a)}).length;
  if(as)add('assets','عنده أصول (أرض / مواشي / محل)',Math.max(as*w('asset_each'),w('asset_min')));
  var score=Math.max(0,Math.min(100,Math.round(P.reduce(function(s,p){return s+p.pts},0))));
  var grade=score>=w('grade_a')?'أ':score>=w('grade_b')?'ب':score>=w('grade_c')?'ج':'د';
  var reasons=P.filter(function(p){return p.pts>0}).sort(function(a,b){return b.pts-a.pts}).slice(0,3).map(function(p){return p.label+' (+'+p.pts+')'});
  return {score:score,grade:grade,parts:P,reasons:reasons}
}
var SC_ORDER=['أ','ب','ج','د'];
function scoreGap(a,b){var x=SC_ORDER.indexOf(a),y=SC_ORDER.indexOf(b);return x<0||y<0?0:Math.abs(x-y)}

/* ---------- السيرفر ---------- */
var SC_TAB = 'إعدادات_التقييم';
var SC_FLAGS = [
  ['مفعّل_للباحثين', 'لا', 'نعم = الباحث يشوف الكود المقترح وهو بيملا البحث. تفضل «لا» لحد موافقة أحمد واللجنة'],
  ['يظهر_في_المراجعة', 'لا', 'نعم = كود النظام يظهر جنب كود الباحث في مراجعة الأبحاث للإدارة'],
  ['تجربة_لمدير_النظام', 'نعم', 'نعم = مدير النظام بس يشوفه (مكتوب عليه تجربة) حتى لو الاتنين اللي فوق «لا»']
];
var SC_DESC = {
  income_t1: 'دخل الفرد — الحد الأول (جنيه)', income_t2: 'دخل الفرد — الحد التاني', income_t3: 'دخل الفرد — الحد التالت',
  income_p1: 'نقط لو أقل من الحد الأول', income_p2: 'نقط لو بين الحد الأول والتاني', income_p3: 'نقط لو بين التاني والتالت', income_max: 'أقصى نقط للدخل',
  head_widow: 'العائل: مفيش عائل / أرملة / مطلقة', head_sick: 'العائل مريض أو بإعاقة', head_nojob: 'العائل لا يعمل', head_daily: 'يومية / فلاح', head_employee: 'موظف / معاش', head_max: 'أقصى نقط للعائل',
  orphan_each: 'لكل يتيم', orphan_max: 'أقصى نقط للأيتام',
  sick_chronic: 'لكل فرد مرض مزمن', sick_disab: 'لكل فرد إعاقة', sick_meds: 'علاج شهري مستمر', sick_max: 'أقصى نقط للمرض',
  edu_each: 'لكل فرد بيدرس', edu_max: 'أقصى نقط للتعليم',
  house_none: 'سكن: بدون', house_rent: 'سكن: إيجار', house_family: 'سكن: مع العائلة', house_own: 'سكن: تمليك',
  b_collapse: 'مبنى آيل للسقوط', b_poor: 'مبنى رديء', b_mid: 'مبنى متوسط', roof_palm: 'سقف جريد (+)', roof_wood: 'سقف خشب (+)', walls_mud: 'طوب ني (+)', b_max: 'أقصى نقط للمبنى',
  util_each: 'لكل مرفق ناقص (مياه، كهرباء، صرف، غاز)', util_max: 'أقصى نقط للمرافق',
  app_each: 'لكل جهاز ناقص (ثلاجة، غسالة، بوتاجاز)', app_max: 'أقصى نقط للأجهزة',
  debt: 'ديون أو قسط علاج', asset_each: 'خصم لكل أصل (أرض / مواشي / محل)', asset_min: 'أقصى خصم للأصول',
  grade_a: 'أقل درجة لكود أ', grade_b: 'أقل درجة لكود ب', grade_c: 'أقل درجة لكود ج (أقل من كده = د)'
};
function scRead_() {
  var t = nxRows_(nxSheet_(SC_TAB)), o = {};
  t.rows.forEach(function (r) { if (r[0] !== '') o[String(r[0]).trim()] = r[1]; });
  return o;
}
/** المنصة بتناديها بعد الدخول: الأوزان + حالة التفعيل */
function scoreCfg(pin) {
  nxUser_(pin);
  var o = scRead_(), w = {};
  Object.keys(SC_DEFAULTS).forEach(function (k) { if (o[k] !== undefined && o[k] !== '') w[k] = Number(o[k]); });
  return { on: pbYes2_(o['مفعّل_للباحثين']), review: pbYes2_(o['يظهر_في_المراجعة']), test: pbYes2_(o['تجربة_لمدير_النظام']), w: w };
}
function pbYes2_(v) { return /^(نعم|yes|true|1)$/i.test(String(v == null ? '' : v).trim()); }
/** للمراجعة: جوه دالة researches، لكل بحث زوّد: item.sc = scoreKobo_(sub); item.grade = (koboFlat_(sub).grade) */
function scoreKobo_(sub, cfg) {
  cfg = cfg || scoreCfgCached_();
  var f = koboFlat_(sub);
  ['utilities', 'appliances', 'income', 'oblig', 'assets'].forEach(function (k) { if (f[k] === undefined) f[k] = ''; });
  var r = ansarScore(f, cfg.w);
  return { score: r.score, grade: r.grade, reasons: r.reasons };
}
function scoreCfgCached_() {
  var o = scRead_(), w = {};
  Object.keys(SC_DEFAULTS).forEach(function (k) { if (o[k] !== undefined && o[k] !== '') w[k] = Number(o[k]); });
  return { w: w };
}
/** إعداد مرة واحدة: تاب إعدادات_التقييم بالأوزان المكتوبة في وثيقة التسليم، والتفعيل مقفول */
function setupScoring() {
  var sh = nxSheet_(SC_TAB, ['المفتاح', 'القيمة', 'الوصف']);
  if (sh.getLastRow() > 1) return 'التاب موجود — ما اتغيرش حاجة';
  var rows = SC_FLAGS.slice();
  Object.keys(SC_DEFAULTS).forEach(function (k) { rows.push([k, SC_DEFAULTS[k], SC_DESC[k] || '']); });
  sh.getRange(2, 1, rows.length, 3).setValues(rows);
  sh.getRange(2, 2, 3, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['نعم', 'لا']).build());
  sh.setColumnWidth(1, 170); sh.setColumnWidth(3, 420);
  return 'تم: إعدادات_التقييم (التفعيل للباحثين = لا)';
}
/**
 * المعايرة: بتطبّق الحساب على الأبحاث المعتمدة في كوبو وتقارنها بتقدير الباحث، وتكتب النتيجة في تاب «معايرة_التقييم» من غير أسماء.
 * شغّلها من المحرر بعد ما يبقى فيه أبحاث كاملة كفاية (30 على الأقل).
 */
function scoreCalibrate() {
  var tok = PropertiesService.getScriptProperties().getProperty(NX.KOBO_TOKEN_PROP);
  if (!tok) throw new Error('مفتاح كوبو مش موجود في Script Properties باسم ' + NX.KOBO_TOKEN_PROP);
  var url = NX.KOBO_BASE + '/api/v2/assets/' + NX.KOBO_ASSET + '/data/?format=json&limit=1000&query=' + encodeURIComponent('{"_validation_status.uid":"validation_status_approved"}');
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Token ' + tok }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('كوبو رجّع ' + res.getResponseCode());
  var L = JSON.parse(res.getContentText()).results || [], cfg = scoreCfgCached_(), map = { A: 'أ', B: 'ب', C: 'ج', D: 'د' };
  var out = [], agree = 0, near = 0;
  L.forEach(function (s, i) {
    var f = koboFlat_(s), g = map[f.grade] || f.grade || '', r = scoreKobo_(s, cfg), gap = scoreGap(g, r.grade);
    if (g === r.grade) agree++; if (gap <= 1) near++;
    out.push([i + 1, g, r.grade, r.score, gap, r.reasons.join(' · ')]);
  });
  var sh = nxSheet_('معايرة_التقييم', ['م', 'كود_الباحث', 'كود_النظام', 'الدرجة', 'الفرق', 'أكتر_الأسباب']);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
  if (out.length) sh.getRange(2, 1, out.length, 6).setValues(out);
  var msg = 'أبحاث: ' + L.length + ' — اتفاق تام: ' + (L.length ? Math.round(100 * agree / L.length) : 0) + '% — في حدود كود واحد: ' + (L.length ? Math.round(100 * near / L.length) : 0) + '%';
  sh.getRange(1, 8).setValue(msg + ' — ' + nxFmt_(new Date()));
  return msg;
}
