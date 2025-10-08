// healthcheck.js
const mysql = require('mysql2/promise');

async function checkHealth() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'macros_lab'
    });
    
    await connection.execute('SELECT 1');
    await connection.end();
    
    console.log('Health check passed');
    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

checkHealth();