/**
 * LẮP ĐẶT PHỤ KIỆN – SAMCO Bình Tân · v1.0
 * Quy chuẩn web app SAMCO: giao diện trên GitHub Pages → Apps Script (API) → Google Sheet.
 *
 * Sheet:
 *   DANG_KY      mỗi phiếu 1 dòng, cột A = ID dạng PK-YYYYMMDD-NNN
 *   _DanhMuc     danh sách chọn + bảng đơn vị lắp đặt (Mã ĐV, Tên, Mã đăng nhập 6 số)
 *   _CauHinh     Khóa | Giá trị (phí, PIN, số phút nhắc)
 *   BC_YYYY-MM   báo cáo tháng (tạo khi bấm "Xuất ra Sheet")
 *
 * Lần đầu: chạy setup() → điền _CauHinh và _DanhMuc → chạy kiemTraCauHinh() → Triển khai.
 */

const TZ = 'Asia/Ho_Chi_Minh';
const SH = { DATA: 'DANG_KY', DM: '_DanhMuc', CFG: '_CauHinh' };

// Cột của DANG_KY: [khóa trong code, tiêu đề trên Sheet]. 3 cột cuối theo chuẩn.
const COLS = [
  ['id', 'ID'], ['unitId', 'Mã ĐV'], ['unitName', 'Tên đơn vị'],
  ['techName', 'Họ tên KTV'], ['techPhone', 'Điện thoại'], ['sale', 'Sale phụ trách'],
  ['model', 'Loại xe'], ['color', 'Màu'], ['vin', 'Số khung'],
  ['acc', 'Phụ kiện'], ['accN', 'Số PK'], ['fee', 'Phí (đ)'],
  ['expectedAt', 'Giờ đến'], ['note', 'Ghi chú'],
  ['status', 'Trạng thái'], ['inAt', 'Giờ vào'], ['outAt', 'Giờ ra'],
  ['idChecked', 'Đã kiểm tra CCCD'], ['by', 'Người xác nhận'],
  ['pay', 'Thanh toán'], ['paidAt', 'Thu lúc'], ['payNote', 'Ghi chú thu'],
  ['createdAt', 'Tạo lúc'], ['createdBy', 'Người tạo'], ['updatedAt', 'Cập nhật lúc'],
];
const TEXT_COLS = ['techPhone', 'createdBy']; // giữ số 0 ở đầu
const DATE_COLS = ['expectedAt', 'inAt', 'outAt', 'paidAt', 'createdAt', 'updatedAt'];

const ST = { WAIT: 'Chờ', RUN: 'Đang lắp', DONE: 'Hoàn tất', CANCEL: 'Đã hủy' };
const PAY = { NO: 'Chưa thu', YES: 'Đã thu' };

// Danh mục: tiêu đề cột trên _DanhMuc
const DM_COLS = ['Loại xe', 'Màu', 'Phụ kiện', 'Sale phụ trách', 'Mã ĐV', 'Tên đơn vị', 'Mã đăng nhập'];

/* =================================================================
 *  API — trang GitHub gọi POST {fn, args, dev} → {ok, data, error}
 * ================================================================= */
const API = {
  getConfig, unitList, submitRegistration, updateRegistration,
  adminLogin, adminList, adminAction, adminStats, exportMonth,
};
let DEV = ''; // mã ngẫu nhiên của từng trình duyệt, dùng để khóa dò mã

