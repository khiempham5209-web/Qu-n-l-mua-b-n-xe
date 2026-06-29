const SPREADSHEET_ID = "1-bO0Ol8bpFV4API02AlFkXqlNt8CAQ8B1LqBfuVJK2M";
const TZ = "Asia/Bangkok";
const DEFAULT_OWNER_EMAIL = "thachxeluot69@gmail.com"; // Đổi mail này nếu muốn chuyển chủ web
const APP_SETTINGS_PROPERTY_KEY = "CAR_APP_SETTINGS_V1";
// v10: xóa toàn bộ xe theo ID, chỉ chủ web được dùng

const SHEETS = {
  purchase: "Mua",
  cost: "Chi phí",
  sale: "Bán",
  summary: "Tổng"
};

const HEADERS = {
  purchase: ["ID Xe", "Ngày", "Tên xe", "Biển kiểm soát", "Giá mua", "Giá bán niêm yết", "Người thực hiện", "Nội dung", "Ghi chú"],
  cost: ["ID Xe", "Ngày", "Tên xe", "Biển kiểm soát", "Số tiền", "Người thực hiện", "Nội dung", "Loại chi", "Ghi chú"],
  sale: ["ID Xe", "Ngày", "Tên xe", "Biển kiểm soát", "Giá bán thực tế", "Người thực hiện", "Nội dung", "Ghi chú"],
  summary: ["ID Xe", "Ngày mua", "Tên xe", "Biển kiểm soát", "Giá mua", "Giá bán niêm yết", "Giá bán thực tế", "Chi phí", "Giá vốn", "Lãi/Lỗ", "Trạng thái"]
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || "list").toLowerCase();
  try {
    ensureWorkbook_();
    if (action === "publicsettings") return respond_({ ok: true, settings: readAppSettings_() }, p.callback);
    const auth = checkAccess_(p.email);
    if (!auth.ok) return respond_(auth, p.callback);

    if (action === "list") return respond_({ ok: true, data: readData_(), settings: readAppSettings_(), users: auth.isAdmin ? readUsers_() : [], isAdmin: auth.isAdmin, ownerEmail: DEFAULT_OWNER_EMAIL }, p.callback);
    if (action === "append") {
      const row = JSON.parse(p.row || "{}");
      appendRow_(normalizeType_(p.type), row);
      rebuildSummary_();
      return respond_({ ok: true, data: readData_() }, p.callback);
    }
    if (action === "update") {
      const row = JSON.parse(p.row || "{}");
      updateRow_(normalizeType_(p.type), Number(p.rowNumber || row._rowNumber), row);
      rebuildSummary_();
      return respond_({ ok: true, data: readData_() }, p.callback);
    }
    if (action === "delete") {
      if (!auth.isAdmin) return respond_({ ok: false, error: "Chỉ chủ web mới được xóa dữ liệu" }, p.callback);
      const row = JSON.parse(p.row || "{}");
      deleteRow_(normalizeType_(p.type), Number(p.rowNumber), p.id || row.id || "", row);
      rebuildSummary_();
      return respond_({ ok: true, data: readData_() }, p.callback);
    }
    if (action === "deletevehicle") {
      if (!auth.isAdmin) return respond_({ ok: false, error: "Chỉ chủ web mới được xóa xe" }, p.callback);
      deleteVehicle_(p.vehicleId || p.id || "");
      rebuildSummary_();
      return respond_({ ok: true, data: readData_() }, p.callback);
    }
    if (action === "adduser") {
      if (!auth.isAdmin) return respond_({ ok: false, error: "Chỉ chủ web mới được thêm mail" }, p.callback);
      addUser_(p.newEmail, p.name || "");
      return respond_({ ok: true, users: readUsers_() }, p.callback);
    }
    if (action === "deleteuser") {
      if (!auth.isAdmin) return respond_({ ok: false, error: "Chỉ chủ web mới được xóa quyền" }, p.callback);
      deleteUser_(p.targetEmail);
      return respond_({ ok: true, users: readUsers_() }, p.callback);
    }
    if (action === "savesettings") {
      if (!auth.isAdmin) return respond_({ ok: false, error: "Chỉ chủ web mới được sửa cài đặt app" }, p.callback);
      const settings = JSON.parse(p.settings || "{}");
      saveAppSettings_(settings);
      return respond_({ ok: true, settings: readAppSettings_() }, p.callback);
    }
    if (action === "rebuild") {
      rebuildSummary_();
      return respond_({ ok: true, data: readData_(), settings: readAppSettings_(), users: auth.isAdmin ? readUsers_() : [], isAdmin: auth.isAdmin, ownerEmail: DEFAULT_OWNER_EMAIL }, p.callback);
    }
    return respond_({ ok: false, error: "Action không hợp lệ" }, p.callback);
  } catch (err) {
    return respond_({ ok: false, error: err.message || String(err) }, p.callback);
  }
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) {}
  try {
    ensureWorkbook_();
    const auth = checkAccess_(body.email);
    if (!auth.ok) return json_(auth);
    if (body.action === "append") {
      appendRow_(normalizeType_(body.type), body.row || {});
      rebuildSummary_();
      return json_({ ok: true, data: readData_() });
    }
    if (body.action === "update") {
      updateRow_(normalizeType_(body.type), Number(body.rowNumber || (body.row && body.row._rowNumber)), body.row || {});
      rebuildSummary_();
      return json_({ ok: true, data: readData_() });
    }
    if (body.action === "delete") {
      if (!auth.isAdmin) return json_({ ok: false, error: "Chỉ chủ web mới được xóa dữ liệu" });
      deleteRow_(normalizeType_(body.type), Number(body.rowNumber), body.id || (body.row && body.row.id) || "", body.row || {});
      rebuildSummary_();
      return json_({ ok: true, data: readData_() });
    }
    if (body.action === "deletevehicle") {
      if (!auth.isAdmin) return json_({ ok: false, error: "Chỉ chủ web mới được xóa xe" });
      deleteVehicle_(body.vehicleId || body.id || "");
      rebuildSummary_();
      return json_({ ok: true, data: readData_() });
    }
    if (body.action === "adduser") {
      if (!auth.isAdmin) return json_({ ok: false, error: "Chỉ chủ web mới được thêm mail" });
      addUser_(body.newEmail, body.name || "");
      return json_({ ok: true, users: readUsers_() });
    }
    if (body.action === "deleteuser") {
      if (!auth.isAdmin) return json_({ ok: false, error: "Chỉ chủ web mới được xóa quyền" });
      deleteUser_(body.targetEmail);
      return json_({ ok: true, users: readUsers_() });
    }
    if (body.action === "savesettings") {
      if (!auth.isAdmin) return json_({ ok: false, error: "Chỉ chủ web mới được sửa cài đặt app" });
      saveAppSettings_(body.settings || {});
      return json_({ ok: true, settings: readAppSettings_() });
    }
    return json_({ ok: false, error: "Action không hợp lệ" });
  } catch (err) {
    return json_({ ok: false, error: err.message || String(err) });
  }
}

