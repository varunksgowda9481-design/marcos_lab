const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
<<<<<<< HEAD
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const ExpressBrute = require('express-brute');
const helmet = require('helmet');
const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
=======
>>>>>>> 143111130afd8df734b4fb919fd2b8655baa0146

const app = express();
const PORT = process.env.PORT || 3000;

<<<<<<< HEAD
// ==================== ENV VALIDATION ====================
const validateEnv = require('./config/env');

try {
  const validatedEnv = validateEnv();
  process.env = { ...process.env, ...validatedEnv };
  console.log('✅ Environment variables validated successfully');
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  process.exit(1);
}
// ==================== END ENV VALIDATION ====================

// Enhanced security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Additional middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static('public'));

// Prevent NoSQL injection
app.use(mongoSanitize());

// CSRF protection (for session-based authentication)
const csrfProtection = csrf({ cookie: true });
app.use('/api/', csrfProtection);

// Brute force protection
const store = new ExpressBrute.MemoryStore();
const bruteforce = new ExpressBrute(store, {
  freeRetries: 5,
  minWait: 5 * 60 * 1000, // 5 minutes
  maxWait: 60 * 60 * 1000, // 1 hour
  failCallback: (req, res, next, nextValidRequestDate) => {
    res.status(429).json({
      error: 'Too many attempts',
      retryAfter: Math.ceil((nextValidRequestDate - Date.now()) / 1000)
    });
  }
});

// Enhanced rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
};

// Database connection helper
async function getPool() {
  if (process.env.NODE_ENV === 'development') {
    // Use SQLite for development
    const db = new sqlite3.Database('./dev.sqlite3');
    
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
    
    return {
      query: async (sql, params) => {
        return new Promise((resolve, reject) => {
          db.all(sql, params, (err, rows) => {
            if (err) {
              console.error('SQLite query error:', err);
              reject(err);
            } else {
              resolve([rows]);
            }
          });
        });
      },
      execute: async (sql, params) => {
        return new Promise((resolve, reject) => {
          db.run(sql, params, function(err) {
            if (err) {
              console.error('SQLite execute error:', err);
              reject(err);
            } else {
              resolve([{ insertId: this.lastID, affectedRows: this.changes }]);
            }
          });
        });
      },
      end: async () => db.close()
    };
  } else {
    // Use MySQL for production
    const pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    return pool;
  }
}

// Initialize database
async function initDatabase() {
  const pool = await getPool();
  
  try {
    // Create users table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create diet_plans table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS diet_plans (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        age INTEGER,
        height FLOAT,
        weight FLOAT,
        gender VARCHAR(50),
        workout VARCHAR(255),
        goal VARCHAR(255),
        diet_preference VARCHAR(255),
        bmi FLOAT,
        breakfast TEXT,
        lunch TEXT,
        dinner TEXT,
        snacks TEXT,
        recommendations TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  } finally {
    if (pool.end) await pool.end();
  }
}

=======
// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

>>>>>>> 143111130afd8df734b4fb919fd2b8655baa0146
// Sample diet plans data structure
const dietPlans = {
  "vegetarian": {
    "weightloss": {
      "breakfast": "Oatmeal with fruits and nuts",
      "lunch": "Vegetable salad with quinoa",
      "dinner": "Grilled vegetables with tofu",
      "snacks": "Fruits, yogurt"
    },
    "weightgain": {
      "breakfast": "Whole grain toast with avocado and eggs",
      "lunch": "Bean and cheese burrito",
      "dinner": "Lentil curry with rice",
      "snacks": "Nuts, protein shake"
    },
    "maintain": {
      "breakfast": "Smoothie bowl with granola",
      "lunch": "Vegetable wrap with hummus",
      "dinner": "Vegetable stir fry with rice",
      "snacks": "Fruits, nuts"
    }
  },
  "non-vegetarian": {
    "weightloss": {
      "breakfast": "Scrambled eggs with vegetables",
      "lunch": "Grilled chicken salad",
      "dinner": "Baked fish with steamed vegetables",
      "snacks": "Greek yogurt, boiled eggs"
    },
    "weightgain": {
      "breakfast": "Protein pancakes with eggs",
      "lunch": "Chicken and rice bowl",
      "dinner": "Steak with sweet potato",
      "snacks": "Cottage cheese, protein shake"
    },
    "maintain": {
      "breakfast": "Omelette with whole grain toast",
      "lunch": "Turkey sandwich",
      "dinner": "Salmon with quinoa and vegetables",
      "snacks": "Nuts, protein bar"
    }
  }
};

<<<<<<< HEAD
// Authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    // Verify token (implementation depends on your auth strategy)
    // const decoded = verifyToken(token);
    // req.user = decoded;
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// CSRF verification middleware
const verifyCsrf = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  
  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
  if (!csrfToken || csrfToken !== req.csrfToken()) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

