exports.up = async function (knex) {
  await knex.schema.createTable('shipments', (table) => {
    table.increments('id').primary();
    table.date('date').notNullable();
    table.integer('customer_id').references('id').inTable('customers').nullable();
    table.string('customer_name', 200).notNullable();
    table.string('vehicle', 50).nullable();
    table.string('status', 20).notNullable().defaultTo('draft');
    table.string('invoice_no', 50).nullable();
    table.date('invoice_date').nullable();
    table.decimal('invoice_amount', 12, 2).nullable();
    table.timestamp('locked_at').nullable();
    table.timestamp('voided_at').nullable();
    table.text('void_reason').nullable();
    table.string('original_invoice_no', 50).nullable();
    table.text('notes').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.raw('CREATE INDEX idx_shipments_date ON shipments(date)');
  await knex.schema.raw('CREATE INDEX idx_shipments_customer_id ON shipments(customer_id)');
  await knex.schema.raw('CREATE INDEX idx_shipments_status ON shipments(status)');
};

exports.down = async function (knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_shipments_status');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_shipments_customer_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_shipments_date');
  await knex.schema.dropTableIfExists('shipments');
};
