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

app.post('/api/register', async (req,res)=>{
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

app.post('/api/login', async (req,res)=>{
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

// Protect the dashboard static page
app.get('/dashboard.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.post('/api/logout', (req, res) => {
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
