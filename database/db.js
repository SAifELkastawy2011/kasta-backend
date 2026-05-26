import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

console.log('=== Database Connection Debug ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('Connection string (first 50 chars):', connectionString.substring(0, 50) + '...');
console.log('================================');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }, // Required for Neon
  connectionTimeoutMillis: 5000,
  max: 10,
});

pool.on('connect', async (client) => {
  console.log('🔌 New client connected to pool');
  try {
    const result = await client.query('SELECT current_database() as db_name');
    console.log('📁 Connected to database:', result.rows[0].db_name);
  } catch (err) {
    console.error('Failed to get database info:', err.message);
  }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected pool error:', err.message);
});

export default pool;