// API endpoint to generate diet plan
app.post('/api/generate-plan', authMiddleware, async (req, res) => {
=======
// API endpoint to generate diet plan
app.post('/generate-plan', (req, res) => {
>>>>>>> 143111130afd8df734b4fb919fd2b8655baa0146
  const userData = req.body;
  
  // Basic validation
  if (!userData.age || !userData.height || !userData.weight || 
      !userData.gender || !userData.workout || !userData.goal || !userData.dietPreference) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Calculate BMI
  const heightInM = userData.height / 100;
  const bmi = userData.weight / (heightInM * heightInM);
  
  // Get appropriate diet plan based on preferences
  let dietPlan;
  try {
    dietPlan = dietPlans[userData.dietPreference.toLowerCase()][userData.goal.toLowerCase()];
  } catch (error) {
    return res.status(400).json({ error: 'Could not generate diet plan with provided parameters' });
  }
  
  // Add personalized recommendations based on BMI
  let recommendations = [];
  if (bmi < 18.5) {
    recommendations.push("Consider increasing calorie intake for weight gain");
  } else if (bmi >= 25) {
    recommendations.push("Consider reducing calorie intake for weight loss");
  } else {
    recommendations.push("Your BMI is in the healthy range. Maintain your current habits");
  }
  
  // Add workout-specific recommendations
  if (userData.workout.toLowerCase().includes('intense')) {
    recommendations.push("Ensure adequate protein intake to support muscle recovery");
  }
  
  // Prepare response
  const response = {
    plan: dietPlan,
    bmi: bmi.toFixed(1),
    recommendations: recommendations,
    userData: userData
  };
  
<<<<<<< HEAD
  // Save to database
  try {
    const pool = await getPool();
    const planId = uuidv4();
    
    await pool.execute(
      `INSERT INTO diet_plans (id, user_id, age, height, weight, gender, workout, goal, diet_preference, bmi, breakfast, lunch, dinner, snacks, recommendations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planId,
        req.user?.id || null, // Link to user if authenticated
        userData.age,
        userData.height,
        userData.weight,
        userData.gender,
        userData.workout,
        userData.goal,
        userData.dietPreference,
        bmi,
        dietPlan.breakfast,
        dietPlan.lunch,
        dietPlan.dinner,
        dietPlan.snacks,
        recommendations.join('; ')
      ]
    );
    
    if (pool.end) await pool.end();
  } catch (error) {
    console.error('Error saving diet plan to database:', error);
    // Fallback to JSON file if database fails
    fs.readFile('data/diet-plans.json', 'utf8', (err, data) => {
      let plans = [];
      if (!err && data) {
        plans = JSON.parse(data);
      }
      plans.push({
        timestamp: new Date().toISOString(),
        ...response
      });
      
      fs.writeFile('data/diet-plans.json', JSON.stringify(plans, null, 2), (err) => {
        if (err) {
          console.error('Error saving diet plan to file:', err);
        }
      });
    });
  }
=======
  // Save to JSON file (simple database)
  fs.readFile('data/diet-plans.json', 'utf8', (err, data) => {
    let plans = [];
    if (!err && data) {
      plans = JSON.parse(data);
    }
    plans.push({
      timestamp: new Date().toISOString(),
      ...response
    });
    
    fs.writeFile('data/diet-plans.json', JSON.stringify(plans, null, 2), (err) => {
      if (err) {
        console.error('Error saving diet plan:', err);
      }
    });
  });
>>>>>>> 143111130afd8df734b4fb919fd2b8655baa0146
  
  res.json(response);
});

<<<<<<< HEAD
// API endpoint to get all saved plans (for authenticated users)
app.get('/api/plans', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT * FROM diet_plans WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    
    if (pool.end) await pool.end();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching plans:', error);
    
    // Fallback to JSON file
    fs.readFile('data/diet-plans.json', 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Unable to read plans data' });
      }
      res.json(JSON.parse(data));
    });
  }
});

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or email already exists
 */
app.post('/api/register', verifyCsrf, bruteforce.prevent, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const pool = await getPool();
    
    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password (in a real app, use bcrypt)
    // const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPassword = password; // Replace with actual hashing
    
    // Create user
    const userId = uuidv4();
    await pool.execute(
      'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
      [userId, name, email, hashedPassword]
    );
    
    if (pool.end) await pool.end();
    
    // Generate token (implementation depends on your auth strategy)
    // const token = generateToken(userId);
    
    res.status(201).json({ 
      message: 'User registered successfully',
      // token: token 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *       401:
 *         description: Unauthorized
 */
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const [users] = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (pool.end) await pool.end();
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(users[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CSRF token endpoint
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
=======
// API endpoint to get all saved plans (for debugging)
app.get('/plans', (req, res) => {
  fs.readFile('data/diet-plans.json', 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to read plans data' });
    }
    res.json(JSON.parse(data));
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
>>>>>>> 143111130afd8df734b4fb919fd2b8655baa0146
  // Create data directory if it doesn't exist
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data');
  }
<<<<<<< HEAD
  
=======
>>>>>>> 143111130afd8df734b4fb919fd2b8655baa0146
  // Initialize empty JSON file if it doesn't exist
  if (!fs.existsSync('data/diet-plans.json')) {
    fs.writeFileSync('data/diet-plans.json', '[]');
  }
<<<<<<< HEAD
  
  // Initialize database
  await initDatabase();
=======
>>>>>>> 143111130afd8df734b4fb919fd2b8655baa0146
});