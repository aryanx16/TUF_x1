import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { storage } from './storage.ts';
import { requireAuth, getCurrentUser, loginUser, logoutUser } from './auth.ts';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for Chrome extension
  credentials: true,
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dsa-confidence-tracker-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'DSA Confidence Tracker API is running' });
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, userId } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const user = await loginUser(req, email, userId);
    res.json({ user, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  logoutUser(req);
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
    const confidenceData = await storage.getUserConfidenceData(user.id);
    
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
    
    // Convert from Chrome extension format to database format
    const dataToSave = Object.entries(confidenceData).map(([problemId, confidenceLevel]) => ({
      problemId,
      confidenceLevel: String(confidenceLevel),
    }));
    
    await storage.saveConfidenceData(user.id, dataToSave);
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
    const { confidenceLevel, sheetName, problemTitle } = req.body;
    
    if (!confidenceLevel) {
      return res.status(400).json({ error: 'Confidence level is required' });
    }
    
    const updated = await storage.updateConfidence(user.id, problemId, confidenceLevel);
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
    const confidenceData = await storage.getUserConfidenceData(user.id);
    
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`DSA Confidence Tracker API server running on port ${PORT}`);
});

export default app;