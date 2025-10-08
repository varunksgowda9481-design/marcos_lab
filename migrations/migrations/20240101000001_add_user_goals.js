// migrations/20240101000001_add_user_goals.js
exports.up = function(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.decimal('target_weight', 5, 2);
    table.integer('target_calories');
    table.integer('target_protein');
    table.integer('target_carbs');
    table.integer('target_fat');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('target_weight');
    table.dropColumn('target_calories');
    table.dropColumn('target_protein');
    table.dropColumn('target_carbs');
    table.dropColumn('target_fat');
  });
};