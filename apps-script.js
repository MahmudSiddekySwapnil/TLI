// ================================================================
// Trust Land Initiative — Samity Manager Backend
// ================================================================

// SHA-256 hash of the admin password — never store the plaintext here.
// To change password: run hashPw("yournewpassword") in the Apps Script console,
// copy the result, and replace the string below.
const ADMIN_PASSWORD_HASH = "bfb35a38abc92182f6e3102d5683c967cb95c998b60991af164af9cb52eb3b43"; // samity2024
const SHEET_ID = "1UvoVp3zPOlHD_Ht8Ce0SOj92FH-YocImm4IK8a4LYHM";

function doGet(e)  { return handle(e); }
function doPost(e) { return handle(e); }

function handle(e) {
  const p = e.parameter;
  let out = {};
  try {
    if      (p.action === "getAll")        out = actionGetAll();
    else if (p.action === "savePayment")   out = needsAuth(p, () => actionSavePayment(p));
    else if (p.action === "addMember")     out = needsAuth(p, () => actionAddMember(p));
    else if (p.action === "editMember")    out = needsAuth(p, () => actionEditMember(p));
    else if (p.action === "deleteMember")  out = needsAuth(p, () => actionDeleteMember(p));
    else if (p.action === "saveSettings")  out = needsAuth(p, () => actionSaveSettings(p));
    else if (p.action === "saveNominee")   out = needsAuth(p, () => actionSaveNominee(p));
    else if (p.action === "checkPassword") out = { ok: checkAuth(p) };
    else out = { ok: false, error: "Unknown action" };
  } catch(err) {
    out = { ok: false, error: err.toString() };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function hashPw(pw) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function checkAuth(p) {
  return hashPw(p.password || "") === ADMIN_PASSWORD_HASH;
}

function needsAuth(p, fn) {
  if (!checkAuth(p)) return { ok: false, error: "Wrong password" };
  return fn();
}

// ── sheet helpers ──────────────────────────────────────────────
function ss() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function getOrCreate(name, headers) {
  let sh = ss().getSheetByName(name);
  if (!sh) {
    sh = ss().insertSheet(name);
    sh.appendRow(headers);
  }
  return sh;
}

function sheetData(name) {
  const sh = ss().getSheetByName(name);
  if (!sh) return [];
  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  const keys = vals[0];
  return vals.slice(1).map(row => {
    const obj = {};
    keys.forEach((k, i) => obj[k] = row[i]);
    return obj;
  });
}

// ── init sheets on first run ───────────────────────────────────
function setupSheets() {
  const members = getOrCreate("Members", ["id","name","phone"]);
  if (members.getLastRow() < 2) {
    [
      [1,"Mahmud Siddeky Swapnil","01521401257"],
      [2,"Wali Mosnad Ayshik","01775503498"],
      [3,"Kamrul Hasan","01688203773"],
      [4,"Salman Rahman Shondhi","01715039153"],
      [5,"Daud Khan","01759695230"],
      [6,"Zahirul Islam","01690152785"],
      [7,"Mahmudul Hasan","01711395842"],
      [8,"Alfaz Uddin","01618431122"],
      [9,"Maksudul Islam","01913539492"],
      [10,"Nafath Rahman","01717615144"],
      [11,"Fakhrul Alam Shuvo","01853100111"],
      [12,"Nazim","01738305885"],
      [13,"Md Hasan Ali","01714343770"],
      [14,"Abdul Mannan","01915700770"],
      [15,"Jewel","01954477243"],
      [16,"Rakibul Hasan","01788450053"],
      [17,"MD. Ebna Sina","01788400819"],
      [18,"Feroz","01718562018"],
      [19,"Sofiqul Alam","01723975751"],
      [20,"Anowar Hossain","01700979791"],
      [21,"Ahmed Navin","01866767184"],
      [22,"Ruhul Amin","01714998736"]
    ].forEach(r => members.appendRow(r));
  }
  getOrCreate("Payments",  ["memberId","year","month","amount"]);
  getOrCreate("Nominees",  ["memberId","name","phone","relation"]);
  const settings = getOrCreate("Settings", ["key","value"]);
  if (settings.getLastRow() < 2) {
    settings.appendRow(["openingBalance", 5000]);
    settings.appendRow(["monthlyTarget",  3000]);
    settings.appendRow(["currency",       "৳"]);
  }
}

// ── actions ────────────────────────────────────────────────────
function actionGetAll() {
  setupSheets();
  const members = sheetData("Members").map(r => ({
    id: Number(r.id), name: r.name, phone: r.phone
  }));
  const payments = {};
  sheetData("Payments").forEach(r => {
    const y = String(r.year), m = String(r.memberId), mo = String(r.month);
    if (!payments[y]) payments[y] = {};
    if (!payments[y][m]) payments[y][m] = {};
    payments[y][m][mo] = Number(r.amount);
  });
  const settings = {};
  sheetData("Settings").forEach(r => settings[r.key] = r.value);
  const nominees = {};
  sheetData("Nominees").forEach(r => {
    nominees[String(r.memberId)] = { name: r.name, phone: r.phone, relation: r.relation };
  });
  return { ok: true, members, payments, settings, nominees };
}

function actionSavePayment(p) {
  const sh = getOrCreate("Payments", ["memberId","year","month","amount"]);
  const data = sh.getDataRange().getValues();
  const mid = String(p.memberId), yr = String(p.year), mo = String(p.month);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0])===mid && String(data[i][1])===yr && String(data[i][2])===mo) {
      sh.getRange(i+1, 4).setValue(Number(p.amount)||0);
      return { ok: true };
    }
  }
  sh.appendRow([p.memberId, p.year, p.month, Number(p.amount)||0]);
  return { ok: true };
}

