import express from 'express';
import { pool } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all restaurants
router.get('/', async (req, res) => {
  try {
    const { location, search } = req.query;
    
    let query = `
      SELECT r.RestaurantID as id, r.RestaurantName as name, r.Address as address,
             r.PhoneNumber as phone, r.Location as town, r.Status as status,
             'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg' as image,
             '4.5' as rating, '25-35 min' as delivery_time, 500 as delivery_fee, 2000 as min_order,
             CASE WHEN r.Status = 'Active' THEN 1 ELSE 0 END as is_active
      FROM Restaurant r
      WHERE r.Status = 'Active'
    `;
    const params = [];

    if (location) {
      query += ' AND r.Location = ?';
      params.push(location);
    }

    if (search) {
      query += ' AND r.RestaurantName LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY r.RestaurantName';

    console.log('🔍 Fetching restaurants with query:', query);
    const [restaurants] = await pool.execute(query, params);
    console.log(`✅ Found ${restaurants.length} restaurants`);

    // Format response to match frontend expectations
    const formattedRestaurants = restaurants.map(restaurant => ({
      id: restaurant.id.toString(),
      name: restaurant.name,
      description: `Delicious food from ${restaurant.name}`,
      image: restaurant.image,
      town: restaurant.town,
      address: restaurant.address,
      phone: restaurant.phone,
      delivery_time: restaurant.delivery_time,
      delivery_fee: parseFloat(restaurant.delivery_fee),
      min_order: parseFloat(restaurant.min_order),
      rating: parseFloat(restaurant.rating),
      is_active: Boolean(restaurant.is_active),
      categories: ['Traditional', 'Local Cuisine'], // Default categories
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    res.json(formattedRestaurants);
  } catch (error) {
    console.error('❌ Get restaurants error:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// Get restaurant by ID
router.get('/:id', async (req, res) => {
  try {
    const [restaurants] = await pool.execute(`
      SELECT r.RestaurantID as id, r.RestaurantName as name, r.Address as address,
             r.PhoneNumber as phone, r.Location as town, r.Status as status,
             'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg' as image,
             '4.5' as rating, '25-35 min' as delivery_time, 500 as delivery_fee, 2000 as min_order
      FROM Restaurant r
      WHERE r.RestaurantID = ?
    `, [req.params.id]);

    if (restaurants.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const restaurant = restaurants[0];
    const formattedRestaurant = {
      id: restaurant.id.toString(),
      name: restaurant.name,
      description: `Delicious food from ${restaurant.name}`,
      image: restaurant.image,
      town: restaurant.town,
      address: restaurant.address,
      phone: restaurant.phone,
      delivery_time: restaurant.delivery_time,
      delivery_fee: parseFloat(restaurant.delivery_fee),
      min_order: parseFloat(restaurant.min_order),
      rating: parseFloat(restaurant.rating),
      is_active: restaurant.status === 'Active',
      categories: ['Traditional', 'Local Cuisine'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.json(formattedRestaurant);
  } catch (error) {
    console.error('❌ Get restaurant error:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

// Create restaurant (manager/owner only)
router.post('/', authenticateToken, requireRole(['owner']), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { name, address, phone, location } = req.body;

    console.log('🏪 Creating restaurant:', { name, location });

    // Validation
    const errors = [];
    if (!name?.trim()) errors.push('Restaurant name is required');
    if (!address?.trim()) errors.push('Address is required');
    if (!phone?.trim()) errors.push('Phone number is required');
    if (!location?.trim()) errors.push('Location is required');

    if (errors.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: errors.join(', ') });
    }

    // Get manager ID for this user
    const [managers] = await connection.execute(`
      SELECT rm.ManagerID
      FROM RestaurantManager rm
      JOIN RestaurantStaff rs ON rm.StaffID = rs.StaffID
      WHERE rs.UserID = ?
    `, [req.user.id]);

    if (managers.length === 0) {
      await connection.rollback();
      return res.status(403).json({ error: 'User is not authorized to create restaurants' });
    }

    const managerId = managers[0].ManagerID;

    // Insert restaurant
    const [result] = await connection.execute(`
      INSERT INTO Restaurant (RestaurantName, Address, PhoneNumber, Location, Status, ManagerID)
      VALUES (?, ?, ?, ?, 'Active', ?)
    `, [name.trim(), address.trim(), phone.trim(), location.trim(), managerId]);

    const restaurantId = result.insertId;
    console.log(`✅ Restaurant created with ID: ${restaurantId}`);

    await connection.commit();

    res.status(201).json({
      message: 'Restaurant created successfully',
      restaurantId: restaurantId.toString()
    });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Create restaurant error:', error);
    res.status(500).json({ error: 'Failed to create restaurant' });
  } finally {
    connection.release();
  }
});

// Get restaurant by owner/manager
router.get('/owner/my-restaurant', authenticateToken, requireRole(['owner']), async (req, res) => {
  try {
    const [restaurants] = await pool.execute(`
      SELECT r.RestaurantID as id, r.RestaurantName as name, r.Address as address,
             r.PhoneNumber as phone, r.Location as town, r.Status as status,
             'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg' as image,
             '4.5' as rating, '25-35 min' as delivery_time, 500 as delivery_fee, 2000 as min_order
      FROM Restaurant r
      JOIN RestaurantManager rm ON r.ManagerID = rm.ManagerID
      JOIN RestaurantStaff rs ON rm.StaffID = rs.StaffID
      WHERE rs.UserID = ?
    `, [req.user.id]);

    if (restaurants.length === 0) {
      return res.status(404).json({ error: 'No restaurant found for this owner' });
    }

    const restaurant = restaurants[0];
    const formattedRestaurant = {
      id: restaurant.id.toString(),
      user_id: req.user.id.toString(),
      name: restaurant.name,
      description: `Delicious food from ${restaurant.name}`,
      image: restaurant.image,
      town: restaurant.town,
      address: restaurant.address,
      phone: restaurant.phone,
      delivery_time: restaurant.delivery_time,
      delivery_fee: parseFloat(restaurant.delivery_fee),
      min_order: parseFloat(restaurant.min_order),
      rating: parseFloat(restaurant.rating),
      is_active: restaurant.status === 'Active',
      categories: ['Traditional', 'Local Cuisine'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log(`✅ Retrieved restaurant for owner ${req.user.id}`);
    res.json(formattedRestaurant);
  } catch (error) {
    console.error('❌ Get owner restaurant error:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

export default router;