function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!Object.prototype.hasOwnProperty.call(API, req.fn)) throw 'Chức năng không tồn tại.';
    DEV = String(req.dev || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
    out = { ok: true, data: API[req.fn].apply(null, Array.isArray(req.args) ? req.args : []) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// Mở link /exec trên trình duyệt chỉ để kiểm tra API còn chạy
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: 'phukien', version: '1.0' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =================== ĐƠN VỊ LẮP ĐẶT =================== */

function getConfig() {
  const c = cfg_(), d = dm_();
  return { fee: c.fee, remindMin: c.remindMin, models: d.models, colors: d.colors, accessories: d.accessories, sales: d.sales };
  // Không trả danh sách đơn vị ra ngoài.
}

function unitList(code) {
  const u = unitAuth_(code);
  const rows = readTable(SH.DATA).filter(o => o.unitId === u.id && o.status !== ST.CANCEL)
    .sort((a, b) => time_(a.expectedAt) - time_(b.expectedAt));
  return { name: u.name, rows: rows.map(toClient_) };
}

function submitRegistration(code, form) {
  const u = unitAuth_(code);
  const d = cleanForm_(form);
  return withLock_(() => {
    const now = new Date(), fee = cfg_().fee;
    const o = Object.assign({}, d, {
      id: newId('PK'), unitId: u.id, unitName: u.name, fee: d.accN * fee,
      status: ST.WAIT, inAt: '', outAt: '', idChecked: false, by: '',
      pay: PAY.NO, paidAt: '', payNote: '', createdAt: now, createdBy: u.code, updatedAt: now,
    });
    appendRow(SH.DATA, o);
    return { id: o.id, fee: o.fee };
  });
}

function updateRegistration(code, id, form) {
  const u = unitAuth_(code);
  const d = cleanForm_(form);
  return withLock_(() => {
    const o = readTable(SH.DATA).find(x => x.id === id && x.unitId === u.id);
    if (!o) throw 'Không tìm thấy phiếu.';
    if (o.status !== ST.WAIT && o.status !== ST.RUN) throw 'Phiếu đã hoàn tất, không thể sửa.';
    const patch = Object.assign({}, d, { updatedAt: new Date() });
    if (o.pay !== PAY.YES) patch.fee = d.accN * cfg_().fee; // đã thu tiền thì giữ nguyên số tiền
    updateRow(SH.DATA, id, patch);
    return { id, fee: patch.fee !== undefined ? patch.fee : o.fee };
  });
}

/* =================== QUẢN LÝ / BẢO VỆ =================== */

function adminLogin(pin) { return { role: role_(pin) }; }

/** scope 'today': phiếu đang mở + phiếu hôm nay; 'month': theo tháng (chỉ quản lý) */
function adminList(pin, scope, month) {
  const role = role_(pin);
  const today = fmt_(new Date(), 'yyyy-MM-dd');
  const rows = readTable(SH.DATA).filter(o => {
    if (scope === 'month' && role === 'admin') return fmt_(o.expectedAt, 'yyyy-MM') === month;
    return o.status === ST.WAIT || o.status === ST.RUN || fmt_(o.expectedAt, 'yyyy-MM-dd') === today;
  }).sort((a, b) => time_(a.expectedAt) - time_(b.expectedAt));
  return { role, rows: rows.map(toClient_) };
}

/** act: 'in' | 'out' (bảo vệ & quản lý) · 'cancel' | 'pay' (chỉ quản lý) */
function adminAction(pin, id, act, p) {
  const role = role_(pin);
  p = p || {};
  if (role !== 'admin' && act !== 'in' && act !== 'out') throw 'PIN bảo vệ chỉ xác nhận vào / ra.';
  return withLock_(() => {
    const o = readTable(SH.DATA).find(x => x.id === id);
    if (!o) throw 'Không tìm thấy phiếu.';
    const now = new Date(), by = text_(p.by, 50) || (role === 'admin' ? 'Quản lý' : 'Bảo vệ');
    let patch;
    if (act === 'in') {
      if (o.status !== ST.WAIT) throw 'Phiếu đang ở trạng thái "' + o.status + '".';
      if (!p.idChecked) throw 'Vui lòng kiểm tra CCCD / VNeID.';
      patch = { status: ST.RUN, inAt: now, idChecked: true, by };
    } else if (act === 'out') {
      if (o.status !== ST.RUN) throw 'Kỹ thuật viên chưa vào.';
      patch = { status: ST.DONE, outAt: now, by: o.by && o.by !== by ? o.by + ' / ' + by : by };
    } else if (act === 'cancel') {
      if (o.status !== ST.WAIT) throw 'Chỉ hủy được phiếu đang chờ.';
      patch = { status: ST.CANCEL };
    } else if (act === 'pay') {
      const fee = Number(p.fee);
      if (!(fee >= 0) || fee > 100000000) throw 'Số tiền không hợp lệ.';
      if (p.pay !== PAY.NO && p.pay !== PAY.YES) throw 'Trạng thái không hợp lệ.';
      patch = { fee, pay: p.pay, payNote: text_(p.payNote, 200),
        paidAt: p.pay === PAY.YES ? (o.pay === PAY.YES ? o.paidAt : now) : '' };
    } else throw 'Thao tác không hợp lệ.';
    patch.updatedAt = now;
    updateRow(SH.DATA, id, patch);
    return toClient_(Object.assign(o, patch));
  });
}

function adminStats(pin, month) {
  if (role_(pin) !== 'admin') throw 'Chỉ PIN quản lý xem được thống kê.';
  const L = readTable(SH.DATA).filter(o => o.status !== ST.CANCEL && fmt_(o.expectedAt, 'yyyy-MM') === month)
    .sort((a, b) => time_(a.expectedAt) - time_(b.expectedAt));
  const sum = { n: L.length, total: 0, paid: 0, unpaid: 0 }, byU = {}, byM = {}, byC = {};
  L.forEach(o => {
    const fee = Number(o.fee) || 0, paid = o.pay === PAY.YES;
    sum.total += fee; paid ? sum.paid += fee : sum.unpaid += fee;
    const u = byU[o.unitId] || (byU[o.unitId] = { name: o.unitName, n: 0, total: 0, paid: 0, unpaid: 0 });
    u.n++; u.total += fee; paid ? u.paid += fee : u.unpaid += fee;
    byM[o.model] = (byM[o.model] || 0) + 1;
    byC[o.color] = (byC[o.color] || 0) + 1;
  });
  const arr = x => Object.keys(x).map(k => ({ name: k, n: x[k] })).sort((a, b) => b.n - a.n);
  return { sum, byUnit: Object.keys(byU).map(k => byU[k]).sort((a, b) => b.total - a.total),
           byModel: arr(byM), byColor: arr(byC), rows: L.map(toClient_) };
}

/** Ghi báo cáo tháng ra sheet BC_YYYY-MM (chỉ đọc, để in / đối chiếu tiền mặt) */
function exportMonth(pin, month) {
  if (!/^\d{4}-\d{2}$/.test(String(month))) throw 'Tháng không hợp lệ.';
  const s = adminStats(pin, month);
  const ss = ss_(), name = 'BC_' + month;
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  const W = 8, pad = r => r.concat(Array(W - r.length).fill(''));
  const out = [
    pad(['BÁO CÁO PHÍ LẮP ĐẶT PHỤ KIỆN – ' + month]),
    pad(['Phiếu', s.sum.n, 'Tổng phí', s.sum.total]),
    pad(['Đã thu', s.sum.paid, 'Chưa thu', s.sum.unpaid]),
    pad([]),
    pad(['Đơn vị', 'Phiếu', 'Tổng phí', 'Đã thu', 'Chưa thu']),
  ];
  s.byUnit.forEach(u => out.push(pad([u.name, u.n, u.total, u.paid, u.unpaid])));
  out.push(pad(['TỔNG', s.sum.n, s.sum.total, s.sum.paid, s.sum.unpaid]), pad([]));
  const head2 = out.length + 1;
  out.push(['ID', 'Số khung', 'Loại xe', 'Màu', 'Phụ kiện', 'Đơn vị – KTV', 'Phí', 'Thanh toán']);
  s.rows.forEach(o => out.push([o.id, o.vin, o.model, o.color, o.acc, o.unitName + ' – ' + o.techName, o.fee, o.pay]));
  sh.getRange(1, 1, out.length, W).setValues(out);
  sh.getRange('A1').setFontWeight('bold').setFontSize(13);
  sh.getRange(5, 1, 1, W).setFontWeight('bold').setBackground('#e7eff9');
  sh.getRange(5 + s.byUnit.length + 1, 1, 1, W).setFontWeight('bold');
  sh.getRange(head2, 1, 1, W).setFontWeight('bold').setBackground('#e7eff9');
  sh.getRange('B2:D3').setNumberFormat('#,##0');
  sh.getRange(6, 2, s.byUnit.length + 1, 4).setNumberFormat('#,##0');
  if (s.rows.length) sh.getRange(head2 + 1, 7, s.rows.length, 1).setNumberFormat('#,##0');
  sh.autoResizeColumns(1, W);
  return ss.getUrl() + '#gid=' + sh.getSheetId();
}

/* =================================================================
 *  BỘ HÀM CHUNG (giống nhau mọi app SAMCO)
 * ================================================================= */

/** Đọc 1 sheet thành mảng object theo tiêu đề hàng 1 (chỉ dùng cho DANG_KY) */
function readTable(name) {
  const sh = sheet_(name), last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, COLS.length).getValues();
  return vals.filter(r => r[0]).map(r => {
    const o = {};
    COLS.forEach(([k], i) => { o[k] = r[i]; });
    o.id = String(o.id); o.unitId = String(o.unitId);
    o.techPhone = String(o.techPhone); o.idChecked = o.idChecked === true || o.idChecked === 'TRUE';
    return o;
  });
}

function appendRow(name, obj) {
  const sh = sheet_(name);
  sh.getRange(sh.getLastRow() + 1, 1, 1, COLS.length).setValues([toRow_(obj)]);
}

function updateRow(name, id, patch) {
  const sh = sheet_(name), last = sh.getLastRow();
  if (last < 2) throw 'Không tìm thấy phiếu.';
  const ids = sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0]));
  const i = ids.indexOf(String(id));
  if (i < 0) throw 'Không tìm thấy phiếu.';
  const row = sh.getRange(i + 2, 1, 1, COLS.length);
  const cur = row.getValues()[0], o = {};
  COLS.forEach(([k], j) => { o[k] = cur[j]; });
  row.setValues([toRow_(Object.assign(o, patch))]);
}

