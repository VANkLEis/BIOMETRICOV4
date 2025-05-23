// Database configuration file
// This file is for configuring the database connection
// You can add your Clever Cloud database credentials here

// Example connection URL provided:
// mysql://uzfyb5qsksggonb6:EzTIHa5sMafcbWiB8LpN@bdzwf9dkekzrefnaruf5-mysql.services.clever-cloud.com:3306/bdzwf9dkekzrefnaruf5

// Please fill in the appropriate values below
export const dbConfig = {
  host: 'bdzwf9dkekzrefnaruf5-mysql.services.clever-cloud.com',
  port: 3306,
  user: 'uzfyb5qsksggonb6',
  password: 'EzTIHa5sMafcbWiB8LpN',
  database: 'bdzwf9dkekzrefnaruf5',
  // Add any additional connection options below
  // connectionLimit: 10,
  // queueLimit: 0,
  // waitForConnections: true,
};

// Database tables
export const DB_TABLES = {
  USERS: 'users',
  FACIAL_DATA: 'facial_data',
  FINGERPRINT_DATA: 'fingerprint_data',
  VIDEO_SESSIONS: 'video_sessions'
};

/*
Table structure for reference:

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE facial_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  facial_data LONGBLOB,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE fingerprint_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  fingerprint_data LONGBLOB,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE video_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  caller_id INT NOT NULL,
  receiver_id INT NOT NULL,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NULL,
  status ENUM('initiated', 'connected', 'completed', 'failed') DEFAULT 'initiated',
  FOREIGN KEY (caller_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);
*/