function defaultAppSettings_() {
  return { appName: "Quản lý mua bán xe", subtitle: "Mua - bán - sửa xe", iconText: "XE", fontScale: "normal", fontFamily: "system", theme: "clean", accent: "#146c63" };
}

function readAppSettings_() {
  const props = PropertiesService.getScriptProperties();
  try {
    const saved = JSON.parse(props.getProperty(APP_SETTINGS_PROPERTY_KEY) || "{}");
    const out = Object.assign(defaultAppSettings_(), saved || {});
    delete out.apiUrl;
    return out;
  } catch (err) {
    return defaultAppSettings_();
  }
}

function saveAppSettings_(settings) {
  const current = readAppSettings_();
  const next = Object.assign({}, current, settings || {});
  delete next.apiUrl;
  next.appName = String(next.appName || current.appName).slice(0, 40);
  next.subtitle = String(next.subtitle || current.subtitle).slice(0, 80);
  next.iconText = String(next.iconText || current.iconText).slice(0, 3);
  next.fontScale = ["xsmall","small","normal","large","xlarge"].indexOf(String(next.fontScale)) >= 0 ? String(next.fontScale) : "normal";
  next.fontFamily = ["system","serif","mono"].indexOf(String(next.fontFamily)) >= 0 ? String(next.fontFamily) : "system";
  next.theme = ["clean","mint","warm","ink"].indexOf(String(next.theme)) >= 0 ? String(next.theme) : "clean";
  next.accent = /^#[0-9a-fA-F]{6}$/.test(String(next.accent)) ? String(next.accent) : "#146c63";
  PropertiesService.getScriptProperties().setProperty(APP_SETTINGS_PROPERTY_KEY, JSON.stringify(next));
}