/** ID dạng PK-YYYYMMDD-NNN, đánh số lại từ 001 mỗi ngày. Gọi bên trong withLock_. */
function newId(prefix) {
  const day = prefix + '-' + fmt_(new Date(), 'yyyyMMdd') + '-';
  const sh = sheet_(SH.DATA), last = sh.getLastRow();
  let max = 0;
  if (last >= 2) sh.getRange(2, 1, last - 1, 1).getValues().forEach(r => {
    const s = String(r[0]);
    if (s.indexOf(day) === 0) max = Math.max(max, Number(s.slice(day.length)) || 0);
  });
  return day + String(max + 1).padStart(3, '0');
}

/* =================== CẤU HÌNH & DANH MỤC =================== */

function cfg_() {
  const v = sheet_(SH.CFG).getDataRange().getValues(), kv = {};
  v.slice(1).forEach(r => { if (r[0]) kv[String(r[0]).trim()] = String(r[1] === undefined ? '' : r[1]).trim(); });
  const fee = Number(kv.PHI_MOI_PHU_KIEN), remind = Number(kv.NHAC_TRUOC_PHUT);
  return { fee: kv.PHI_MOI_PHU_KIEN !== '' && fee >= 0 ? fee : 100000,
           remindMin: remind > 0 ? remind : 30,
           pinAdmin: kv.PIN_QUAN_LY || '', pinGuard: kv.PIN_BAO_VE || '' };
}

