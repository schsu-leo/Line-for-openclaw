exports.up = async function(knex) {
  // Update employees table: replace 'employee' role with 'staff' in roles array
  await knex.raw(`
    UPDATE employees
    SET roles = array_replace(roles, 'employee', 'staff')
    WHERE 'employee' = ANY(roles)
  `);
};
exports.down = async function(knex) {
  await knex.raw(`
    UPDATE employees
    SET roles = array_replace(roles, 'staff', 'employee')
    WHERE 'staff' = ANY(roles)
  `);
};
