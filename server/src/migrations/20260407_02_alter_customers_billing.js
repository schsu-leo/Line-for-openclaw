exports.up = async function (knex) {
  await knex.schema.alterTable('customers', (table) => {
    table.integer('billing_start_day');
    table.integer('billing_end_day');
    table.string('customer_type', 100);
    table.string('customer_group', 100);
    table.string('acquisition_month', 20);
    table.string('name_alias', 200);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('customers', (table) => {
    table.dropColumn('billing_start_day');
    table.dropColumn('billing_end_day');
    table.dropColumn('customer_type');
    table.dropColumn('customer_group');
    table.dropColumn('acquisition_month');
    table.dropColumn('name_alias');
  });
};
