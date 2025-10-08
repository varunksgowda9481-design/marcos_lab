exports.up = function(knex) {
  return knex.schema
    .createTable('users', (table) => {
      table.increments('id').primary();
      table.string('name', 255);
      table.string('email', 255).notNullable().unique();
      table.string('password', 255).notNullable();
      table.decimal('target_weight', 5, 2);
      table.integer('target_calories');
      table.integer('target_protein');
      table.integer('target_carbs');
      table.integer('target_fat');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('progress', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.date('entry_date').notNullable();
      table.decimal('weight', 5, 2);
      table.integer('calories');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['user_id', 'entry_date']);
    })
    .createTable('revoked_tokens', (table) => {
      table.increments('id').primary();
      table.string('jti', 255).notNullable().unique();
      table.timestamp('revoked_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('revoked_tokens')
    .dropTableIfExists('progress')
    .dropTableIfExists('users');
};
