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
    const createdSet = new Set();

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
        createdSet.add(newShipment.id);
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
    res.json({ created: createdSet.size, shipment_ids: [...new Set(shipmentIds)] });
  } catch (err) {
    await trx.rollback();
    next(err);
  }
}

/**
 * GET /api/shipments
 */
async function list(req, res, next) {
  const { customer_id, date_from, date_to, status, include_items } = req.query;

  try {
    let query = db('shipments').orderBy('date', 'desc').orderBy('id', 'desc');

    if (customer_id) query = query.where('customer_id', parseInt(customer_id));
    if (date_from)   query = query.where('date', '>=', date_from);
    if (date_to)     query = query.where('date', '<=', date_to);
    if (status)      query = query.where('status', status);

    const shipments = await query.select('*');

    if (include_items === 'true' && shipments.length > 0) {
      const ids = shipments.map((s) => s.id);
      const items = await db('shipment_items').whereIn('shipment_id', ids);

      const itemsMap = {};
      items.forEach((item) => {
        if (!itemsMap[item.shipment_id]) itemsMap[item.shipment_id] = [];
        itemsMap[item.shipment_id].push(item);
      });

      return res.json({
        shipments: shipments.map((s) => ({
          ...s,
          items: itemsMap[s.id] || [],
        })),
      });
    }

    res.json({ shipments });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/shipments/:id/returns
 */
async function addReturn(req, res, next) {
  const { id } = req.params;
  const { product_name, unit, qty, unit_price, amount, notes } = req.body;

  if (!product_name || !unit) {
    return res.status(400).json({ error: 'product_name 和 unit 為必填' });
  }

  try {
    const shipment = await db('shipments').where({ id }).first();
    if (!shipment) return res.status(404).json({ error: '找不到出貨單' });
    if (shipment.status === 'invoiced') {
      return res.status(403).json({
        error: '此出貨單已開立發票，請款前退貨需先作廢發票',
      });
    }

    const [item] = await db('shipment_items')
      .insert({
        shipment_id: parseInt(id),
        type: 'return',
        product_name,
        unit,
        qty: qty ? -Math.abs(parseFloat(qty)) : null,
        unit_price: unit_price || null,
        amount: amount ? -Math.abs(parseFloat(amount)) : null,
        notes: notes || null,
        created_at: new Date(),
      })
      .returning('*');

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/shipments/:id/invoice
 */
async function lockInvoice(req, res, next) {
  const { id } = req.params;
  const { invoice_no, invoice_date, invoice_amount } = req.body;

  if (!invoice_no || !invoice_date || invoice_amount == null) {
    return res.status(400).json({ error: 'invoice_no, invoice_date, invoice_amount 為必填' });
  }

  try {
    const shipment = await db('shipments').where({ id }).first();
    if (!shipment) return res.status(404).json({ error: '找不到出貨單' });
    if (shipment.status === 'invoiced') {
      return res.status(409).json({ error: '此出貨單已開立發票' });
    }

    const [updated] = await db('shipments')
      .where({ id })
      .update({
        status: 'invoiced',
        invoice_no,
        invoice_date,
        invoice_amount: parseFloat(invoice_amount),
        locked_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/shipments/:id/void-invoice
 */
async function voidInvoice(req, res, next) {
  const { id } = req.params;
  const { void_reason } = req.body;

  if (!void_reason || void_reason.trim() === '') {
    return res.status(400).json({ error: 'void_reason 為必填' });
  }

  try {
    const shipment = await db('shipments').where({ id }).first();
    if (!shipment) return res.status(404).json({ error: '找不到出貨單' });
    if (shipment.status !== 'invoiced') {
      return res.status(409).json({ error: '只有 invoiced 狀態的出貨單可以作廢' });
    }

    const [updated] = await db('shipments')
      .where({ id })
      .update({
        status: 'shipped',
        voided_at: new Date(),
        void_reason: void_reason.trim(),
        original_invoice_no: shipment.invoice_no,
        invoice_no: null,
        invoice_date: null,
        invoice_amount: null,
        locked_at: null,
        updated_at: new Date(),
      })
      .returning('*');

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { batchCreate, list, addReturn, lockInvoice, voidInvoice };