function normalizeType_(type) {
  const value = String(type || "").toLowerCase();
  if (["purchase", "cost", "sale"].includes(value)) return value;
  throw new Error("Loại dữ liệu không hợp lệ");
}

function ensureWorkbook_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(HEADERS).forEach(type => {
    let sh = ss.getSheetByName(SHEETS[type]);
    if (!sh) sh = ss.insertSheet(SHEETS[type]);
    ensureHeaders_(sh, HEADERS[type]);
  });
  ensureOwnerUser_();
}

function ensureHeaders_(sheet, headers) {
  const lastCol = Math.max(sheet.getLastColumn(), headers.length, 1);
  const current = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  if (current.filter(Boolean).length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  const needAdd = headers.filter(h => current.indexOf(h) < 0);
  if (needAdd.length) sheet.getRange(1, lastCol + 1, 1, needAdd.length).setValues([needAdd]);
  sheet.setFrozenRows(1);
}

function checkAccess_(email) {
  const submitted = String(email || "").trim().toLowerCase();
  if (!submitted) return { ok: false, error: "Vui lòng nhập email" };
  const users = readUsers_();
  const found = users.find(u => u.email === submitted);
  if (!found) return { ok: false, error: "Email chưa được cấp quyền" };
  return { ok: true, isAdmin: isAdminEmail_(submitted, found) };
}

function isAdminEmail_(email, user) {
  const mail = String(email || "").trim().toLowerCase();
  const role = String((user && user.role) || "").trim().toLowerCase();
  return mail === String(DEFAULT_OWNER_EMAIL || "").trim().toLowerCase() || role === "owner" || role === "admin" || role === "chủ web";
}

const USERS_PROPERTY_KEY = "CAR_APP_ALLOWED_USERS_V1";

function ensureOwnerUser_() {
  const users = readUsersRaw_();
  const owner = String(DEFAULT_OWNER_EMAIL || "").trim().toLowerCase();
  if (!owner) return;
  if (!users.some(u => u.email === owner)) {
    users.unshift({ email: owner, name: "Admin", role: "Owner", status: "Active", note: "Chủ web mặc định" });
    saveUsers_(users);
  }
}

function readUsersRaw_() {
  const raw = PropertiesService.getScriptProperties().getProperty(USERS_PROPERTY_KEY);
  let users = [];
  try { users = JSON.parse(raw || "[]"); } catch (err) { users = []; }
  return users.map(u => ({
    email: String(u.email || "").trim().toLowerCase(),
    name: u.name || "",
    role: u.role || "User",
    status: u.status || "Active",
    note: u.note || ""
  })).filter(u => u.email);
}

function saveUsers_(users) {
  PropertiesService.getScriptProperties().setProperty(USERS_PROPERTY_KEY, JSON.stringify(users));
}

function readUsers_() {
  ensureOwnerUser_();
  return readUsersRaw_().filter(u => String(u.status || "Active").toLowerCase() !== "inactive");
}

function addUser_(email, name) {
  const mail = String(email || "").trim().toLowerCase();
  if (!mail || mail.indexOf("@") < 0) throw new Error("Email thêm quyền không hợp lệ");
  const users = readUsersRaw_();
  const existed = users.some(u => u.email === mail);
  if (!existed) {
    users.push({ email: mail, name: name || "", role: "User", status: "Active", note: "Thêm từ app" });
    saveUsers_(users);
  }
}

function deleteUser_(email) {
  const mail = String(email || "").trim().toLowerCase();
  const owner = String(DEFAULT_OWNER_EMAIL || "").trim().toLowerCase();
  if (!mail || mail.indexOf("@") < 0) throw new Error("Email xóa quyền không hợp lệ");
  if (mail === owner) throw new Error("Không được xóa mail chủ web");
  const users = readUsersRaw_().filter(u => u.email !== mail);
  saveUsers_(users);
}

function readData_() {
  const data = { purchase: readPurchase_(), cost: readCost_(), sale: readSale_() };
  data.vehicles = buildVehicles_(data.purchase, data.cost, data.sale);
  data.summary = data.vehicles;
  return data;
}

function readPurchase_() {
  const sh = getSheet_(SHEETS.purchase);
  return readObjects_(sh).map(r => {
    const name = pick_(r, ["Tên xe"]), plate = pick_(r, ["Biển kiểm soát", "BKS"]);
    return {
      _rowNumber: r._rowNumber,
      id: pick_(r, ["ID Xe", "ID"]) || makeVehicleId_(name, plate),
      date: pick_(r, ["Ngày", "Ngày mua"]), name, plate,
      amount: money_(pick_(r, ["Giá mua", "Mua vào"])),
      listPrice: money_(pick_(r, ["Giá bán niêm yết", "Giá niêm yết"])),
      user: pick_(r, ["Người thực hiện", "Người mua"]),
      content: pick_(r, ["Nội dung"]), note: pick_(r, ["Ghi chú"])
    };
  }).filter(r => r.name || r.plate || r.amount || r.listPrice);
}

function readCost_() {
  const sh = getSheet_(SHEETS.cost);
  return readObjects_(sh).map(r => {
    const name = pick_(r, ["Tên xe"]), plate = pick_(r, ["Biển kiểm soát", "BKS"]);
    return {
      _rowNumber: r._rowNumber,
      id: pick_(r, ["ID Xe", "ID"]) || makeVehicleId_(name, plate),
      date: pick_(r, ["Ngày"]), name, plate,
      amount: money_(pick_(r, ["Số tiền", "Chi phí"])),
      user: pick_(r, ["Người thực hiện"]), content: pick_(r, ["Nội dung"]),
      category: pick_(r, ["Loại chi"]) || inferCostCategory_(pick_(r, ["Nội dung"])),
      note: pick_(r, ["Ghi chú"])
    };
  }).filter(r => r.name || r.plate || r.amount || r.content);
}

function readSale_() {
  const sh = getSheet_(SHEETS.sale);
  return readObjects_(sh).map(r => {
    const name = pick_(r, ["Tên xe"]), plate = pick_(r, ["Biển kiểm soát", "BKS"]);
    return {
      _rowNumber: r._rowNumber,
      id: pick_(r, ["ID Xe", "ID"]) || makeVehicleId_(name, plate),
      date: pick_(r, ["Ngày", "Ngày bán"]), name, plate,
      amount: money_(pick_(r, ["Giá bán thực tế", "Giá bán", "Bán ra"])),
      user: pick_(r, ["Người thực hiện", "Người bán"]), content: pick_(r, ["Nội dung"]), note: pick_(r, ["Ghi chú"])
    };
  }).filter(r => r.name || r.plate || r.amount);
}

function appendRow_(type, row) {
  const sh = getSheet_(SHEETS[type]);
  const id = String(row.id || makeVehicleId_(row.name, row.plate) || Utilities.getUuid().slice(0, 8)).trim();
  const date = row.date || Utilities.formatDate(new Date(), TZ, "dd/MM/yyyy");
  if (type === "purchase") writeByHeader_(sh, null, {"ID Xe": id, "Ngày": date, "Tên xe": row.name, "Biển kiểm soát": row.plate, "Giá mua": money_(row.amount), "Giá bán niêm yết": money_(row.listPrice), "Người thực hiện": row.user, "Nội dung": row.content, "Ghi chú": row.note});
  if (type === "cost") writeByHeader_(sh, null, {"ID Xe": id, "Ngày": date, "Tên xe": row.name, "Biển kiểm soát": row.plate, "Số tiền": money_(row.amount), "Người thực hiện": row.user, "Nội dung": row.content, "Loại chi": row.category || inferCostCategory_(row.content), "Ghi chú": row.note});
  if (type === "sale") writeByHeader_(sh, null, {"ID Xe": id, "Ngày": date, "Tên xe": row.name, "Biển kiểm soát": row.plate, "Giá bán thực tế": money_(row.amount), "Người thực hiện": row.user, "Nội dung": row.content, "Ghi chú": row.note});
  SpreadsheetApp.flush();
}

function updateRow_(type, rowNumber, row) {
  if (!rowNumber || rowNumber < 2) throw new Error("Không tìm thấy dòng cần sửa");
  const sh = getSheet_(SHEETS[type]);
  const id = String(row.id || makeVehicleId_(row.name, row.plate) || "").trim();
  if (type === "purchase") writeByHeader_(sh, rowNumber, {"ID Xe": id, "Ngày": row.date, "Tên xe": row.name, "Biển kiểm soát": row.plate, "Giá mua": money_(row.amount), "Giá bán niêm yết": money_(row.listPrice), "Người thực hiện": row.user, "Nội dung": row.content, "Ghi chú": row.note});
  if (type === "cost") writeByHeader_(sh, rowNumber, {"ID Xe": id, "Ngày": row.date, "Tên xe": row.name, "Biển kiểm soát": row.plate, "Số tiền": money_(row.amount), "Người thực hiện": row.user, "Nội dung": row.content, "Loại chi": row.category, "Ghi chú": row.note});
  if (type === "sale") writeByHeader_(sh, rowNumber, {"ID Xe": id, "Ngày": row.date, "Tên xe": row.name, "Biển kiểm soát": row.plate, "Giá bán thực tế": money_(row.amount), "Người thực hiện": row.user, "Nội dung": row.content, "Ghi chú": row.note});
  SpreadsheetApp.flush();
}

function deleteRow_(type, rowNumber, id, rowObj) {
  const sh = getSheet_(SHEETS[type]);
  let targetRow = Number(rowNumber || 0);

  if (!targetRow || targetRow < 2 || targetRow > sh.getLastRow()) {
    targetRow = findDeleteRow_(sh, id, rowObj || {});
  }

  if (!targetRow || targetRow < 2) throw new Error("Không tìm thấy dòng cần xóa");
  sh.deleteRow(targetRow);
  SpreadsheetApp.flush();
}


function deleteVehicle_(vehicleId) {
  const id = String(vehicleId || "").trim();
  if (!id) throw new Error("Không tìm thấy ID xe cần xóa");
  ["purchase", "cost", "sale"].forEach(type => deleteRowsByVehicleId_(getSheet_(SHEETS[type]), id));
  SpreadsheetApp.flush();
}

function deleteRowsByVehicleId_(sheet, vehicleId) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return;
  const values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const headers = values[0];
  const cId = headers.indexOf("ID Xe");
  const cName = headers.indexOf("Tên xe");
  const cPlate = headers.indexOf("Biển kiểm soát");
  for (let r = values.length - 1; r >= 1; r--) {
    const row = values[r];
    const rowId = cId >= 0 ? String(row[cId] || "").trim() : "";
    const fallbackId = makeVehicleId_(cName >= 0 ? row[cName] : "", cPlate >= 0 ? row[cPlate] : "");
    if (rowId === vehicleId || fallbackId === vehicleId) sheet.deleteRow(r + 1);
  }
}

