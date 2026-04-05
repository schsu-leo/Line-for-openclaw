const { google } = require('googleapis');
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');
const { Readable } = require('stream');
const { renderHTML } = require('./deliveryPdf.templates');

const SPREADSHEET_ID = process.env.DELIVERY_SPREADSHEET_ID || '1Am0Aobazouit64Zf6_gN-s2DNZoYRHod3KfMLF5AVP8';

// 欄位索引 (0-based, A=0)
const C = {
  MONTH: 0, DATE: 1, CUSTOMER: 2, SEQ: 3, VENDOR: 4, BOOTH: 5,
  PRODUCT: 6, UNIT_KG: 7, SPECIAL_NOTE: 9,
  VEHICLE: 12,
  WEIGHT: 18,
  PRICE: 27,
  TOTAL: 32,
  ROUTING: 38,        // AM 欄：公斤 / 無單價-公斤 / 報價制專用 / 報價制-阿爾法
  WEIGHT_CONV: 47,    // AV 出貨重(轉換)
  UNIT_QUOTE: 48,     // AW 出貨單位(報價制)
  PRICE_QUOTE: 49,    // AX 報價單價
  TOTAL_QUOTE: 50,    // AY 貨款計算_報
  IN_OUT: 51,         // AZ 進/退貨
  YADONG_WEIGHT: 57,  // BF 亞東出貨重
  YADONG_SEQ: 58,     // BG 亞東當日序號
  USE_DATE: 62,       // BK 使用日
  ALPHA_CODE: 63,     // BL 阿爾法料號
  CUSTOMER_GROUP: 64, // BM 客戶總稱
};

// Google Sheets serial date → "M/D" 字串（UTC，處理日期儲存格以 UNFORMATTED_VALUE 回傳數字的情況）
function serialToMD(serial) {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}
function normDateVal(val) {
  if (typeof val === 'number') return serialToMD(val);
  return String(val ?? '').trim();
}

// 忽略的特殊列（範本列/標記列）
const SKIP_CUSTOMERS = new Set(['*複製用請勿刪除', ' 不要編輯', '測試車單']);
const SKIP_VEHICLES  = new Set(['']);   // '日期錯誤' 不再跳過，可作為車次選項

function getAuth(scopes) {
  return new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SA_KEY_PATH,
    scopes,
  });
}

// OAuth2 client for Drive（用 gas-monthly-invoice 的 refresh token）
function getDriveOAuth2() {
  const fs = require('fs');
  const tokenPath = process.env.DRIVE_TOKEN_PATH || '/app/credentials/drive_token.json';
  const t = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
  const client = new google.auth.OAuth2(t.client_id, t.client_secret);
  client.setCredentials({
    refresh_token: t.refresh_token,
    access_token:  t.token,
    expiry_date:   t.expiry ? new Date(t.expiry).getTime() : undefined,
  });
  return client;
}

// 讀取 A.採購明細總表 原始資料
// vehiclePrefixes: string[] — 車次前綴陣列（依車次模式）
// customerNames:   string[] — 客戶名稱陣列（依客戶模式，空陣列代表不用客戶篩選）
async function readSheetData(date, vehiclePrefixes, customerNames, spreadsheetId) {
  const sheetId = spreadsheetId || SPREADSHEET_ID;
  const auth = getAuth(['https://www.googleapis.com/auth/spreadsheets.readonly']);
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'A.採購明細總表!A:BN',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const rows = (res.data.values || []).slice(1); // 跳過標題列
  const byCustomer = Array.isArray(customerNames) && customerNames.length > 0;

  return rows.filter(row => {
    const rowDate     = normDateVal(row[C.DATE]);
    const rowVehicle  = (row[C.VEHICLE]  || '').trim();
    const rowCustomer = (row[C.CUSTOMER] || '').trim();
    const rowProduct  = (row[C.PRODUCT]  || '').trim();

    if (!rowProduct) return false;
    if (SKIP_CUSTOMERS.has(rowCustomer)) return false;
    if (SKIP_VEHICLES.has(rowVehicle))   return false;
    if (rowDate !== date) return false;

    if (byCustomer) {
      return customerNames.includes(rowCustomer);
    }

    return vehiclePrefixes.some(prefix => {
      if (prefix === '自送')    return rowVehicle === '自送';
      if (prefix === '日期錯誤') return rowVehicle === '日期錯誤';
      return rowVehicle.startsWith(prefix);
    });
  });
}

