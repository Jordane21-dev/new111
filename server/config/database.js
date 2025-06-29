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

    // Adapt to existing schema
    await adaptToExistingSchema();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

async function adaptToExistingSchema() {
  try {
    // Check what tables already exist
    const [existingTables] = await pool.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?",
      [dbConfig.database]
    );
    
    const tableNames = existingTables.map(row => row.TABLE_NAME);
    console.log('Existing tables:', tableNames);

    // Add missing columns to users table
    if (tableNames.includes('users')) {
      const [userColumns] = await pool.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
      `, [dbConfig.database]);
      
      const columnNames = userColumns.map(row => row.COLUMN_NAME);

      // Add missing columns
      const columnsToAdd = [
        { name: 'password', definition: 'VARCHAR(255)' },
        { name: 'role', definition: 'ENUM("customer", "owner", "agent", "admin") DEFAULT "customer"' },
        { name: 'town', definition: 'VARCHAR(100)' },
        { name: 'is_active', definition: 'BOOLEAN DEFAULT true' },
        { name: 'created_at', definition: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
        { name: 'updated_at', definition: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
      ];

      for (const column of columnsToAdd) {
        if (!columnNames.includes(column.name)) {
          try {
            await pool.execute(`ALTER TABLE users ADD COLUMN ${column.name} ${column.definition}`);
            console.log(`✓ Added ${column.name} column to users table`);
          } catch (err) {
            console.log(`- Column ${column.name} might already exist`);
          }
        }
      }
    }

    // Create restaurants_info table for restaurant details
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
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Restaurants info table ready');

    // Create restaurant_categories table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS restaurant_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants_info(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Restaurant categories table ready');

    // Handle menu_items table conflict
    await handleMenuItemsTable();

    // Enhance existing orders table
    const [orderColumns] = await pool.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'
    `, [dbConfig.database]).catch(() => [[]]);
    
    if (orderColumns.length > 0) {
      const columnNames = orderColumns.map(row => row.COLUMN_NAME);
      
      const columnsToAdd = [
        { name: 'restaurant_id', definition: 'INT' },
        { name: 'delivery_address', definition: 'TEXT' },
        { name: 'customer_phone', definition: 'VARCHAR(20)' },
        { name: 'payment_method', definition: 'VARCHAR(50) DEFAULT "cash"' },
        { name: 'payment_status', definition: 'ENUM("pending", "paid", "failed") DEFAULT "pending"' },
        { name: 'agent_id', definition: 'INT' }
      ];

      for (const column of columnsToAdd) {
        if (!columnNames.includes(column.name)) {
          try {
            await pool.execute(`ALTER TABLE orders ADD COLUMN ${column.name} ${column.definition}`);
            console.log(`✓ Added ${column.name} column to orders table`);
          } catch (err) {
            console.log(`- Column ${column.name} might already exist`);
          }
        }
      }
    }

    // Create default admin user
    await createDefaultAdmin();

  } catch (error) {
    console.error('Error adapting schema:', error);
    throw error;
  }
}

async function handleMenuItemsTable() {
  try {
    // Check if menu_items exists and what type it is
    const [menuItemsInfo] = await pool.execute(`
      SELECT TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'menu_items'
    `, [dbConfig.database]);

    if (menuItemsInfo.length > 0) {
      // Drop existing menu_items (whether it's a table or view)
      if (menuItemsInfo[0].TABLE_TYPE === 'VIEW') {
        await pool.execute('DROP VIEW IF EXISTS menu_items');
        console.log('✓ Dropped existing menu_items view');
      } else {
        await pool.execute('DROP TABLE IF EXISTS menu_items');
        console.log('✓ Dropped existing menu_items table');
      }
    }

    // Now create the proper menu_items table
    await pool.execute(`
      CREATE TABLE menu_items (
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
    console.log('✓ Created new menu_items table');

    // If there's an existing menu table, migrate data
    const [existingTables] = await pool.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'menu'",
      [dbConfig.database]
    );

    if (existingTables.length > 0) {
      // Check if menu table has data and migrate it
      const [menuData] = await pool.execute('SELECT * FROM menu LIMIT 1');
      if (menuData.length > 0) {
        console.log('✓ Found existing menu data, migration may be needed');
        // You can add migration logic here if needed
      }
    }

  } catch (error) {
    console.error('Error handling menu_items table:', error);
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
    }
  } catch (error) {
    console.log('Note: Could not create default admin:', error.message);
  }
}