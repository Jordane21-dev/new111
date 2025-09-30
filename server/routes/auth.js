import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, getUserRole } from '../config/database.js';

const router = express.Router();

// Check if admin already exists
router.get('/check-admin', async (req, res) => {
  try {
    const [admins] = await pool.execute(
      'SELECT COUNT(*) as admin_count FROM Admin'
    );
    
    const adminExists = admins[0].admin_count > 0;
    
    res.json({ adminExists });
  } catch (error) {
    console.error('Check admin error:', error);
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

// Register
router.post('/register', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { name, email, password, role, phone, town } = req.body;

    // Check if trying to register as admin
    if (role === 'admin') {
      const [existingAdmins] = await connection.execute(
        'SELECT AdminID FROM Admin LIMIT 1'
      );

      if (existingAdmins.length > 0) {
        await connection.rollback();
        return res.status(400).json({ 
          error: 'Admin account already exists. Only one admin account is allowed per system.' 
        });
      }
    }

    // Check if user already exists
    const [existingUsers] = await connection.execute(
      'SELECT UserID FROM User WHERE Email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into User table
    const [userResult] = await connection.execute(
      'INSERT INTO User (Name, Email, PhoneNumber) VALUES (?, ?, ?)',
      [name, email, phone || null]
    );

    const userId = userResult.insertId;

    // Insert into Account table
    await connection.execute(
      'INSERT INTO Account (UserID, PhoneNumber, Password) VALUES (?, ?, ?)',
      [userId, phone || null, hashedPassword]
    );

    // Insert into role-specific table
    if (role === 'admin') {
      await connection.execute(
        'INSERT INTO Admin (UserID) VALUES (?)',
        [userId]
      );
    } else if (role === 'owner') {
      // Create as restaurant staff with manager role
      const [staffResult] = await connection.execute(
        'INSERT INTO RestaurantStaff (UserID, Role, Status) VALUES (?, ?, ?)',
        [userId, 'Manager', 'Active']
      );
      
      await connection.execute(
        'INSERT INTO RestaurantManager (StaffID) VALUES (?)',
        [staffResult.insertId]
      );
    } else if (role === 'agent') {
      // Create as restaurant staff with delivery role
      const [staffResult] = await connection.execute(
        'INSERT INTO RestaurantStaff (UserID, Role, Status) VALUES (?, ?, ?)',
        [userId, 'Delivery Agent', 'Active']
      );
      
      await connection.execute(
        'INSERT INTO DeliveryAgent (StaffID) VALUES (?)',
        [staffResult.insertId]
      );
    } else {
      // Default to customer
      await connection.execute(
        'INSERT INTO Customer (UserID) VALUES (?)',
        [userId]
      );
    }

    await connection.commit();

    // Generate JWT token
    const token = jwt.sign(
      { userId, email, role: role || 'customer' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        name,
        email,
        role: role || 'customer',
        phone: phone || null
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    connection.release();
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and account
    const [users] = await pool.execute(`
      SELECT u.UserID, u.Name, u.Email, u.PhoneNumber, a.Password
      FROM User u
      JOIN Account a ON u.UserID = a.UserID
      WHERE u.Email = ?
    `, [email]);

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.Password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user role
    const role = await getUserRole(user.UserID);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.UserID, email: user.Email, role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.UserID,
        name: user.Name,
        email: user.Email,
        role,
        phone: user.PhoneNumber
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    const [users] = await pool.execute(
      'SELECT UserID, Name, Email, PhoneNumber FROM User WHERE UserID = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = users[0];
    const role = await getUserRole(user.UserID);

    res.json({ 
      user: {
        id: user.UserID,
        name: user.Name,
        email: user.Email,
        role,
        phone: user.PhoneNumber
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;