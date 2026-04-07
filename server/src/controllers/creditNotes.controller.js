const db = require('../config/db');

/**
 * POST /api/credit-notes
 */
async function create(req, res, next) {
  const { customer_id, customer_name, date, amount, reason, related_shipment_id } = req.body;

  if (!customer_name || !date || amount == null) {
    return res.status(400).json({ error: 'customer_name, date, amount 為必填' });
  }

  try {
    if (related_shipment_id) {
      const shipment = await db('shipments').where({ id: related_shipment_id }).first();
      if (!shipment) {
        return res.status(404).json({ error: '找不到關聯的出貨單' });
      }
    }

    let resolvedCustomerId = customer_id || null;
    if (!resolvedCustomerId && customer_name) {
      const customer = await db('customers').where('name', customer_name).first();
      resolvedCustomerId = customer ? customer.id : null;
    }

    const [note] = await db('credit_notes')
      .insert({
        customer_id: resolvedCustomerId,
        customer_name,
        date,
        amount: parseFloat(amount),
        reason: reason || null,
        related_shipment_id: related_shipment_id || null,
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/credit-notes
 */
async function list(req, res, next) {
  const { customer_id, date_from, date_to, status } = req.query;

  try {
    let query = db('credit_notes').orderBy('date', 'desc');

    if (customer_id) query = query.where('customer_id', parseInt(customer_id));
    if (date_from)   query = query.where('date', '>=', date_from);
    if (date_to)     query = query.where('date', '<=', date_to);
    if (status)      query = query.where('status', status);

    const notes = await query.select('*');
    res.json({ credit_notes: notes });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list };
