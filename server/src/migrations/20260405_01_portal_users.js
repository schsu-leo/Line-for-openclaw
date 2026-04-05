exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('employee_no', 20).unique();
    table.specificType('modules', 'TEXT[]').defaultTo('{cs,attendance,invoice}');
    table.boolean('is_active').defaultTo(true);
  });

  // Migrate existing roles to new role values
  await knex('users').where('role', '正職').update({ role: 'staff' });
  await knex('users').where('role', 'PT').update({ role: 'staff' });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('employee_no');
    table.dropColumn('modules');
    table.dropColumn('is_active');
  });
};