function findDeleteRow_(sheet, id, rowObj) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const headers = values[0];
  const cId = headers.indexOf("ID Xe");
  const cDate = headers.indexOf("Ngày");
  const cName = headers.indexOf("Tên xe");
  const cPlate = headers.indexOf("Biển kiểm soát");
  const moneyHeaders = ["Giá mua", "Số tiền", "Giá bán thực tế"];
  const cMoney = moneyHeaders.map(h => headers.indexOf(h)).find(i => i >= 0);
  const targetId = String(id || rowObj.id || "").trim();
  const targetDate = normalizeText_(rowObj.date);
  const targetName = normalizeText_(rowObj.name);
  const targetPlate = normalizeText_(rowObj.plate);
  const targetMoney = money_(rowObj.amount);

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const sameId = !targetId || cId < 0 || String(row[cId] || "").trim() === targetId;
    const sameDate = !targetDate || cDate < 0 || normalizeText_(row[cDate]) === targetDate;
    const sameName = !targetName || cName < 0 || normalizeText_(row[cName]) === targetName;
    const samePlate = !targetPlate || cPlate < 0 || normalizeText_(row[cPlate]) === targetPlate;
    const sameMoney = !targetMoney || cMoney < 0 || money_(row[cMoney]) === targetMoney;
    if (sameId && sameDate && sameName && samePlate && sameMoney) return r + 1;
  }
  return 0;
}