function dm_() {
  const v = sheet_(SH.DM).getDataRange().getValues();
  const head = v[0].map(h => String(h).trim()), at = h => head.indexOf(h);
  const col = h => at(h) < 0 ? [] : v.slice(1).map(r => String(r[at(h)] === undefined ? '' : r[at(h)]).trim()).filter(Boolean);
  const units = v.slice(1).map(r => ({
    id: String(r[at('Mã ĐV')] || '').trim(), name: String(r[at('Tên đơn vị')] || '').trim(),
    code: String(r[at('Mã đăng nhập')] === undefined ? '' : r[at('Mã đăng nhập')]).trim(),
  })).filter(u => u.id && /^\d{6}$/.test(u.code));
  return { models: col('Loại xe'), colors: col('Màu'), accessories: col('Phụ kiện'), sales: col('Sale phụ trách'), units };
}

/** Chạy tay trong trình chỉnh sửa Apps Script để kiểm tra _CauHinh và _DanhMuc trước khi dùng */
function kiemTraCauHinh() {
  const c = cfg_(), d = dm_(), loi = [];
  if (!/^\d{6}$/.test(c.pinAdmin)) loi.push('PIN_QUAN_LY phải đúng 6 số.');
  if (!/^\d{6}$/.test(c.pinGuard)) loi.push('PIN_BAO_VE phải đúng 6 số.');
  if (c.pinAdmin && c.pinAdmin === c.pinGuard) loi.push('PIN quản lý và PIN bảo vệ phải khác nhau.');
  const codes = d.units.map(u => u.code), ids = d.units.map(u => u.id);
  codes.forEach((x, i) => { if (codes.indexOf(x) !== i) loi.push('Mã đăng nhập ' + x + ' bị trùng.'); });
  ids.forEach((x, i) => { if (ids.indexOf(x) !== i) loi.push('Mã ĐV ' + x + ' bị trùng.'); });
  codes.forEach(x => { if (x === c.pinAdmin || x === c.pinGuard) loi.push('Mã đăng nhập ' + x + ' trùng với PIN.'); });
  if (!d.units.length) loi.push('Chưa có đơn vị nào (cột Mã ĐV + Mã đăng nhập 6 số).');
  if (!d.sales.length) loi.push('Chưa có danh sách Sale phụ trách.');
  const kq = loi.length ? 'CẦN SỬA:\n- ' + loi.join('\n- ') : 'Ổn. ' + d.units.length + ' đơn vị, ' + d.sales.length + ' Sale, phí ' + c.fee + ' đ/phụ kiện.';
  Logger.log(kq);
  return kq;
}

