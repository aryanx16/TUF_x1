import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from "drizzle-orm";
import ws from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

const databaseUrl = process.env.DATABASE_URL?.replace(/^DATABASE_URL=/, '') || process.env.DATABASE_URL;
const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle({ client: pool });

async function setupDatabase() {
  try {
    console.log('Setting up database tables...');
    
    // Create sessions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      )
    `);
    console.log('✓ Sessions table created');
    
    // Create session index
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire)
    `);
    console.log('✓ Session index created');
    
    // Create users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR UNIQUE NOT NULL,
        first_name VARCHAR,
        last_name VARCHAR,
        profile_image_url VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Users table created');
    
    // Create dsa_confidence table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS dsa_confidence (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        problem_id VARCHAR NOT NULL,
        confidence_level VARCHAR NOT NULL,
        sheet_name VARCHAR,
        problem_title TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, problem_id)
      )
    `);
    console.log('✓ DSA confidence table created');
    
    console.log('✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

setupDatabase();