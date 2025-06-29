import express from 'express';
import { pool } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all restaurants
router.get('/', async (req, res) => {
  try {
    const { town, category, search } = req.query;
    
    let query = `
      SELECT r.*, GROUP_CONCAT(rc.category) as categories
      FROM restaurants_info r
      LEFT JOIN restaurant_categories rc ON r.id = rc.restaurant_id
      WHERE r.is_active = true
    `;
    const params = [];

    if (town) {
      query += ' AND r.town = ?';
      params.push(town);
    }

    if (search) {
      query += ' AND (r.name LIKE ? OR r.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' GROUP BY r.id ORDER BY r.rating DESC, r.created_at DESC';

    const [restaurants] = await pool.execute(query, params);

    // Filter by category if specified
    let filteredRestaurants = restaurants;
    if (category) {
      filteredRestaurants = restaurants.filter(restaurant => 
        restaurant.categories && restaurant.categories.split(',').includes(category)
      );
    }

    // Format categories as array
    const formattedRestaurants = filteredRestaurants.map(restaurant => ({
      ...restaurant,
      categories: restaurant.categories ? restaurant.categories.split(',') : []
    }));

    res.json(formattedRestaurants);
  } catch (error) {
    console.error('Get restaurants error:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// Get restaurant by ID
router.get('/:id', async (req, res) => {
  try {
    const [restaurants] = await pool.execute(
      `SELECT r.*, GROUP_CONCAT(rc.category) as categories
       FROM restaurants_info r
       LEFT JOIN restaurant_categories rc ON r.id = rc.restaurant_id
       WHERE r.id = ?
       GROUP BY r.id`,
      [req.params.id]
    );

    if (restaurants.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const restaurant = {
      ...restaurants[0],
      categories: restaurants[0].categories ? restaurants[0].categories.split(',') : []
    };

    res.json(restaurant);
  } catch (error) {
    console.error('Get restaurant error:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

// Create restaurant (owner only)
router.post('/', authenticateToken, requireRole(['owner']), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const {
      name,
      description,
      image,
      town,
      address,
      phone,
      delivery_time,
      delivery_fee,
      min_order,
      categories
    } = req.body;

    console.log('Creating restaurant with data:', req.body);

    // Validate required fields
    if (!name || !description || !town || !address || !phone || !delivery_time || delivery_fee === undefined || min_order === undefined) {
      await connection.rollback();
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'At least one category must be selected' });
    }

    // Validate numeric fields
    const deliveryFeeNum = parseFloat(delivery_fee);
    const minOrderNum = parseFloat(min_order);

    if (isNaN(deliveryFeeNum) || deliveryFeeNum < 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Invalid delivery fee' });
    }

    if (isNaN(minOrderNum) || minOrderNum < 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Invalid minimum order amount' });
    }

    // Check if owner already has a restaurant
    const [existingRestaurants] = await connection.execute(
      'SELECT id FROM restaurants_info WHERE user_id = ?',
      [req.user.id]
    );

    if (existingRestaurants.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'You already have a restaurant registered' });
    }

    // Insert restaurant
    const [result] = await connection.execute(
      `INSERT INTO restaurants_info 
       (user_id, name, description, image, town, address, phone, delivery_time, delivery_fee, min_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, 
        name.trim(), 
        description.trim(), 
        image?.trim() || 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg', 
        town, 
        address.trim(), 
        phone.trim(), 
        delivery_time.trim(), 
        deliveryFeeNum, 
        minOrderNum
      ]
    );

    const restaurantId = result.insertId;
    console.log('Restaurant created with ID:', restaurantId);

    // Insert categories
    if (categories && categories.length > 0) {
      for (const category of categories) {
        await connection.execute(
          'INSERT INTO restaurant_categories (restaurant_id, category) VALUES (?, ?)',
          [restaurantId, category.trim()]
        );
      }
      console.log('Categories inserted:', categories);
    }

    await connection.commit();
    console.log('Restaurant creation transaction committed');

    res.status(201).json({
      message: 'Restaurant created successfully',
      restaurantId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create restaurant error:', error);
    
    // Provide more specific error messages
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('unique_user_restaurant')) {
        res.status(400).json({ error: 'You already have a restaurant registered' });
      } else {
        res.status(400).json({ error: 'A restaurant with this information already exists' });
      }
    } else if (error.code === 'ER_DATA_TOO_LONG') {
      res.status(400).json({ error: 'One or more fields exceed the maximum length' });
    } else if (error.code === 'ER_BAD_NULL_ERROR') {
      res.status(400).json({ error: 'Required field is missing' });
    } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      res.status(400).json({ error: 'Invalid user reference' });
    } else {
      res.status(500).json({ error: 'Failed to create restaurant. Please check your input and try again.' });
    }
  } finally {
    connection.release();
  }
});

// Update restaurant (owner only)
router.put('/:id', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const restaurantId = req.params.id;
    
    // Check ownership (unless admin)
    if (req.user.role !== 'admin') {
      const [restaurants] = await connection.execute(
        'SELECT user_id FROM restaurants_info WHERE id = ?',
        [restaurantId]
      );

      if (restaurants.length === 0 || restaurants[0].user_id !== req.user.id) {
        await connection.rollback();
        return res.status(403).json({ error: 'Not authorized to update this restaurant' });
      }
    }

    const {
      name,
      description,
      image,
      town,
      address,
      phone,
      delivery_time,
      delivery_fee,
      min_order,
      categories,
      is_active
    } = req.body;

    // Update restaurant
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name.trim()); }
    if (description !== undefined) { updateFields.push('description = ?'); updateValues.push(description.trim()); }
    if (image !== undefined) { updateFields.push('image = ?'); updateValues.push(image.trim()); }
    if (town !== undefined) { updateFields.push('town = ?'); updateValues.push(town); }
    if (address !== undefined) { updateFields.push('address = ?'); updateValues.push(address.trim()); }
    if (phone !== undefined) { updateFields.push('phone = ?'); updateValues.push(phone.trim()); }
    if (delivery_time !== undefined) { updateFields.push('delivery_time = ?'); updateValues.push(delivery_time.trim()); }
    if (delivery_fee !== undefined) { updateFields.push('delivery_fee = ?'); updateValues.push(parseFloat(delivery_fee)); }
    if (min_order !== undefined) { updateFields.push('min_order = ?'); updateValues.push(parseFloat(min_order)); }
    if (is_active !== undefined) { updateFields.push('is_active = ?'); updateValues.push(is_active); }

    if (updateFields.length > 0) {
      updateValues.push(restaurantId);
      await connection.execute(
        `UPDATE restaurants_info SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    // Update categories if provided
    if (categories !== undefined) {
      await connection.execute(
        'DELETE FROM restaurant_categories WHERE restaurant_id = ?',
        [restaurantId]
      );

      if (categories.length > 0) {
        for (const category of categories) {
          await connection.execute(
            'INSERT INTO restaurant_categories (restaurant_id, category) VALUES (?, ?)',
            [restaurantId, category.trim()]
          );
        }
      }
    }

    await connection.commit();

    res.json({ message: 'Restaurant updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Update restaurant error:', error);
    res.status(500).json({ error: 'Failed to update restaurant' });
  } finally {
    connection.release();
  }
});

// Get restaurant by owner
router.get('/owner/my-restaurant', authenticateToken, requireRole(['owner']), async (req, res) => {
  try {
    const [restaurants] = await pool.execute(
      `SELECT r.*, GROUP_CONCAT(rc.category) as categories
       FROM restaurants_info r
       LEFT JOIN restaurant_categories rc ON r.id = rc.restaurant_id
       WHERE r.user_id = ?
       GROUP BY r.id`,
      [req.user.id]
    );

    if (restaurants.length === 0) {
      return res.status(404).json({ error: 'No restaurant found for this owner' });
    }

    const restaurant = {
      ...restaurants[0],
      categories: restaurants[0].categories ? restaurants[0].categories.split(',') : []
    };

    res.json(restaurant);
  } catch (error) {
    console.error('Get owner restaurant error:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

export default router;