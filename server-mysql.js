require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

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
    res.json({ok:true});
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
    const token = jwt.sign({id: user.id, name: user.name}, secret, {expiresIn: '7d'});
    res.json({ok:true,name:user.name, token});
  }catch(err){
    console.error(err);
    res.status(500).json({error:'Server error'});
  }
});

// Protected endpoint for client to get current user
app.get('/api/me', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({error: 'Missing token'});
  const token = auth.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
  try {
    const payload = jwt.verify(token, secret);
    res.json({ok:true, user: payload});
  } catch (err) {
    return res.status(401).json({error: 'Invalid token'});
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=> console.log('Server running on',PORT));