// 依停點分組，並排序
// 車次為「日期錯誤」時，同車次不同客戶各自獨立為一組（各佔一頁）
const SEP = '\x00';
function groupByStop(rows) {
  const stops = {};
  for (const row of rows) {
    const v    = (row[C.VEHICLE]        || '').trim();
    const cust = (row[C.CUSTOMER_GROUP] || row[C.CUSTOMER] || '').trim();
    const key  = v === '日期錯誤' ? `${v}${SEP}${cust}` : v;
    if (!stops[key]) stops[key] = [];
    stops[key].push(row);
  }
  return Object.entries(stops).sort(([a], [b]) => {
    const va = a.split(SEP)[0];
    const vb = b.split(SEP)[0];
    if (va === '自送') return -1;
    if (vb === '自送') return 1;
    if (va === '日期錯誤' && vb !== '日期錯誤') return 1;
    if (vb === '日期錯誤' && va !== '日期錯誤') return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

// 從 groupByStop 的 key 中取出實際車次代碼（去掉客戶後綴）
function vehicleFromKey(key) {
  return key.split(SEP)[0];
}

// ── PDF 渲染前驗算 ─────────────────────────────────────
// 確保：來源貨款 ≈ 單價 × 數量，且與即將渲染的數值一致
// no_price / yadong 無貨款欄，直接 pass
function validateRows(templateType, rows, C, customer) {
  let weightCol, priceCol, totalCol, label;
  if (templateType === 'kg') {
    weightCol = C.WEIGHT; priceCol = C.PRICE; totalCol = C.TOTAL;
    label = '時價';
  } else if (templateType === 'quoted' || templateType === 'alpha') {
    weightCol = C.WEIGHT_CONV; priceCol = C.PRICE_QUOTE; totalCol = C.TOTAL_QUOTE;
    label = '報價制';
  } else {
    return; // no_price / yadong — 無需驗算
  }

  const errors = [];
  for (const row of rows) {
    const product    = (row[C.PRODUCT] || '').trim();
    const rawWeight  = parseFloat(String(row[weightCol] ?? '').replace(/,/g, ''));
    const rawPrice   = parseFloat(String(row[priceCol]  ?? '').replace(/,/g, ''));
    const total      = parseFloat(String(row[totalCol]  ?? '').replace(/,/g, ''));

    if (isNaN(rawWeight) || isNaN(rawPrice) || isNaN(total)) continue; // 空白列跳過

    // 複製試算表的計算機制：單價取小數1位、數量取小數2位，相乘後四捨五入至整數
    const weight   = Math.round(rawWeight * 100) / 100;
    const price    = Math.round(rawPrice  * 10)  / 10;
    const expected = Math.round(weight * price);
    const actual   = Math.round(total);

    if (expected !== actual) {
      errors.push(
        `${product}：單價(${price}) × 數量(${weight}) = ${expected}，來源貨款 = ${actual}`
      );
    }
  }

  // 回傳錯誤陣列（空陣列代表通過）
  return errors;
}

// 判斷模板類型
function getTemplateType(rows) {
  const routing       = (rows[0]?.[C.ROUTING]        || '').trim();
  const customerGroup = (rows[0]?.[C.CUSTOMER_GROUP] || '').trim();
  if (customerGroup.includes('亞東')) return 'yadong';
  if (routing === '無單價-公斤')      return 'no_price';
  if (routing === '報價制-阿爾法')    return 'alpha';
  if (routing === '報價制專用')       return 'quoted';
  return 'kg';
}

// Playwright 渲染 HTML → PDF Buffer
async function renderPDF(html) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// pdf-lib 合併多份 PDF
async function mergePDFs(buffers) {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  return Buffer.from(await merged.save());
}

// 上傳到 Google Drive，回傳可分享連結
async function uploadToDrive(buffer, filename) {
  const auth = getDriveOAuth2();
  const drive = google.drive({ version: 'v3', auth });

  const stream = Readable.from(buffer);
  const createRes = await drive.files.create({
    requestBody: { name: filename, mimeType: 'application/pdf' },
    media:       { mimeType: 'application/pdf', body: stream },
    fields: 'id',
  });
  const fileId = createRes.data.id;

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  const meta = await drive.files.get({ fileId, fields: 'webViewLink' });
  return meta.data.webViewLink;
}

// 取得下拉選單選項（日期 + 車次群組 + 客戶清單）
// date: 若傳入則只回傳該日期的車次與客戶；否則回傳所有日期
async function getDropdownOptions(date, spreadsheetId) {
  const sheetId = spreadsheetId || SPREADSHEET_ID;
  const auth = getAuth(['https://www.googleapis.com/auth/spreadsheets.readonly']);
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'A.採購明細總表!B:M',  // B=日期(0), C=客戶(1), M=車次(11)
  });

  const rows = (res.data.values || []).slice(1);
  const dates     = new Set();
  const vehicles  = new Set();
  const customers = new Set();

  for (const row of rows) {
    const rowDate    = (row[0]  || '').trim();  // B欄
    const rowCustomer = (row[1] || '').trim();  // C欄
    const rowVehicle = (row[11] || '').trim();  // M欄

    if (!rowDate || !rowDate.match(/^\d+\/\d+$/)) continue;
    if (SKIP_CUSTOMERS.has(rowCustomer)) continue;

    // 若有指定日期，跳過不符合的列
    if (date && rowDate !== date) continue;

    dates.add(rowDate);

    // 客戶
    if (rowCustomer) customers.add(rowCustomer);

    // 車次
    if (!rowVehicle || SKIP_VEHICLES.has(rowVehicle)) continue;
    if (rowVehicle === '自送')    { vehicles.add('自送');    continue; }
    if (rowVehicle === '日期錯誤') { vehicles.add('日期錯誤'); continue; }
    const prefix = rowVehicle.match(/^([A-Z]+)/)?.[1];
    if (prefix) vehicles.add(prefix);
  }

  // 日期升冪排列
  const sortedDates = [...dates].sort((a, b) => {
    const [am, ad] = a.split('/').map(Number);
    const [bm, bd] = b.split('/').map(Number);
    return bm !== am ? am - bm : ad - bd;
  });

  // 中文開頭放前面（依第二碼起 localeCompare 排序），英文開頭放後面（A-Z）
  const isChinese = v => /^[\u4e00-\u9fff]/.test(v);
  const sortedVehicles = [
    ...[...vehicles].filter(isChinese).sort((a, b) => a.slice(1).localeCompare(b.slice(1), 'zh-Hant')),
    ...[...vehicles].filter(v => !isChinese(v)).sort(),
  ];
  const sortedCustomers = [...customers].sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  return { dates: sortedDates, vehicles: sortedVehicles, customers: sortedCustomers };
}

// 主流程（背景執行）
// vehiclePrefixes: string[]  customers: string[]
async function processDeliveryPdf(jobId, date, vehiclePrefixes, jobs, customerNames, spreadsheetId) {
  try {
    jobs[jobId].status = 'reading';
    const rows = await readSheetData(date, vehiclePrefixes || [], customerNames || [], spreadsheetId);

    const byCustomer = Array.isArray(customerNames) && customerNames.length > 0;
    const modeLabel  = byCustomer
      ? customerNames.join('、')
      : (vehiclePrefixes || []).map(v => v === '自送' ? '自送' : `${v}車`).join('、');

    if (!rows.length) {
      jobs[jobId] = { status: 'error', error: `找不到 ${date} ${modeLabel} 的出貨資料` };
      return;
    }

    const stops = groupByStop(rows);
    jobs[jobId].status  = 'rendering';
    jobs[jobId].total   = stops.length;
    jobs[jobId].current = 0;

    const pdfBuffers = [];
    const skipped    = []; // 驗算不過的客戶清單
    for (const [key, stopRows] of stops) {
      const vehicle      = vehicleFromKey(key);
      const templateType = getTemplateType(stopRows);
      const customer = (
        stopRows[0]?.[C.CUSTOMER_GROUP] ||
        stopRows[0]?.[C.CUSTOMER] || ''
      ).trim();

      const validationErrors = validateRows(templateType, stopRows, C, customer);
      if (validationErrors.length > 0) {
        skipped.push({ customer, errors: validationErrors });
        jobs[jobId].current++;
        continue; // 跳過此客戶，繼續處理其他人
      }

      const html = renderHTML({ vehicle, customer, date, templateType, rows: stopRows, C });
      pdfBuffers.push(await renderPDF(html));
      jobs[jobId].current++;
    }

    if (pdfBuffers.length === 0) {
      jobs[jobId] = {
        status: 'error',
        error:  `所有客戶均驗算不通過，PDF 未產生。\n` + skipped.map(s =>
          `【${s.customer}】\n` + s.errors.map(e => `  ${e}`).join('\n')
        ).join('\n'),
      };
      return;
    }

    jobs[jobId].status = 'merging';
    const merged = await mergePDFs(pdfBuffers);

    jobs[jobId].status = 'uploading';
    const dateStr  = date.replace('/', '');
    const filename = `出貨明細_${modeLabel}_${dateStr}.pdf`;
    const driveUrl = await uploadToDrive(merged, filename);

    jobs[jobId] = {
      status:          'done',
      driveUrl,
      stopCount:       pdfBuffers.length,
      filename,
      vehicleSummary:  byCustomer ? '' : modeLabel,
      customerSummary: byCustomer ? modeLabel : '',
      skipped:         skipped.length > 0 ? skipped : undefined,
    };
  } catch (err) {
    jobs[jobId] = { status: 'error', error: err.message };
  }
}

module.exports = { processDeliveryPdf, getDropdownOptions };
