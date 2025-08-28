-- Create tables for plans and user progress
CREATE TABLE IF NOT EXISTS plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  meta JSON,
  owner VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  entry_date DATE NOT NULL,
  weight DECIMAL(6,2) NULL,
  calories INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  INDEX (entry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional: table for revoked tokens already exists in create_tables.sql
