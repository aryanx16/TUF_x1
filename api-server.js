import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import 'dotenv/config';
// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;
import { eq, and } from "drizzle-orm";
import { 
  pgTable, 
  varchar, 
  timestamp, 
  text, 
  jsonb, 
  index
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Database setup - clean the DATABASE_URL
const databaseUrl = process.env.DATABASE_URL?.replace(/^DATABASE_URL=/, '') || process.env.DATABASE_URL;
const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle({ client: pool });

// Schema definitions
const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  password: varchar("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

const dsaConfidence = pgTable("dsa_confidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  problemId: varchar("problem_id").notNull(),
  confidenceLevel: varchar("confidence_level").notNull(),
  sheetName: varchar("sheet_name"),
  problemTitle: text("problem_title"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests from Chrome extensions (no origin) and localhost
    if (!origin || origin.startsWith('chrome-extension://') || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dsa-confidence-tracker-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Simple auth functions
function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

async function getCurrentUser(req) {
  if (!req.session?.userId) {
    return null;
  }
  const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
  return user || null;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'DSA Confidence Tracker API is running' });
});

// Authentication routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Check if user already exists
    const [existingUser] = await db.select().from(users).where(eq(users.username, username));
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        username: username,
        password: password, // In production, hash this password
      })
      .returning();
    
    req.session.userId = newUser.id;
    req.session.username = newUser.username;
    
    res.json({ user: newUser, message: 'Account created successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user by username
    const [user] = await db.select().from(users).where(eq(users.username, username));
    
    if (!user || user.password !== password) { // In production, use proper password hashing
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    req.session.userId = user.id;
    req.session.username = user.username;
    
    res.json({ user, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout successful' });
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// DSA Confidence routes
app.get('/api/confidence', requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const confidenceData = await db
      .select()
      .from(dsaConfidence)
      .where(eq(dsaConfidence.userId, user.id));
    
    // Convert to the format expected by the Chrome extension
    const formattedData = {};
    confidenceData.forEach(item => {
      formattedData[item.problemId] = item.confidenceLevel;
    });
    
    res.json(formattedData);
  } catch (error) {
    console.error('Get confidence data error:', error);
    res.status(500).json({ error: 'Failed to get confidence data' });
  }
});

app.post('/api/confidence/sync', requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const { confidenceData } = req.body;
    
    if (!confidenceData || typeof confidenceData !== 'object') {
      return res.status(400).json({ error: 'Invalid confidence data' });
    }
    
    // Save each confidence entry
    for (const [problemId, confidenceLevel] of Object.entries(confidenceData)) {
      await db
        .insert(dsaConfidence)
        .values({
          userId: user.id,
          problemId: problemId,
          confidenceLevel: String(confidenceLevel),
        })
        .onConflictDoUpdate({
          target: [dsaConfidence.userId, dsaConfidence.problemId],
          set: {
            confidenceLevel: String(confidenceLevel),
            updatedAt: new Date(),
          },
        });
    }
    
    res.json({ message: 'Confidence data synced successfully' });
  } catch (error) {
    console.error('Sync confidence data error:', error);
    res.status(500).json({ error: 'Failed to sync confidence data' });
  }
});

app.put('/api/confidence/:problemId', requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const { problemId } = req.params;
    const { confidenceLevel } = req.body;
    
    if (!confidenceLevel) {
      return res.status(400).json({ error: 'Confidence level is required' });
    }
    
    const [updated] = await db
      .insert(dsaConfidence)
      .values({
        userId: user.id,
        problemId: problemId,
        confidenceLevel: confidenceLevel,
      })
      .onConflictDoUpdate({
        target: [dsaConfidence.userId, dsaConfidence.problemId],
        set: {
          confidenceLevel: confidenceLevel,
          updatedAt: new Date(),
        },
      })
      .returning();
      
    res.json({ confidence: updated });
  } catch (error) {
    console.error('Update confidence error:', error);
    res.status(500).json({ error: 'Failed to update confidence' });
  }
});

// Statistics endpoint
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const confidenceData = await db
      .select()
      .from(dsaConfidence)
      .where(eq(dsaConfidence.userId, user.id));
    
    const stats = {
      total: confidenceData.length,
      none: 0,
      low: 0,
      medium: 0,
      high: 0,
      expert: 0,
    };
    
    confidenceData.forEach(item => {
      if (stats.hasOwnProperty(item.confidenceLevel)) {
        stats[item.confidenceLevel]++;
      }
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Drop tables endpoint (for development)
app.post('/api/drop-tables', async (req, res) => {
  try {
    await db.execute(sql`DROP TABLE IF EXISTS dsa_confidence CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS users CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS sessions CASCADE`);
    res.json({ message: 'Tables dropped successfully' });
  } catch (error) {
    console.error('Drop tables error:', error);
    res.status(500).json({ error: 'Failed to drop tables' });
  }
});

// Database setup endpoint
app.post('/api/setup-database', async (req, res) => {
  try {
    // Create tables if they don't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      )
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire)
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR UNIQUE NOT NULL,
        password VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
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
    
    res.json({ message: 'Database tables created successfully' });
  } catch (error) {
    console.error('Database setup error:', error);
    res.status(500).json({ error: 'Failed to setup database' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`DSA Confidence Tracker API server running on port ${PORT}`);
});

export default app;