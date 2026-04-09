// server/src/migrations/20260409_20_create_v_shipment_detail.js
exports.up = async function (knex) {
  await knex.raw(`
    CREATE OR REPLACE VIEW v_shipment_detail AS
    SELECT
      s.id              AS "出貨單ID",
      s.date            AS "日期",
      s.customer_name   AS "客戶名稱",
      s.customer_name_alias AS "客戶別名",
      s.customer_group  AS "客戶分組",
      s.vehicle         AS "車次",
      s.status          AS "狀態",
      s.invoice_no      AS "發票號碼",
      si.id             AS "明細ID",
      si.type           AS "類型",
      si.product_name   AS "商品名稱",
      si.unit           AS "單位",
      si.qty            AS "數量",
      si.unit_price     AS "單價",
      si.amount         AS "金額",
      si.cost           AS "成本",
      si.gross_profit   AS "毛利",
      si.weight_kg      AS "重量kg",
      si.quality_note   AS "品質備註"
    FROM shipments s
    JOIN shipment_items si ON si.shipment_id = s.id
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP VIEW IF EXISTS v_shipment_detail');
};
