import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load environment variables from .env file
dotenv.config();

/**
 * Database Configuration for SERVESOFT Database
 * MySQL connection settings with XAMPP defaults
 */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '', // XAMPP default is empty password
  database: process.env.DB_NAME || 'SERVESOFT',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create MySQL connection pool for better performance
export const pool = mysql.createPool(dbConfig);

/**
 * Initialize Database Connection
 * Tests connection to SERVESOFT database
 */
export async function initializeDatabase() {
  try {
    console.log(`🔄 Attempting to connect to SERVESOFT database at ${dbConfig.host}:${dbConfig.port}`);
    
    // Test the connection
    const connection = await pool.getConnection();
    console.log('✅ Successfully connected to SERVESOFT database');
    
    // Test if tables exist
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'SERVESOFT'
    `);
    
    console.log(`📊 Found ${tables.length} tables in SERVESOFT database`);
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found. Please run the SQL schema first in phpMyAdmin');
    } else {
      console.log('✅ Database tables detected:', tables.map(t => t.TABLE_NAME).join(', '));
    }
    
    connection.release();
    
    console.log('🎉 Database connection initialized successfully');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.log('💡 Make sure XAMPP is running and SERVESOFT database exists');
    throw error;
  }
}

/**
 * Helper function to get user role from database
 */
export async function getUserRole(userId) {
  try {
    // Check if user is admin
    const [adminCheck] = await pool.execute(
      'SELECT AdminID FROM Admin WHERE UserID = ?',
      [userId]
    );
    if (adminCheck.length > 0) return 'admin';

    // Check if user is customer
    const [customerCheck] = await pool.execute(
      'SELECT CustomerID FROM Customer WHERE UserID = ?',
      [userId]
    );
    if (customerCheck.length > 0) return 'customer';

    // Check if user is staff (manager or delivery agent)
    const [staffCheck] = await pool.execute(
      'SELECT StaffID, Role FROM RestaurantStaff WHERE UserID = ?',
      [userId]
    );
    if (staffCheck.length > 0) {
      const staff = staffCheck[0];
      
      // Check if manager
      const [managerCheck] = await pool.execute(
        'SELECT ManagerID FROM RestaurantManager WHERE StaffID = ?',
        [staff.StaffID]
      );
      if (managerCheck.length > 0) return 'owner'; // Map manager to owner role
      
      // Check if delivery agent
      const [agentCheck] = await pool.execute(
        'SELECT DeliveryAgentID FROM DeliveryAgent WHERE StaffID = ?',
        [staff.StaffID]
      );
      if (agentCheck.length > 0) return 'agent';
      
      return 'staff'; // Generic staff role
    }

    return 'customer'; // Default role
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'customer';
  }
}