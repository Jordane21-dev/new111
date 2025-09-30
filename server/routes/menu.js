import express from 'express';
import { pool } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get menu items by restaurant
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const { category, available } = req.query;
    const restaurantId = req.params.restaurantId;
    
    let query = `
      SELECT MenuID as id, ItemName as item_name, ItemDescription as item_description, 
             Price as item_price, RestaurantID as restaurant_id, Category as category,
             15 as prep_time, Availability as is_available,
             'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg' as image,
             NOW() as created_at, NOW() as updated_at
      FROM MenuItem 
      WHERE RestaurantID = ?
    `;
    const params = [restaurantId];

    if (category) {
      query += ' AND Category = ?';
      params.push(category);
    }

    if (available !== undefined) {
      query += ' AND Availability = ?';
      params.push(available === 'true' ? 1 : 0);
    }

    query += ' ORDER BY Category, ItemName';

    console.log(`🍽️  Fetching menu for restaurant ${restaurantId}`);
    const [menuItems] = await pool.execute(query, params);
    console.log(`✅ Found ${menuItems.length} menu items`);
    
    // Transform to match frontend expectations
    const transformedItems = menuItems.map(item => ({
      id: item.id.toString(),
      restaurant_id: item.restaurant_id.toString(),
      item_name: item.item_name,
      item_description: item.item_description || '',
      item_price: parseFloat(item.item_price),
      category: item.category || 'Main Course',
      prep_time: item.prep_time || 15,
      is_available: Boolean(item.is_available),
      image: item.image,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    res.json(transformedItems);
  } catch (error) {
    console.error('❌ Get menu items error:', error);
    res.status(500).json({ error: 'Failed to fetch menu items' });
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
      category
    } = req.body;

    console.log('🍽️  Creating menu item:', { item_name, restaurant_id, category });

    // Validation
    const errors = [];
    if (!restaurant_id) errors.push('Restaurant ID is required');
    if (!item_name?.trim()) errors.push('Item name is required');
    if (!item_description?.trim()) errors.push('Item description is required');
    if (!item_price || isNaN(Number(item_price)) || Number(item_price) <= 0) {
      errors.push('Valid item price is required');
    }
    if (!category?.trim()) errors.push('Category is required');

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    // Verify restaurant ownership
    const [restaurants] = await pool.execute(`
      SELECT r.RestaurantID
      FROM Restaurant r
      JOIN RestaurantManager rm ON r.ManagerID = rm.ManagerID
      JOIN RestaurantStaff rs ON rm.StaffID = rs.StaffID
      WHERE r.RestaurantID = ? AND rs.UserID = ?
    `, [restaurant_id, req.user.id]);

    if (restaurants.length === 0) {
      return res.status(403).json({ error: 'Not authorized to add items to this restaurant' });
    }

    // Insert menu item
    const [result] = await pool.execute(`
      INSERT INTO MenuItem (RestaurantID, ItemName, ItemDescription, Price, Category, Availability)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [restaurant_id, item_name.trim(), item_description.trim(), Number(item_price), category.trim()]);

    console.log(`✅ Menu item created with ID: ${result.insertId}`);

    res.status(201).json({
      message: 'Menu item created successfully',
      itemId: result.insertId.toString()
    });
  } catch (error) {
    console.error('❌ Create menu item error:', error);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

// Update menu item (owner only)
router.put('/:id', authenticateToken, requireRole(['owner']), async (req, res) => {
  try {
    const itemId = req.params.id;

    // Verify ownership
    const [items] = await pool.execute(`
      SELECT mi.MenuID
      FROM MenuItem mi
      JOIN Restaurant r ON mi.RestaurantID = r.RestaurantID
      JOIN RestaurantManager rm ON r.ManagerID = rm.ManagerID
      JOIN RestaurantStaff rs ON rm.StaffID = rs.StaffID
      WHERE mi.MenuID = ? AND rs.UserID = ?
    `, [itemId, req.user.id]);

    if (items.length === 0) {
      return res.status(403).json({ error: 'Not authorized to update this menu item' });
    }

    const {
      item_name, item_description, item_price,
      category, is_available
    } = req.body;

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (item_name !== undefined) { 
      updateFields.push('ItemName = ?'); 
      updateValues.push(item_name.trim()); 
    }
    if (item_description !== undefined) { 
      updateFields.push('ItemDescription = ?'); 
      updateValues.push(item_description.trim()); 
    }
    if (item_price !== undefined) { 
      updateFields.push('Price = ?'); 
      updateValues.push(Number(item_price)); 
    }
    if (category !== undefined) { 
      updateFields.push('Category = ?'); 
      updateValues.push(category.trim()); 
    }
    if (is_available !== undefined) { 
      updateFields.push('Availability = ?'); 
      updateValues.push(Boolean(is_available) ? 1 : 0); 
    }

    if (updateFields.length > 0) {
      updateValues.push(itemId);
      await pool.execute(
        `UPDATE MenuItem SET ${updateFields.join(', ')} WHERE MenuID = ?`,
        updateValues
      );
      console.log(`✅ Menu item ${itemId} updated`);
    }

    res.json({ message: 'Menu item updated successfully' });
  } catch (error) {
    console.error('❌ Update menu item error:', error);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

// Delete menu item (owner only)
router.delete('/:id', authenticateToken, requireRole(['owner']), async (req, res) => {
  try {
    const itemId = req.params.id;

    // Verify ownership
    const [items] = await pool.execute(`
      SELECT mi.MenuID
      FROM MenuItem mi
      JOIN Restaurant r ON mi.RestaurantID = r.RestaurantID
      JOIN RestaurantManager rm ON r.ManagerID = rm.ManagerID
      JOIN RestaurantStaff rs ON rm.StaffID = rs.StaffID
      WHERE mi.MenuID = ? AND rs.UserID = ?
    `, [itemId, req.user.id]);

    if (items.length === 0) {
      return res.status(403).json({ error: 'Not authorized to delete this menu item' });
    }

    await pool.execute('DELETE FROM MenuItem WHERE MenuID = ?', [itemId]);
    console.log(`✅ Menu item ${itemId} deleted`);

    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('❌ Delete menu item error:', error);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

export default router;