/* =================== XÁC THỰC + CHỐNG DÒ MÃ =================== */
// Mã 6 số chỉ có 1 triệu khả năng nên phải giới hạn số lần sai:
// - mỗi trình duyệt sai 5 lần → khóa trình duyệt đó 15 phút
// - toàn hệ thống sai 30 lần trong 10 phút → tạm khóa đăng nhập 15 phút (chặn kẻ đổi trình duyệt liên tục)
const LIMIT = { DEV: 5, ALL: 30, WINDOW: 600, LOCK: 900 };

function guard_(kind) {
  const c = CacheService.getScriptCache();
  if (c.get('lock:all:' + kind) || (DEV && c.get('lock:' + kind + ':' + DEV))) {
    throw 'Nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.';
  }
}
function fail_(kind, msg) {
  const c = CacheService.getScriptCache(), bump = k => { const n = Number(c.get(k) || 0) + 1; c.put(k, String(n), LIMIT.WINDOW); return n; };
  if (DEV && bump('fail:' + kind + ':' + DEV) >= LIMIT.DEV) c.put('lock:' + kind + ':' + DEV, '1', LIMIT.LOCK);
  if (bump('fail:all:' + kind) >= LIMIT.ALL) c.put('lock:all:' + kind, '1', LIMIT.LOCK);
  Utilities.sleep(600);
  throw msg;
}

