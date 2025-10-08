require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const path = require('path');
const cookieParser = require('cookie-parser');
const { body, validationResult } = require('express-validator');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const helmet = require('helmet');

const app = express();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar] && process.env.NODE_ENV === 'production') {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

// Warn about default JWT secret
const secret = process.env.JWT_SECRET;
if (!secret || secret === 'dev_jwt_secret_change_me') {
  logger.warn('⚠️ WARNING: Using default JWT secret. Change this in production!');
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname)));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many authentication attempts, please try again later' }
});

const isProd = process.env.NODE_ENV === 'production';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'macros_lab',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

let pool;

// Database initialization
async function initializeDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    
    // Test connection
    const connection = await pool.getConnection();
    connection.release();
    
    // Create tables if they don't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        entry_date DATE NOT NULL,
        weight DECIMAL(5,2),
        calories INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX (user_id, entry_date)
      )
    `);
    
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS revoked_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        jti VARCHAR(255) UNIQUE NOT NULL,
        revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (jti)
      )
    `);
    
    logger.info('Database tables initialized successfully');
  } catch (err) {
    logger.error('Database initialization error:', err);
    throw err;
  }
}

async function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool;
}

// CSRF middleware
app.use((req, res, next) => {
  try {
    if (!req.cookies || !req.cookies.csrf_token) {
      const csrf = randomUUID();
      res.cookie('csrf_token', csrf, { 
        sameSite: 'Lax', 
        secure: isProd,
        httpOnly: true
      });
    }
  } catch (e) {
    logger.error('CSRF cookie error:', e);
  }
  next();
});

function verifyCsrf(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const header = req.get('x-csrf-token');
  const cookie = req.cookies && req.cookies.csrf_token;
  if (!header || !cookie || header !== cookie) {
    logger.warn('Invalid CSRF token attempt');
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  return next();
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.execute('SELECT 1');
    res.json({ 
      status: 'OK', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Health check failed:', err);
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'disconnected',
      error: err.message 
    });
  }
});

// Simple root health-check route
app.get('/', (req, res) => {
  res.send('✅ Macros Lab backend is running!');
});

// Registration endpoint with validation
app.post('/api/register', 
  verifyCsrf,
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').trim().isLength({ min: 1, max: 255 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    try {
      const pool = await getPool();
      const [rows] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
      if (rows.length) return res.status(400).json({ error: 'Email already registered' });
      
      const hash = await bcrypt.hash(password, 10);
      await pool.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hash]);
      
      const jti = randomUUID();
      const token = jwt.sign({ email, name, jti }, secret, { expiresIn: '7d', jwtid: jti });
      
      res.cookie('ml_token', token, { 
        httpOnly: true, 
        sameSite: 'Lax', 
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000 
      });
      
      res.json({ ok: true, token, name });
    } catch (err) {
      logger.error('Registration error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Login endpoint with validation
app.post('/api/login', 
  verifyCsrf,
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 1 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    try {
      const pool = await getPool();
      const [rows] = await pool.query('SELECT id, name, password FROM users WHERE email=?', [email]);
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
      
      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      
      const jti = randomUUID();
      const token = jwt.sign({ id: user.id, name: user.name, jti }, secret, { expiresIn: '7d', jwtid: jti });
      
      res.cookie('ml_token', token, { 
        httpOnly: true, 
        sameSite: 'Lax', 
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000 
      });
      
      res.json({ ok: true, name: user.name, token });
    } catch (err) {
      logger.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Authentication middleware
const authMiddleware = async (req, res, next) => {
  const token = (req.headers.authorization && req.headers.authorization.split(' ')[1]) || (req.cookies && req.cookies.ml_token);
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = jwt.verify(token, secret);
    const pool = await getPool();
    const jti = payload.jti;
    const [rows] = await pool.query('SELECT id FROM revoked_tokens WHERE jti = ? LIMIT 1', [jti]);
    if (rows && rows.length) {
      logger.warn('Attempt to use revoked token');
      return res.status(401).json({ error: 'Token revoked' });
    }
    req.user = payload;
    return next();
  } catch (err) {
    logger.warn('Invalid token attempt:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Protected endpoints
app.get('/api/me', authMiddleware, async (req, res) => {
  res.json({ ok: true, user: req.user });
});

// Diet plans endpoint
app.get('/api/plans', async (req, res) => {
  try {
    const q = (req.query.search || '').toLowerCase().trim();
    const plansPath = path.join(__dirname, 'data', 'diet-plans.json');
    const raw = await require('fs').promises.readFile(plansPath, 'utf8');
    let plans = JSON.parse(raw || '[]');
    
    if (q) {
      plans = plans.filter(p => JSON.stringify(p).toLowerCase().includes(q));
    }
    
    res.json({ ok: true, plans });
  } catch (err) {
    logger.error('Failed to load plans:', err);
    res.status(500).json({ error: 'Failed to load plans' });
  }
});

// Progress endpoints
app.post('/api/progress', 
  verifyCsrf,
  [
    body('date').isISO8601(),
    body('weight').optional().isFloat({ min: 0, max: 1000 }),
    body('calories').optional().isInt({ min: 0, max: 10000 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, weight, calories } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'date required' });
    }
    
    try {
      const pool = await getPool();
      let userId = null;
      
      try {
        const token = (req.cookies && req.cookies.ml_token) || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
        if (token) {
          const payload = jwt.verify(token, secret);
          userId = payload.id || null;
        }
      } catch (e) {
        // Not authenticated is acceptable for progress tracking
      }

      await pool.query(
        'INSERT INTO progress (user_id, entry_date, weight, calories, created_at) VALUES (?, ?, ?, ?, NOW())',
        [userId, date, weight || null, calories || null]
      );
      
      res.json({ ok: true });
    } catch (err) {
      logger.error('Failed to save progress:', err);
      res.status(500).json({ error: 'Failed to save progress' });
    }
  }
);

app.get('/api/progress', async (req, res) => {
  try {
    const pool = await getPool();
    let userId = null;
    
    try {
      const token = (req.cookies && req.cookies.ml_token) || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
      if (token) {
        const payload = jwt.verify(token, secret);
        userId = payload.id || null;
      }
    } catch (e) {
      // Ignore authentication errors for progress retrieval
    }

    let rows;
    if (userId) {
      [rows] = await pool.query(
        'SELECT entry_date as date, weight, calories FROM progress WHERE user_id = ? ORDER BY entry_date ASC',
        [userId]
      );
    } else {
      [rows] = await pool.query(
        'SELECT entry_date as date, weight, calories FROM progress WHERE user_id IS NULL ORDER BY entry_date ASC'
      );
    }
    
    res.json({ ok: true, progress: rows });
  } catch (err) {
    logger.error('Failed to fetch progress:', err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Protect the dashboard static page
app.get('/dashboard.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Logout endpoint
app.post('/api/logout', verifyCsrf, async (req, res) => {
  try {
    const token = req.cookies && req.cookies.ml_token;
    if (token) {
      const payload = jwt.verify(token, secret);
      const pool = await getPool();
      await pool.query('INSERT INTO revoked_tokens (jti, revoked_at) VALUES (?, NOW())', [payload.jti]);
    }
  } catch (e) {
    // Log but don't fail logout
    logger.warn('Logout error (non-critical):', e.message);
  }
  
  res.clearCookie('ml_token');
  res.json({ ok: true });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
