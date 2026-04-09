// T4: Refresh Token 機制
exports.up = (knex) => knex.schema.createTable('refresh_tokens', (t) => {
  t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
  t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
  t.text('token_hash').notNullable().unique();
  t.timestamp('expires_at').notNullable();
  t.boolean('revoked').defaultTo(false);
  t.timestamp('created_at').defaultTo(knex.fn.now());
});

exports.down = (knex) => knex.schema.dropTable('refresh_tokens');
