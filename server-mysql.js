require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const path = require('path');

const cookieParser = require('cookie-parser');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname)));

const isProd = process.env.NODE_ENV === 'production';

// Ensure a CSRF cookie is present (double-submit cookie pattern)
app.use((req, res, next) => {
  try {
    if (!req.cookies || !req.cookies.csrf_token) {
      const csrf = randomUUID();
      res.cookie('csrf_token', csrf, { sameSite: 'Lax', secure: isProd });
    }
  } catch (e) {}
  next();
});

function verifyCsrf(req, res, next) {
  // Only enforce for state-changing requests
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const header = req.get('x-csrf-token');
  const cookie = req.cookies && req.cookies.csrf_token;
  if (!header || !cookie || header !== cookie) return res.status(403).json({ error: 'Invalid CSRF token' });
  return next();
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'macros_lab'
};

async function getPool(){
  return mysql.createPool(dbConfig);
}

app.post('/api/register', verifyCsrf, async (req,res)=>{
  const {name,email,password} = req.body;
  if (!email || !password) return res.status(400).json({error:'Email and password required'});
  try{
    const pool = await getPool();
    const [rows] = await pool.query('SELECT id FROM users WHERE email=?',[email]);
    if (rows.length) return res.status(400).json({error:'Email already registered'});
    const hash = await bcrypt.hash(password,10);
    await pool.query('INSERT INTO users (name,email,password) VALUES (?,?,?)',[name,email,hash]);
  // Optionally sign token and set cookie
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
  const token = jwt.sign({email, name}, secret, {expiresIn: '7d'});
  res.cookie('ml_token', token, {httpOnly: true, sameSite: 'Lax'});
  res.json({ok:true, token});
  }catch(err){
    console.error(err);
    res.status(500).json({error:'Server error'});
  }
});

app.post('/api/login', verifyCsrf, async (req,res)=>{
  const {email,password} = req.body;
  if (!email || !password) return res.status(400).json({error:'Email and password required'});
  try{
    const pool = await getPool();
    const [rows] = await pool.query('SELECT id,name,password FROM users WHERE email=?',[email]);
    if (!rows.length) return res.status(401).json({error:'Invalid credentials'});
    const user = rows[0];
    const ok = await bcrypt.compare(password,user.password);
    if (!ok) return res.status(401).json({error:'Invalid credentials'});
    // Issue JWT
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
  const jti = randomUUID();
  const token = jwt.sign({id: user.id, name: user.name, jti}, secret, {expiresIn: '7d', jwtid: jti});
  res.cookie('ml_token', token, {httpOnly: true, sameSite: 'Lax', maxAge: 7*24*60*60*1000});
  res.json({ok:true,name:user.name, token});
  }catch(err){
    console.error(err);
    res.status(500).json({error:'Server error'});
  }
});

// Protected endpoint for client to get current user
const authMiddleware = async (req, res, next) => {
  const token = (req.headers.authorization && req.headers.authorization.split(' ')[1]) || (req.cookies && req.cookies.ml_token);
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
    const payload = jwt.verify(token, secret);
    // check revocation table
    const pool = await getPool();
    const jti = payload.jti || payload.jti;
    const [rows] = await pool.query('SELECT id FROM revoked_tokens WHERE jti = ? LIMIT 1', [jti]);
    if (rows && rows.length) {
      return res.status(401).json({ error: 'Token revoked' });
    }
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

app.get('/api/me', authMiddleware, async (req, res) => {
  res.json({ok:true, user: req.user});
});

// Return plans (reads from data/diet-plans.json) with optional search
app.get('/api/plans', async (req, res) => {
  try {
    const q = (req.query.search || '').toLowerCase().trim();
    const plansPath = path.join(__dirname, 'data', 'diet-plans.json');
    const raw = await require('fs').promises.readFile(plansPath, 'utf8');
    let plans = JSON.parse(raw || '[]');
    if (q) {
      plans = plans.filter(p => JSON.stringify(p).toLowerCase().includes(q));
    }
    res.json({ok:true, plans});
  } catch (err) {
    console.error('Failed to load plans', err);
    res.status(500).json({error:'Failed to load plans'});
  }
});

// Persist progress entries. If user authenticated, associate with user id; otherwise allow null owner.
app.post('/api/progress', verifyCsrf, async (req, res) => {
  const { date, weight, calories } = req.body || {};
  if (!date) {
    return res.status(400).json({ error: 'date required' });
  }
  try {
    const pool = await getPool();
    // try to get user id from token if present
    let userId = null;
    try {
      const token = (req.cookies && req.cookies.ml_token) || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
      if (token) {
        const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
        const payload = jwt.verify(token, secret);
        userId = payload.id || null;
      }
    } catch (e) { /* not authenticated */ }

    await pool.query('INSERT INTO progress (user_id, entry_date, weight, calories, created_at) VALUES (?,?,?,?,NOW())', [userId, date, weight || null, calories || null]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to save progress', err);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

// Fetch progress entries for the current user (or anonymous entries)
app.get('/api/progress', async (req, res) => {
  try {
    const pool = await getPool();
    let userId = null;
    try {
      const token = (req.cookies && req.cookies.ml_token) || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
      if (token) {
        const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
        const payload = jwt.verify(token, secret);
        userId = payload.id || null;
      }
    } catch (e) { /* ignore */ }

    let rows;
    if (userId) {
      [rows] = await pool.query('SELECT entry_date as date, weight, calories FROM progress WHERE user_id = ? ORDER BY entry_date ASC', [userId]);
    } else {
      [rows] = await pool.query('SELECT entry_date as date, weight, calories FROM progress WHERE user_id IS NULL ORDER BY entry_date ASC');
    }
    res.json({ ok: true, progress: rows });
  } catch (err) {
    console.error('Failed to fetch progress', err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Protect the dashboard static page
app.get('/dashboard.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.post('/api/logout', verifyCsrf, (req, res) => {
  try {
    const token = req.cookies && req.cookies.ml_token;
    if (token) {
      const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
      const payload = jwt.verify(token, secret);
      // insert into revoked_tokens
      getPool().then(pool => {
        pool.query('INSERT INTO revoked_tokens (jti, revoked_at) VALUES (?, NOW())', [payload.jti || payload.jti]).catch(()=>{});
      }).catch(()=>{});
    }
  } catch (e) {}
  res.clearCookie('ml_token');
  res.json({ok:true});
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=> console.log('Server running on',PORT));
