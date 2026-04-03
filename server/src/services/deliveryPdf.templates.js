// 出貨明細 HTML 模板 — 5 種型態

const HEADER = `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Microsoft JhengHei', '微軟正黑體', Arial, sans-serif; font-size: 15px; color: #222; }
  .page { padding: 6mm; }
  .company-header { text-align: center; margin-bottom: 4px; }
  .company-header h1 { font-size: 20px; font-weight: bold; letter-spacing: 2px; }
  .company-header .info { font-size: 14px; color: #444; margin-top: 2px; }
  .doc-title { text-align: center; font-size: 17px; font-weight: bold;
               border: 2px solid #333; padding: 3px 0; margin: 5px 0; }
  .meta { display: flex; gap: 16px; margin-bottom: 6px; font-size: 15px; }
  .meta span { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { background: #d4edda; color: #222; padding: 4px 5px;
       border: none; font-size: 14px; text-align: center; font-weight: bold; }
  td { padding: 3px 5px; border: 1px solid #ccc; vertical-align: middle; }
  tr:nth-child(even) { background: #f5faf6; }
  .total-row { background: #d4edda !important; font-weight: bold; }
  .total-row td { border-top: 2px solid #2a5233; }
  .footer { margin-top: 8px; font-size: 13px; color: #666; text-align: right; }
  .inout-in  { color: #155724; font-weight: bold; }
  .inout-out { color: #721c24; font-weight: bold; }
</style>`;

function companyHeader() {
  return `<div class="company-header">
    <h1>尚仁蔬果</h1>
    <div class="info">尚仁實業(股)公司　統編：85018157　地址：新北市中和區建一路95號2樓　TEL：02-2302-6502</div>
  </div>`;
}

function metaRow(customer, date) {
  return `<div class="meta">
    <div>客戶：<span>${customer}</span></div>
    <div>日期：<span>${date}</span></div>
  </div>`;
}

function safeVal(row, idx, fallback = '') {
  return (row && row[idx] != null && row[idx] !== '') ? row[idx] : fallback;
}

// 格式化：出貨重 → 小數2位
function fmtWeight(val) {
  const n = parseFloat(val);
  return isNaN(n) ? (val || '') : n.toFixed(2);
}

// 格式化：單價 → $xx,xxx.x（小數1位 + 千分位 + $）
function fmtPrice(val) {
  const n = parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(n) || val === '') return '';
  const [int, dec] = n.toFixed(1).split('.');
  return '$' + int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + dec;
}

// 格式化：貨款 → $xx,xxx（整數 + 千分位 + $）
function fmtTotal(val) {
  const n = parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(n) || val === '') return '';
  return '$' + Math.round(n).toLocaleString();
}