function normalizeText_(value) {
  return String(value || "").trim().toLowerCase();
}

function writeByHeader_(sheet, rowNumber, obj) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const row = rowNumber || sheet.getLastRow() + 1;
  Object.keys(obj).forEach(k => {
    const col = headers.indexOf(k) + 1;
    if (col > 0) sheet.getRange(row, col).setValue(obj[k] == null ? "" : obj[k]);
  });
}

function buildVehicles_(purchases, costs, sales) {
  const map = new Map();
  purchases.forEach(p => {
    const key = vehicleKey_(p);
    if (!map.has(key)) map.set(key, baseVehicle_(p));
    const v = map.get(key);
    Object.assign(v, { id: p.id || v.id, date: p.date || v.date, name: p.name || v.name, plate: p.plate || v.plate });
    v.purchase += money_(p.amount);
    v.listPrice = money_(p.listPrice) || v.listPrice;
    v.purchaseRows.push(p);
  });
  costs.forEach(c => {
    const key = vehicleKey_(c);
    if (!map.has(key)) map.set(key, baseVehicle_(c));
    const v = map.get(key);
    v.cost += money_(c.amount);
    v.costRows.push(c);
  });
  sales.forEach(s => {
    const key = vehicleKey_(s);
    if (!map.has(key)) map.set(key, baseVehicle_(s));
    const v = map.get(key);
    v.sale += money_(s.amount);
    v.saleDate = s.date || v.saleDate;
    v.saleRows.push(s);
  });
  return Array.from(map.values()).map(v => {
    v.capital = v.purchase + v.cost;
    v.profit = v.sale ? v.sale - v.capital : 0;
    v.status = v.sale ? "Đã bán" : "Đang giữ";
    return v;
  }).sort((a,b) => String(b.saleDate || b.date).localeCompare(String(a.saleDate || a.date)));
}

