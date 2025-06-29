import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useOrders } from '../../contexts/OrderContext';
import { ShoppingCart, MapPin, Phone, CreditCard, Plus, Minus, X, AlertCircle } from 'lucide-react';

export default function MyOrders() {
  const { user } = useAuth();
  const { items, updateQuantity, removeItem, clearCart, total } = useCart();
  const { orders, createOrder, getCustomerOrders, loading, error } = useOrders();
  const navigate = useNavigate();
  
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderData, setOrderData] = useState({
    deliveryAddress: '',
    phone: user?.phone || ''
  });
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');

  useEffect(() => {
    if (user?.role === 'customer') {
      getCustomerOrders();
    }
  }, [user]);

  const validateOrderData = () => {
    const errors = [];
    
    if (!orderData.deliveryAddress.trim()) {
      errors.push('Delivery address is required');
    }
    
    if (!orderData.phone.trim()) {
      errors.push('Phone number is required');
    }
    
    if (items.length === 0) {
      errors.push('Cart is empty');
    }
    
    // Validate that all items are from the same restaurant
    const restaurantIds = [...new Set(items.map(item => item.restaurantId))];
    if (restaurantIds.length > 1) {
      errors.push('All items must be from the same restaurant');
    }
    
    return errors;
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || items.length === 0) return;

    // Validate order data
    const validationErrors = validateOrderData();
    if (validationErrors.length > 0) {
      setOrderError(validationErrors.join(', '));
      return;
    }

    setIsPlacingOrder(true);
    setOrderError('');
    
    try {
      // Group items by restaurant (should only be one restaurant)
      const itemsByRestaurant = items.reduce((acc, item) => {
        if (!acc[item.restaurantId]) {
          acc[item.restaurantId] = {
            restaurantId: item.restaurantId,
            restaurantName: item.restaurantName,
            items: []
          };
        }
        acc[item.restaurantId].items.push(item);
        return acc;
      }, {} as Record<string, { restaurantId: string; restaurantName: string; items: typeof items }>);

      // Create separate orders for each restaurant (should only be one)
      for (const restaurantOrder of Object.values(itemsByRestaurant)) {
        // Format items for the API
        const orderItems = restaurantOrder.items.map(item => ({
          menu_item_id: parseInt(item.id), // Ensure it's a number
          quantity: item.quantity
        }));
        
        const orderPayload = {
          restaurant_id: parseInt(restaurantOrder.restaurantId), // Ensure it's a number
          items: orderItems,
          delivery_address: orderData.deliveryAddress.trim(),
          customer_phone: orderData.phone.trim(),
          payment_method: 'cash'
        };

        console.log('🔄 Creating order with payload:', orderPayload);
        await createOrder(orderPayload);
      }

      // Clear cart and close modal on success
      clearCart();
      setShowCheckout(false);
      setOrderData({ deliveryAddress: '', phone: user?.phone || '' });
      setOrderError('');
      
      // Show success message
      alert('Order placed successfully! You can track your order below.');
      
    } catch (error: any) {
      console.error('❌ Order placement error:', error);
      setOrderError(error.message || 'Failed to place order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const closeCheckout = () => {
    setShowCheckout(false);
    setOrderError('');
    setOrderData({ deliveryAddress: '', phone: user?.phone || '' });
  };

  return (
    <Layout title="My Orders">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Section */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6 border border-orange-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Shopping Cart</h2>
              <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-medium">
                {items.length} items
              </div>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Your cart is empty</p>
                <button
                  onClick={() => navigate('/customer')}
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors"
                >
                  Browse Restaurants
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
                        <p className="text-sm text-gray-500">{item.restaurantName}</p>
                        <p className="text-sm font-medium text-orange-600">
                          {item.price.toLocaleString()} XAF
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-medium min-w-[1.5rem] text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="bg-orange-600 hover:bg-orange-700 text-white w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-red-500 hover:text-red-700 transition-colors ml-2"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 mb-6">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total</span>
                    <span className="text-orange-600">{total.toLocaleString()} XAF</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="w-full bg-gradient-to-r from-orange-600 to-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-orange-700 hover:to-green-700 transition-all duration-200 transform hover:scale-105"
                  >
                    Proceed to Checkout
                  </button>
                  <button
                    onClick={clearCart}
                    className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Clear Cart
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Orders History */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Order History</h2>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
              <span className="ml-3 text-gray-600">Loading orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center border border-gray-100">
              <div className="text-gray-300 mb-4">
                <ShoppingCart className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">No orders yet</h3>
              <p className="text-gray-600 mb-6">When you place orders, they'll appear here.</p>
              <button
                onClick={() => navigate('/customer')}
                className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors"
              >
                Start Ordering
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{order.restaurant_name}</h3>
                      <p className="text-gray-500 text-sm">Order #{order.id}</p>
                      <p className="text-gray-500 text-sm">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="space-y-2 mb-4">
                    {order.items?.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="font-medium">
                          {(item.price * item.quantity).toLocaleString()} XAF
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center mb-1">
                        <MapPin className="h-4 w-4 mr-1" />
                        {order.delivery_address}
                      </div>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {order.customer_phone}
                      </div>
                    </div>
                    <div className="text-lg font-bold text-orange-600">
                      {order.total.toLocaleString()} XAF
                    </div>
                  </div>

                  {order.agent_name && order.status === 'in_transit' && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Delivery Agent:</strong> {order.agent_name}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Checkout</h3>
                <button
                  onClick={closeCheckout}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {orderError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{orderError}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handlePlaceOrder} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Address *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-gray-400 h-5 w-5" />
                    <textarea
                      required
                      value={orderData.deliveryAddress}
                      onChange={(e) => {
                        setOrderData({ ...orderData, deliveryAddress: e.target.value });
                        setOrderError(''); // Clear error when user types
                      }}
                      placeholder="Enter your full delivery address..."
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="tel"
                      required
                      value={orderData.phone}
                      onChange={(e) => {
                        setOrderData({ ...orderData, phone: e.target.value });
                        setOrderError(''); // Clear error when user types
                      }}
                      placeholder="+237 6XX XXX XXX"
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      maxLength={20}
                    />
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <CreditCard className="h-5 w-5 text-orange-600 mr-2" />
                    <span className="font-medium">Payment Method</span>
                  </div>
                  <p className="text-sm text-gray-600">Pay on Delivery (Cash)</p>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-lg font-bold mb-4">
                    <span>Total Amount</span>
                    <span className="text-orange-600">{total.toLocaleString()} XAF</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPlacingOrder || items.length === 0}
                  className="w-full bg-gradient-to-r from-orange-600 to-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-orange-700 hover:to-green-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  {isPlacingOrder ? 'Placing Order...' : 'Place Order'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}