function actionSaveNominee(p) {
  const sh = getOrCreate("Nominees", ["memberId","name","phone","relation"]);
  const data = sh.getDataRange().getValues();
  const mid = String(p.memberId);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === mid) {
      sh.getRange(i+1, 2).setValue(p.name    || "");
      sh.getRange(i+1, 3).setValue(p.phone   || "");
      sh.getRange(i+1, 4).setValue(p.relation|| "");
      return { ok: true };
    }
  }
  sh.appendRow([p.memberId, p.name||"", p.phone||"", p.relation||""]);
  return { ok: true };
}

function actionAddMember(p) {
  const sh = getOrCreate("Members", ["id","name","phone"]);
  const data = sh.getDataRange().getValues();
  let maxId = 0;
  for (let i = 1; i < data.length; i++) if (Number(data[i][0]) > maxId) maxId = Number(data[i][0]);
  sh.appendRow([maxId+1, p.name, p.phone||""]);
  return { ok: true };
}

function actionEditMember(p) {
  const sh = getOrCreate("Members", ["id","name","phone"]);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.memberId)) {
      sh.getRange(i+1, 2).setValue(p.name);
      sh.getRange(i+1, 3).setValue(p.phone||"");
      return { ok: true };
    }
  }
  return { ok: false, error: "Member not found" };
}

function actionDeleteMember(p) {
  const sh = getOrCreate("Members", ["id","name","phone"]);
  const data = sh.getDataRange().getValues();
  for (let i = data.length-1; i >= 1; i--) {
    if (String(data[i][0]) === String(p.memberId)) {
      sh.deleteRow(i+1);
      return { ok: true };
    }
  }
  return { ok: false, error: "Member not found" };
}

function actionSaveSettings(p) {
  const sh = getOrCreate("Settings", ["key","value"]);
  const data = sh.getDataRange().getValues();
  const updates = {
    openingBalance: p.openingBalance,
    monthlyTarget: p.monthlyTarget,
    currency: p.currency
  };
  Object.entries(updates).forEach(([key, val]) => {
    if (val === undefined) return;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) { sh.getRange(i+1, 2).setValue(val); return; }
    }
    sh.appendRow([key, val]);
  });
  return { ok: true };
}