// ── 1. 時價客戶 (AM=公斤) ─────────────────────────────
function renderKg({ vehicle, customer, date, rows, C }) {
  const items = rows.map((r, i) => `
    <tr>
      <td style="text-align:center">${safeVal(r, C.SEQ, i + 1)}</td>
      <td>${safeVal(r, C.PRODUCT)}</td>
      <td style="text-align:center">${safeVal(r, C.UNIT_KG)}</td>
      <td style="text-align:right">${fmtWeight(safeVal(r, C.WEIGHT))}</td>
      <td style="text-align:right">${fmtPrice(safeVal(r, C.PRICE))}</td>
      <td style="text-align:right">${fmtTotal(safeVal(r, C.TOTAL))}</td>
    </tr>`).join('');

  const grandTotal = rows.reduce((s, r) => {
    const v = parseFloat(safeVal(r, C.TOTAL, 0));
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${HEADER}</head><body><div class="page">
    ${companyHeader()}
    <div class="doc-title">出貨明細</div>
    ${metaRow(customer, date)}
    <table>
      <thead><tr>
        <th style="width:6%">序號</th>
        <th style="width:30%">品名</th>
        <th style="width:10%">單位</th>
        <th style="width:14%">出貨重(kg/包)</th>
        <th style="width:14%">單價</th>
        <th style="width:14%">貨款</th>
      </tr></thead>
      <tbody>${items}
        <tr class="total-row">
          <td colspan="5" style="text-align:right">合計</td>
          <td style="text-align:right">${grandTotal > 0 ? '$' + Math.round(grandTotal).toLocaleString() : ''}</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">列印時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</div>
  </div></body></html>`;
}

// ── 2. 無單價 (AM=無單價-公斤) ──────────────────────────
function renderNoPrice({ vehicle, customer, date, rows, C }) {
  const items = rows.map((r, i) => `
    <tr>
      <td style="text-align:center">${safeVal(r, C.SEQ, i + 1)}</td>
      <td>${safeVal(r, C.PRODUCT)}</td>
      <td style="text-align:center">${safeVal(r, C.UNIT_KG)}</td>
      <td style="text-align:right">${fmtWeight(safeVal(r, C.WEIGHT))}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${HEADER}</head><body><div class="page">
    ${companyHeader()}
    <div class="doc-title">出貨明細（無單價）</div>
    ${metaRow(customer, date)}
    <table>
      <thead><tr>
        <th style="width:8%">序號</th>
        <th style="width:50%">品名</th>
        <th style="width:15%">單位</th>
        <th style="width:20%">出貨重(kg/包)</th>
      </tr></thead>
      <tbody>${items}</tbody>
    </table>
    <div class="footer">列印時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</div>
  </div></body></html>`;
}

// ── 3. 報價制 (AM=報價制專用) ────────────────────────────
function renderQuoted({ vehicle, customer, date, rows, C }) {
  const items = rows.map((r, i) => {
    const inOut = safeVal(r, C.IN_OUT);
    const inOutClass = inOut === '退貨' ? 'inout-out' : 'inout-in';
    return `<tr>
      <td style="text-align:center">${safeVal(r, C.SEQ, i + 1)}</td>
      <td class="${inOutClass}" style="text-align:center">${inOut}</td>
      <td>${safeVal(r, C.PRODUCT)}</td>
      <td style="text-align:right">${fmtWeight(safeVal(r, C.WEIGHT_CONV))}</td>
      <td style="text-align:center">${safeVal(r, C.UNIT_QUOTE)}</td>
      <td style="text-align:right">${fmtPrice(safeVal(r, C.PRICE_QUOTE))}</td>
      <td style="text-align:right">${fmtTotal(safeVal(r, C.TOTAL_QUOTE))}</td>
    </tr>`;
  }).join('');

  const grandTotal = rows.reduce((s, r) => {
    const v = parseFloat(safeVal(r, C.TOTAL_QUOTE, 0));
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${HEADER}</head><body><div class="page">
    ${companyHeader()}
    <div class="doc-title">出貨明細</div>
    ${metaRow(customer, date)}
    <table>
      <thead><tr>
        <th style="width:6%">序號</th>
        <th style="width:9%">進/退</th>
        <th style="width:28%">品名</th>
        <th style="width:13%">出貨重</th>
        <th style="width:10%">單位</th>
        <th style="width:13%">報價</th>
        <th style="width:13%">貨款</th>
      </tr></thead>
      <tbody>${items}
        <tr class="total-row">
          <td colspan="6" style="text-align:right">合計</td>
          <td style="text-align:right">${grandTotal > 0 ? '$' + Math.round(grandTotal).toLocaleString() : ''}</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">列印時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</div>
  </div></body></html>`;
}

// ── 4. 阿爾法 (AM=報價制-阿爾法) ────────────────────────
function renderAlpha({ vehicle, customer, date, rows, C }) {
  const items = rows.map((r, i) => {
    const inOut = safeVal(r, C.IN_OUT);
    const inOutClass = inOut === '退貨' ? 'inout-out' : 'inout-in';
    return `<tr>
      <td style="text-align:center">${safeVal(r, C.SEQ, i + 1)}</td>
      <td class="${inOutClass}" style="text-align:center">${inOut}</td>
      <td style="text-align:center;font-size:13px">${safeVal(r, C.ALPHA_CODE)}</td>
      <td>${safeVal(r, C.PRODUCT)}</td>
      <td style="text-align:right">${fmtWeight(safeVal(r, C.WEIGHT_CONV))}</td>
      <td style="text-align:center">${safeVal(r, C.UNIT_QUOTE)}</td>
      <td style="text-align:right">${fmtPrice(safeVal(r, C.PRICE_QUOTE))}</td>
      <td style="text-align:right">${fmtTotal(safeVal(r, C.TOTAL_QUOTE))}</td>
    </tr>`;
  }).join('');

  const grandTotal = rows.reduce((s, r) => {
    const v = parseFloat(safeVal(r, C.TOTAL_QUOTE, 0));
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${HEADER}</head><body><div class="page">
    ${companyHeader()}
    <div class="doc-title">出貨明細（阿爾法-營業）</div>
    ${metaRow(customer, date)}
    <table>
      <thead><tr>
        <th style="width:6%">序號</th>
        <th style="width:8%">進/退</th>
        <th style="width:11%">料號</th>
        <th style="width:24%">品名</th>
        <th style="width:11%">出貨重</th>
        <th style="width:9%">單位</th>
        <th style="width:11%">報價</th>
        <th style="width:11%">貨款</th>
      </tr></thead>
      <tbody>${items}
        <tr class="total-row">
          <td colspan="7" style="text-align:right">合計</td>
          <td style="text-align:right">${grandTotal > 0 ? '$' + Math.round(grandTotal).toLocaleString() : ''}</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">列印時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</div>
  </div></body></html>`;
}

// ── 5. 亞東醫院 ───────────────────────────────────────
function renderYadong({ vehicle, customer, date, rows, C }) {
  const useDate = rows[0] ? safeVal(rows[0], C.USE_DATE) : '';
  const items = rows.map((r, i) => `
    <tr>
      <td style="text-align:center">${safeVal(r, C.YADONG_SEQ, i + 1)}</td>
      <td>${safeVal(r, C.PRODUCT)}</td>
      <td style="text-align:center">${safeVal(r, C.UNIT_KG)}</td>
      <td style="text-align:right">${fmtWeight(safeVal(r, C.YADONG_WEIGHT))}</td>
    </tr>`).join('');

  const grandTotal = rows.reduce((s, r) => {
    const v = parseFloat(safeVal(r, C.YADONG_WEIGHT, 0));
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${HEADER}</head><body><div class="page">
    ${companyHeader()}
    <div class="doc-title">出貨明細（亞東醫院）</div>
    <div class="meta">
      <div>客戶：<span>${customer}</span></div>
      <div>出貨日：<span>${date}</span></div>
      ${useDate ? `<div>使用日：<span>${useDate}</span></div>` : ''}
    </div>
    <table>
      <thead><tr>
        <th style="width:8%">序號</th>
        <th style="width:46%">品名</th>
        <th style="width:14%">單位</th>
        <th style="width:20%">出貨重(kg)</th>
      </tr></thead>
      <tbody>${items}
        <tr class="total-row">
          <td colspan="3" style="text-align:right">合計 kg</td>
          <td style="text-align:right">${grandTotal > 0 ? grandTotal.toFixed(2) : ''}</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">列印時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</div>
  </div></body></html>`;
}

// ── 主入口 ────────────────────────────────────────────
function renderHTML(params) {
  switch (params.templateType) {
    case 'no_price': return renderNoPrice(params);
    case 'quoted':   return renderQuoted(params);
    case 'alpha':    return renderAlpha(params);
    case 'yadong':   return renderYadong(params);
    default:         return renderKg(params);
  }
}

module.exports = { renderHTML };