function unitAuth_(code) {
  guard_('unit');
  code = String(code === undefined ? '' : code).trim();
  if (!/^\d{6}$/.test(code)) throw 'Mã gồm 6 số.';
  const u = dm_().units.find(x => x.code === code);
  if (!u) fail_('unit', 'Mã không đúng. Vui lòng liên hệ Phòng Kinh doanh.');
  return u;
}

function role_(pin) {
  guard_('pin');
  pin = String(pin === undefined ? '' : pin).trim();
  if (!/^\d{6}$/.test(pin)) throw 'Mã PIN gồm 6 số.';
  const c = cfg_();
  if (!/^\d{6}$/.test(c.pinAdmin) || !/^\d{6}$/.test(c.pinGuard)) throw 'Chưa đặt PIN. Vui lòng điền _CauHinh.';
  if (pin === c.pinAdmin) return 'admin';
  if (pin === c.pinGuard) return 'guard';
  fail_('pin', 'Sai mã PIN.');
}

/* =================== KIỂM TRA DỮ LIỆU PHIẾU =================== */

function cleanForm_(f) {
  f = f || {};
  const d = {
    techName: text_(f.techName, 80), techPhone: text_(f.techPhone, 20), sale: text_(f.sale, 80),
    model: text_(f.model, 60), color: text_(f.color, 40),
    vin: text_(f.vin, 30).toUpperCase().replace(/\s+/g, ''), note: text_(f.note, 300),
  };
  const need = { techName: 'Họ tên', techPhone: 'Điện thoại', sale: 'Sale phụ trách', model: 'Loại xe', color: 'Màu', vin: 'Số khung' };
  Object.keys(need).forEach(k => { if (!d[k]) throw 'Vui lòng nhập: ' + need[k] + '.'; });
  if (!/^\+?[0-9 .]{9,15}$/.test(d.techPhone)) throw 'Số điện thoại chưa đúng.';
  if (dm_().sales.indexOf(d.sale) < 0) throw 'Sale phụ trách không có trong danh sách.';
  // Phụ kiện gửi lên dạng danh sách: mỗi mục = 1 phụ kiện = 1 lần phí
  const list = (Array.isArray(f.acc) ? f.acc : String(f.acc || '').split(','))
    .map(x => text_(x, 60).replace(/,/g, ' ').trim()).filter(Boolean);
  const uniq = list.filter((x, i) => list.indexOf(x) === i);
  if (!uniq.length) throw 'Vui lòng chọn phụ kiện.';
  if (uniq.length > 20) throw 'Tối đa 20 phụ kiện / phiếu.';
  d.acc = uniq.join(', '); d.accN = uniq.length;
  d.expectedAt = parseDT_(f.expectedAt);
  return d;
}

/* =================== TIỆN ÍCH =================== */

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw 'Thiếu sheet ' + name + '. Vui lòng chạy setup().';
  return sh;
}
function toRow_(o) {
  return COLS.map(([k]) => {
    const v = o[k];
    if (v === undefined || v === null) return '';
    if (TEXT_COLS.indexOf(k) >= 0) return String(v);
    // Mỗi lần ghi (cả khi sửa phiếu) đều chặn chữ bắt đầu bằng = + - @ để Sheet không hiểu thành công thức
    if (typeof v === 'string' && /^[=+\-@]/.test(v) && !/^\+?\d/.test(v)) return "'" + v;
    return v;
  });
}
function toClient_(o) {
  const out = {};
  COLS.forEach(([k]) => {
    let v = o[k];
    if (DATE_COLS.indexOf(k) >= 0) v = v instanceof Date ? fmt_(v, "yyyy-MM-dd'T'HH:mm") : '';
    out[k] = v === null || v === undefined ? '' : v;
  });
  out.fee = Number(out.fee) || 0; out.accN = Number(out.accN) || 0;
  return out;
}
function fmt_(d, p) { return d instanceof Date ? Utilities.formatDate(d, TZ, p) : ''; }
function time_(d) { return d instanceof Date ? d.getTime() : 0; }
function parseDT_(s) {
  s = String(s || '').replace('T', ' ').slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) throw 'Vui lòng chọn giờ đến.';
  return Utilities.parseDate(s, TZ, 'yyyy-MM-dd HH:mm');
}
function text_(v, max) {
  return String(v === undefined || v === null ? '' : v).trim().slice(0, max || 200);
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw 'Hệ thống đang bận. Vui lòng thử lại.';
  try { return fn(); } finally { lock.releaseLock(); }
}