function baseVehicle_(r) { return { id: r.id || makeVehicleId_(r.name, r.plate), date: r.date || "", saleDate: "", name: r.name || "", plate: r.plate || "", purchase: 0, listPrice: 0, cost: 0, sale: 0, capital: 0, profit: 0, status: "Đang giữ", purchaseRows: [], costRows: [], saleRows: [] }; }
function vehicleKey_(r) { return String(r.id || makeVehicleId_(r.name, r.plate)).toLowerCase(); }
function makeVehicleId_(name, plate) { const raw = `${plate || ""}-${name || ""}`.trim(); return raw ? raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : ""; }
function inferCostCategory_(content) { const t = String(content || "").toLowerCase(); if (t.includes("rửa") || t.includes("dọn")) return "Rửa/dọn xe"; if (t.includes("sửa") || t.includes("thay")) return "Sửa chữa"; if (t.includes("hồ sơ") || t.includes("rút")) return "Rút hồ sơ"; if (t.includes("đăng kiểm")) return "Đăng kiểm"; return "Chi phí khác"; }
function rebuildSummary_() { const sh = getSheet_(SHEETS.summary); ensureHeaders_(sh, HEADERS.summary); if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent(); const rows = buildVehicles_(readPurchase_(), readCost_(), readSale_()).map(v => [v.id, v.date, v.name, v.plate, v.purchase, v.listPrice, v.sale, v.cost, v.capital, v.profit, v.status]); if (rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows); }
function getSheet_(name) { const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name); if (!sh) throw new Error(`Thiếu tab ${name}`); return sh; }
function readObjects_(sheet) { const values = sheet.getDataRange().getDisplayValues(); if (values.length < 2) return []; const headers = values[0].map(String); return values.slice(1).map((r,i) => { const o = {_rowNumber:i+2}; headers.forEach((h,c) => { if (h) o[h] = r[c]; }); return o; }); }
function pick_(obj, names) { for (let i=0;i<names.length;i++) { const v = obj[names[i]]; if (v !== undefined && v !== null && String(v).trim() !== "") return v; } return ""; }
function money_(v) { if (typeof v === "number") return v; return Number(String(v || "").replace(/[^\d-]/g, "")) || 0; }
function respond_(payload, cb) { const out = JSON.stringify(payload); if (cb) return ContentService.createTextOutput(`${cb}(${out})`).setMimeType(ContentService.MimeType.JAVASCRIPT); return json_(payload); }
function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
