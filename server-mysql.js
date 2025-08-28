require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
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
    res.json({ok:true,name:user.name});
  }catch(err){
    console.error(err);
    res.status(500).json({error:'Server error'});
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=> console.log('Server running on',PORT));
