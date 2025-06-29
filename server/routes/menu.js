import express from 'express';
import { pool } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get menu items by restaurant
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const { category, available } = req.query;
    
    let query = 'SELECT menu_id as id, item_name, item_description, item_price, restaurant_id, category, prep_time, is_available, image FROM menu_items WHERE restaurant_id = ?';
    const params = [req.params.restaurantId];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (available !== undefined) {
      query += ' AND is_available = ?';
      params.push(available === 'true');
    }

    query += ' ORDER BY category, item_name';

    const [menuItems] = await pool.execute(query, params);
    
    // Transform to match frontend expectations
    const transformedItems = menuItems.map(item => ({
      id: item.id.toString(),
      restaurant_id: item.restaurant_id.toString(),
      item_name: item.item_name,
      item_description: item.item_description,
      item_price: parseFloat(item.item_price),
      category: item.category,
      prep_time: item.prep_time || 15,
      is_available: Boolean(item.is_available),
      image: item.image || 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg'
    }));

    res.json(transformedItems);
  } catch (error) {
    console.error('Get menu items error:', error);
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

// Get menu item by ID
router.get('/:id', async (req, res) => {
  try {
    const [menuItems] = await pool.execute(
      'SELECT menu_id as id, item_name, item_description, item_price, restaurant_id, category, prep_time, is_available, image FROM menu_items WHERE menu_id = ?',
      [req.params.id]
    );

    if (menuItems.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const item = menuItems[0];
    const transformedItem = {
      id: item.id.toString(),
      restaurant_id: item.restaurant_id.toString(),
      item_name: item.item_name,
      item_description: item.item_description,
      item_price: parseFloat(item.item_price),
      category: item.category,
      prep_time: item.prep_time || 15,
      is_available: Boolean(item.is_available),
      image: item.image || 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg'
    };

    res.json(transformedItem);
  } catch (error) {
    console.error('Get menu item error:', error);
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
});

// Create menu item (owner only)
router.post('/', authenticateToken, requireRole(['owner']), async (req, res) => {
  try {
    const {
      restaurant_id,
      item_name,
      item_description,
      item_price,
      image,
      category,
      prep_time
    } = req.body;

    // Verify restaurant ownership
    const [restaurants] = await pool.execute(
      'SELECT user_id FROM restaurants_info WHERE id = ?',
      [restaurant_id]
    );

    if (restaurants.length === 0 || restaurants[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to add items to this restaurant' });
    }

    const [result] = await pool.execute(
      `INSERT INTO menu_items 
       (restaurant_id, item_name, item_description, item_price, image, category, prep_time, is_available)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [restaurant_id, item_name, item_description, item_price, image || 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg', category, prep_time || 15, true]
    );

    res.status(201).json({
      message: 'Menu item created successfully',
      itemId: result.insertId
    });
  } catch (error) {
    console.error('Create menu item error:', error);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

// Update menu item (owner only)
router.put('/:id', authenticateToken, requireRole(['owner']), async (req, res) => {
  try {
    const itemId = req.params.id;

    // Verify ownership
    const [items] = await pool.execute(
      `SELECT mi.*, r.user_id 
       FROM menu_items mi
       JOIN restaurants_info r ON mi.restaurant_id = r.id
       WHERE mi.menu_id = ?`,
      [itemId]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    if (items[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this menu item' });
    }

    const {
      item_name,
      item_description,
      item_price,
      image,
      category,
      prep_time,
      is_available
    } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (item_name !== undefined) { updateFields.push('item_name = ?'); updateValues.push(item_name); }
    if (item_description !== undefined) { updateFields.push('item_description = ?'); updateValues.push(item_description); }
    if (item_price !== undefined) { updateFields.push('item_price = ?'); updateValues.push(item_price); }
    if (image !== undefined) { updateFields.push('image = ?'); updateValues.push(image); }
    if (category !== undefined) { updateFields.push('category = ?'); updateValues.push(category); }
    if (prep_time !== undefined) { updateFields.push('prep_time = ?'); updateValues.push(prep_time); }
    if (is_available !== undefined) { updateFields.push('is_available = ?'); updateValues.push(is_available); }

    if (updateFields.length > 0) {
      updateValues.push(itemId);
      await pool.execute(
        `UPDATE menu_items SET ${updateFields.join(', ')} WHERE menu_id = ?`,
        updateValues
      );
    }

    res.json({ message: 'Menu item updated successfully' });
  } catch (error) {
    console.error('Update menu item error:', error);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

// Delete menu item (owner only)
router.delete('/:id', authenticateToken, requireRole(['owner']), async (req, res) => {
  try {
    const itemId = req.params.id;

    // Verify ownership
    const [items] = await pool.execute(
      `SELECT mi.*, r.user_id 
       FROM menu_items mi
       JOIN restaurants_info r ON mi.restaurant_id = r.id
       WHERE mi.menu_id = ?`,
      [itemId]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    if (items[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this menu item' });
    }

    await pool.execute('DELETE FROM menu_items WHERE menu_id = ?', [itemId]);

    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Delete menu item error:', error);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

export default router;