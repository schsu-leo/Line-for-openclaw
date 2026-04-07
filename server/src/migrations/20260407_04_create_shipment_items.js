exports.up = async function (knex) {
  await knex.schema.createTable('shipment_items', (table) => {
    table.increments('id').primary();
    table.integer('shipment_id').notNullable()
      .references('id').inTable('shipments').onDelete('CASCADE');
    table.string('type', 20).notNullable().defaultTo('shipment');
    table.integer('product_version_id').nullable();
    table.string('product_name', 200).notNullable();
    table.string('unit', 50).notNullable();
    table.decimal('qty', 10, 3).nullable();
    table.decimal('unit_price', 10, 4).nullable();
    table.decimal('amount', 12, 2).nullable();
    table.decimal('cost', 12, 2).nullable();
    table.decimal('gross_profit', 12, 2).nullable();
    table.decimal('weight_kg', 10, 3).nullable();
    table.string('quality_note', 200).nullable();
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    'CREATE INDEX idx_shipment_items_shipment_id ON shipment_items(shipment_id)'
  );
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('shipment_items');
};
