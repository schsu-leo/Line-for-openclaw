const db = require('../config/db');

/**
 * POST /api/shipments/batch
 * 批次建立出貨單 + 品項（GAS 呼叫）
 */
async function batchCreate(req, res, next) {
  const { date, items } = req.body;

  if (!date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'date 和 items 為必填' });
  }

  const trx = await db.transaction();
  try {
    const shipmentIds = [];

    for (const item of items) {
      const { customer_id, customer_name, vehicle, products } = item;

      if (!customer_name || !Array.isArray(products) || products.length === 0) {
        await trx.rollback();
        return res.status(400).json({ error: `customer_name 和 products 為必填` });
      }

      // 查找現有的 shipment（同日 + 同客戶 + 同車次）
      let shipment = await trx('shipments')
        .where({ date, customer_name, vehicle: vehicle || null })
        .first();

      if (!shipment) {
        // 若 customer_id 未傳，嘗試從 customers 表查找
        let resolvedCustomerId = customer_id || null;
        if (!resolvedCustomerId && customer_name) {
          const customer = await trx('customers')
            .where('name', customer_name)
            .first();
          resolvedCustomerId = customer ? customer.id : null;
        }

        const [newShipment] = await trx('shipments')
          .insert({
            date,
            customer_id: resolvedCustomerId,
            customer_name,
            vehicle: vehicle || null,
            status: 'shipped',
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*');
        shipment = newShipment;
      }

      // 寫入品項
      const itemRows = products.map((p) => ({
        shipment_id: shipment.id,
        type: 'shipment',
        product_version_id: p.product_version_id || null,
        product_name: p.product_name,
        unit: p.unit,
        qty: p.qty || null,
        unit_price: p.unit_price || null,
        amount: p.amount || null,
        cost: p.cost || null,
        gross_profit: p.gross_profit || null,
        weight_kg: p.weight_kg || null,
        quality_note: p.quality_note || null,
        notes: p.notes || null,
        created_at: new Date(),
      }));

      await trx('shipment_items').insert(itemRows);
      shipmentIds.push(shipment.id);
    }

    await trx.commit();
    res.json({ created: shipmentIds.length, shipment_ids: [...new Set(shipmentIds)] });
  } catch (err) {
    await trx.rollback();
    next(err);
  }
}

/**
 * GET /api/shipments
 */
async function list(req, res, next) {
  // 實作於 Task 5
  res.json({ shipments: [] });
}

/**
 * POST /api/shipments/:id/returns
 */
async function addReturn(req, res, next) {
  // 實作於 Task 3
  res.status(501).json({ error: 'Not implemented' });
}

/**
 * POST /api/shipments/:id/invoice
 */
async function lockInvoice(req, res, next) {
  // 實作於 Task 4
  res.status(501).json({ error: 'Not implemented' });
}

/**
 * POST /api/shipments/:id/void-invoice
 */
async function voidInvoice(req, res, next) {
  // 實作於 Task 4
  res.status(501).json({ error: 'Not implemented' });
}

module.exports = { batchCreate, list, addReturn, lockInvoice, voidInvoice };
