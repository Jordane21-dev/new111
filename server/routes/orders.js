import express from 'express';
import { pool } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get orders for customer
router.get('/customer', requireRole(['customer']), async (req, res) => {
  try {
    const [orders] = await pool.execute(
      `SELECT o.*, r.name as restaurant_name, r.image as restaurant_image
       FROM orders o
       JOIN restaurants_info r ON o.restaurant_id = r.id
       WHERE o.customer_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    // Get order items for each order
    for (const order of orders) {
      const [items] = await pool.execute(
        `SELECT oi.*, mi.item_name as name, mi.image
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.menu_id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    res.json(orders);
  } catch (error) {
    console.error('Get customer orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get orders for restaurant
router.get('/restaurant', requireRole(['owner']), async (req, res) => {
  try {
    // Get restaurant ID for this owner
    const [restaurants] = await pool.execute(
      'SELECT id FROM restaurants_info WHERE user_id = ?',
      [req.user.id]
    );

    if (restaurants.length === 0) {
      return res.status(404).json({ error: 'No restaurant found for this owner' });
    }

    const restaurantId = restaurants[0].id;

    const [orders] = await pool.execute(
      `SELECT o.*, u.name as customer_name, u.phone_number as customer_phone
       FROM orders o
       JOIN users u ON o.customer_id = u.user_id
       WHERE o.restaurant_id = ?
       ORDER BY o.created_at DESC`,
      [restaurantId]
    );

    // Get order items for each order
    for (const order of orders) {
      const [items] = await pool.execute(
        `SELECT oi.*, mi.item_name as name, mi.image
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.menu_id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    res.json(orders);
  } catch (error) {
    console.error('Get restaurant orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get available deliveries for agents
router.get('/available-deliveries', requireRole(['agent']), async (req, res) => {
  try {
    const [orders] = await pool.execute(
      `SELECT o.*, r.name as restaurant_name, r.address as restaurant_address,
              u.name as customer_name
       FROM orders o
       JOIN restaurants_info r ON o.restaurant_id = r.id
       JOIN users u ON o.customer_id = u.user_id
       WHERE o.status = 'ready' AND o.agent_id IS NULL
       ORDER BY o.created_at ASC`
    );

    // Get order items for each order
    for (const order of orders) {
      const [items] = await pool.execute(
        `SELECT oi.*, mi.item_name as name
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.menu_id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    res.json(orders);
  } catch (error) {
    console.error('Get available deliveries error:', error);
    res.status(500).json({ error: 'Failed to fetch available deliveries' });
  }
});

// Get agent's deliveries
router.get('/agent', requireRole(['agent']), async (req, res) => {
  try {
    const [orders] = await pool.execute(
      `SELECT o.*, r.name as restaurant_name, r.address as restaurant_address,
              u.name as customer_name
       FROM orders o
       JOIN restaurants_info r ON o.restaurant_id = r.id
       JOIN users u ON o.customer_id = u.user_id
       WHERE o.agent_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    // Get order items for each order
    for (const order of orders) {
      const [items] = await pool.execute(
        `SELECT oi.*, mi.item_name as name
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.menu_id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    res.json(orders);
  } catch (error) {
    console.error('Get agent orders error:', error);
    res.status(500).json({ error: 'Failed to fetch agent orders' });
  }
});

// Create order
router.post('/', requireRole(['customer']), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const {
      restaurant_id,
      items,
      delivery_address,
      customer_phone,
      payment_method = 'cash'
    } = req.body;

    console.log('Creating order with data:', req.body);

    // Validate required fields
    if (!restaurant_id || !items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Restaurant ID and items are required' });
    }

    if (!delivery_address || !customer_phone) {
      await connection.rollback();
      return res.status(400).json({ error: 'Delivery address and phone number are required' });
    }

    // Calculate total and validate items
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const [menuItems] = await connection.execute(
        'SELECT item_price FROM menu_items WHERE menu_id = ? AND is_available = true',
        [item.menu_item_id]
      );

      if (menuItems.length === 0) {
        await connection.rollback();
        return res.status(400).json({ error: `Menu item ${item.menu_item_id} not available` });
      }

      const itemTotal = menuItems[0].item_price * item.quantity;
      total += itemTotal;
      
      orderItems.push({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        price: menuItems[0].item_price
      });
    }

    // Create order
    const [orderResult] = await connection.execute(
      `INSERT INTO orders 
       (customer_id, restaurant_id, total, delivery_address, customer_phone, payment_method)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, restaurant_id, total, delivery_address, customer_phone, payment_method]
    );

    const orderId = orderResult.insertId;
    console.log('Order created with ID:', orderId);

    // Insert order items
    for (const item of orderItems) {
      await connection.execute(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.menu_item_id, item.quantity, item.price]
      );
    }

    await connection.commit();
    console.log('Order transaction committed');

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.emit('new-order', {
        orderId,
        restaurantId: restaurant_id,
        customerId: req.user.id,
        total,
        timestamp: new Date()
      });
    }

    res.status(201).json({
      message: 'Order created successfully',
      orderId,
      total
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    connection.release();
  }
});

// Update order status
router.put('/:id/status', async (req, res) => {
  try {
    const { status, agent_id } = req.body;
    const orderId = req.params.id;

    console.log('Updating order status:', { orderId, status, agent_id, user: req.user });

    // Verify permissions
    const [orders] = await pool.execute(
      `SELECT o.*, r.user_id as owner_id 
       FROM orders o
       JOIN restaurants_info r ON o.restaurant_id = r.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];
    const canUpdate = 
      req.user.role === 'admin' ||
      (req.user.role === 'owner' && order.owner_id === req.user.id) ||
      (req.user.role === 'agent' && (order.agent_id === req.user.id || status === 'in_transit'));

    if (!canUpdate) {
      return res.status(403).json({ error: 'Not authorized to update this order' });
    }

    // Update order
    const updateFields = ['status = ?'];
    const updateValues = [status];

    if (agent_id !== undefined) {
      updateFields.push('agent_id = ?');
      updateValues.push(agent_id);
    }

    updateValues.push(orderId);

    await pool.execute(
      `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    console.log('Order status updated successfully');

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.emit('order-status-update', {
        orderId,
        status,
        restaurantId: order.restaurant_id,
        customerId: order.customer_id,
        timestamp: new Date()
      });
    }

    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Accept delivery (agent)
router.put('/:id/accept-delivery', requireRole(['agent']), async (req, res) => {
  try {
    const orderId = req.params.id;

    // Check if order is available for pickup
    const [orders] = await pool.execute(
      'SELECT * FROM orders WHERE id = ? AND status = ? AND agent_id IS NULL',
      [orderId, 'ready']
    );

    if (orders.length === 0) {
      return res.status(400).json({ error: 'Order not available for pickup' });
    }

    // Assign agent and update status
    await pool.execute(
      'UPDATE orders SET agent_id = ?, status = ? WHERE id = ?',
      [req.user.id, 'in_transit', orderId]
    );

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.emit('order-status-update', {
        orderId,
        status: 'in_transit',
        agentId: req.user.id,
        agentName: req.user.name,
        timestamp: new Date()
      });
    }

    res.json({ message: 'Delivery accepted successfully' });
  } catch (error) {
    console.error('Accept delivery error:', error);
    res.status(500).json({ error: 'Failed to accept delivery' });
  }
});

export default router;