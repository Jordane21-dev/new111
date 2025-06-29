import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smartbite_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

export const pool = mysql.createPool(dbConfig);

export async function initializeDatabase() {
  try {
    console.log(`Attempting to connect to MySQL at ${dbConfig.host}:${dbConfig.port}`);
    
    // Test the connection first
    const connection = await pool.getConnection();
    console.log('Successfully connected to MySQL database');
    connection.release();

    // Create database if it doesn't exist
    const adminConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await adminConnection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    console.log(`Database ${dbConfig.database} created or already exists`);
    await adminConnection.end();

    // Ensure all tables exist and are properly structured
    await ensureTablesExist();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

async function ensureTablesExist() {
  try {
    // Check what tables already exist
    const [existingTables] = await pool.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?",
      [dbConfig.database]
    );
    
    const tableNames = existingTables.map(row => row.TABLE_NAME);
    console.log('Existing tables:', tableNames);

    // Ensure users table exists with all required columns
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('customer', 'owner', 'agent', 'admin') DEFAULT 'customer',
        phone_number VARCHAR(20),
        town VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Users table ready');

    // Ensure restaurants_info table exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS restaurants_info (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        image VARCHAR(500),
        town VARCHAR(100) NOT NULL,
        address VARCHAR(500) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        delivery_time VARCHAR(50) NOT NULL,
        delivery_fee DECIMAL(10,2) NOT NULL,
        min_order DECIMAL(10,2) NOT NULL,
        rating DECIMAL(3,2) DEFAULT 0.0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_restaurant (user_id)
      )
    `);
    console.log('✓ Restaurants info table ready');

    // Ensure restaurant_categories table exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS restaurant_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants_info(id) ON DELETE CASCADE,
        UNIQUE KEY unique_restaurant_category (restaurant_id, category)
      )
    `);
    console.log('✓ Restaurant categories table ready');

    // Ensure menu_items table exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS menu_items (
        menu_id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        item_description TEXT,
        item_price DECIMAL(10,2) NOT NULL,
        category VARCHAR(100) DEFAULT 'Main Course',
        prep_time INT DEFAULT 15,
        is_available BOOLEAN DEFAULT true,
        image VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants_info(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Menu items table ready');

    // Ensure orders table exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        restaurant_id INT NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        status ENUM('pending', 'preparing', 'ready', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending',
        delivery_address TEXT NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'cash',
        payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
        agent_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants_info(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES users(user_id) ON DELETE SET NULL
      )
    `);
    console.log('✓ Orders table ready');

    // Ensure order_items table exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        menu_item_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Order items table ready');

    // Ensure delivery_locations table exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS delivery_locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        agent_id INT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Delivery locations table ready');

    // Create default admin user if it doesn't exist
    await createDefaultAdmin();

  } catch (error) {
    console.error('Error ensuring tables exist:', error);
    throw error;
  }
}

async function createDefaultAdmin() {
  try {
    const [adminExists] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ? AND role = ?',
      ['admin@smartbite.cm', 'admin']
    );

    if (adminExists.length === 0) {
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await pool.execute(
        'INSERT INTO users (name, email, password, role, town, phone_number) VALUES (?, ?, ?, ?, ?, ?)',
        ['SmartBite Admin', 'admin@smartbite.cm', hashedPassword, 'admin', 'Douala', '+237600000000']
      );
      console.log('✓ Default admin user created');
    } else {
      console.log('✓ Default admin user already exists');
    }
  } catch (error) {
    console.log('Note: Could not create default admin:', error.message);
  }
}