/* =================== CÀI ĐẶT LẦN ĐẦU =================== */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
  ss.setSpreadsheetTimeZone(TZ);
  const head = (sh, n) => sh.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#e7eff9');

  let sh = ss.getSheetByName(SH.DATA);
  if (!sh) {
    sh = ss.insertSheet(SH.DATA);
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS.map(c => c[1])]);
    head(sh, COLS.length); sh.setFrozenRows(1); sh.setFrozenColumns(1);
    TEXT_COLS.forEach(k => sh.getRange(2, COLS.findIndex(c => c[0] === k) + 1, 999, 1).setNumberFormat('@'));
    ['expectedAt', 'inAt', 'outAt', 'paidAt', 'createdAt', 'updatedAt'].forEach(k =>
      sh.getRange(2, COLS.findIndex(c => c[0] === k) + 1, 999, 1).setNumberFormat('dd/MM/yyyy HH:mm'));
    sh.getRange(2, COLS.findIndex(c => c[0] === 'fee') + 1, 999, 1).setNumberFormat('#,##0');
  }

  let dm = ss.getSheetByName(SH.DM);
  if (!dm) {
    dm = ss.insertSheet(SH.DM);
    const lists = [
      ['VF 2', 'VF 3', 'VF 5', 'VF 6', 'VF 7', 'VF 8', 'VF 9', 'VF MPV 7', 'Limo Green', 'Minio Green', 'Herio Green', 'Nerio Green', 'EC Van'],
      ['Trắng', 'Đen', 'Xám', 'Bạc', 'Đỏ', 'Xanh dương', 'Xanh lá', 'Vàng', 'Hồng', 'Tím'],
      ['Dán phim', 'Camera', 'Bọc ghế', 'Thảm sàn'],
      [], [], [], [],
    ];
    const n = Math.max.apply(null, lists.map(l => l.length));
    const rows = [DM_COLS];
    for (let i = 0; i < n; i++) rows.push(lists.map(l => l[i] || ''));
    dm.getRange(1, 7, 1000, 1).setNumberFormat('@'); // cột G: Mã đăng nhập giữ số 0 đầu
    dm.getRange(1, 1, rows.length, DM_COLS.length).setValues(rows);
    head(dm, DM_COLS.length); dm.setFrozenRows(1);
  }

  let cf = ss.getSheetByName(SH.CFG);
  if (!cf) {
    cf = ss.insertSheet(SH.CFG);
    cf.getRange('B:B').setNumberFormat('@');
    cf.getRange(1, 1, 5, 3).setValues([
      ['Khóa', 'Giá trị', 'Ghi chú'],
      ['PHI_MOI_PHU_KIEN', '100000', 'Đồng / phụ kiện'],
      ['PIN_QUAN_LY', '', '6 số'],
      ['PIN_BAO_VE', '', '6 số, khác PIN quản lý'],
      ['NHAC_TRUOC_PHUT', '30', 'Chỉ nhắc, không chặn'],
    ]);
    head(cf, 3); cf.setColumnWidth(1, 180); cf.setColumnWidth(3, 220);
  }
  const old = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (old && old.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(old);
  return 'Xong. Điền _CauHinh (2 PIN) và _DanhMuc (Sale, đơn vị), rồi chạy kiemTraCauHinh().';
}
