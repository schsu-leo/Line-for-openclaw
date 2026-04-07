exports.up = async function (knex) {
  await knex.schema.createTable('credit_notes', (table) => {
    table.increments('id').primary();
    table.integer('customer_id').references('id').inTable('customers').nullable();
    table.string('customer_name', 200).notNullable();
    table.date('date').notNullable();
    table.decimal('amount', 12, 2).notNullable();
    table.text('reason').nullable();
    table.integer('related_shipment_id')
      .references('id').inTable('shipments').nullable();
    table.string('status', 20).notNullable().defaultTo('draft');
    table.string('invoice_no', 50).nullable();
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('credit_notes');
};
