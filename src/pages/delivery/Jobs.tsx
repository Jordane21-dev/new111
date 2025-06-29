import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../contexts/OrderContext';
import { ArrowLeft, MapPin, Phone, Clock, DollarSign, Package, CheckCircle } from 'lucide-react';

export default function DeliveryJobs() {
  const { user } = useAuth();
  const { getAvailableDeliveries, getOrdersByAgent, updateOrderStatus } = useOrders();

  const availableDeliveries = getAvailableDeliveries();
  const myDeliveries = user ? getOrdersByAgent(user.id) : [];

  const handleAcceptDelivery = (orderId: string) => {
    if (user) {
      updateOrderStatus(orderId, 'in_transit', user.id);
    }
  };

  const handleCompleteDelivery = (orderId: string) => {
    updateOrderStatus(orderId, 'delivered');
  };

  const calculateDeliveryFee = (orderTotal: number) => {
    // Simplified calculation: 10% of order total with minimum 500 XAF
    return Math.max(orderTotal * 0.1, 500);
  };

  return (
    <Layout title="Delivery Jobs">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          to="/agent"
          className="inline-flex items-center text-orange-600 hover:text-orange-700 font-medium"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to dashboard
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Available Deliveries */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Available Deliveries</h2>
            <div className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
              {availableDeliveries.length} available
            </div>
          </div>

          {availableDeliveries.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center border border-gray-100">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No deliveries available</h3>
              <p className="text-gray-600">Check back later for new delivery opportunities.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableDeliveries.map((order) => (
                <div key={order.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Order #{order.id}</h3>
                      <p className="text-orange-600 font-medium">{order.restaurantName}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Delivery Address</div>
                        <div className="text-sm text-gray-600">{order.deliveryAddress}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Customer</div>
                        <div className="text-sm text-gray-600">{order.customerName} • {order.phone}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="text-sm font-medium text-gray-900 mb-2">Order Summary</div>
                    <div className="space-y-1">
                      {order.items.slice(0, 2).map((item, index) => (
                        <div key={index} className="text-sm text-gray-600">
                          {item.quantity}x {item.name}
                        </div>
                      ))}
                      {order.items.length > 2 && (
                        <div className="text-sm text-gray-500">
                          +{order.items.length - 2} more items
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Order Total:</span> {order.total.toLocaleString()} XAF
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        +{calculateDeliveryFee(order.total).toLocaleString()} XAF
                      </div>
                      <div className="text-sm text-gray-500">Delivery Fee</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAcceptDelivery(order.id)}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2"
                  >
                    <Package className="h-5 w-5" />
                    <span>Accept Delivery</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Active Deliveries */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">My Deliveries</h2>
            <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-medium">
              {myDeliveries.length} total
            </div>
          </div>

          {myDeliveries.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center border border-gray-100">
              <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No deliveries yet</h3>
              <p className="text-gray-600">Accept your first delivery to get started earning!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myDeliveries.map((order) => (
                <div key={order.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Order #{order.id}</h3>
                      <p className="text-orange-600 font-medium">{order.restaurantName}</p>
                      <p className="text-sm text-gray-500">
                        Accepted: {new Date(order.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">Delivery to:</div>
                        <div className="text-gray-600">{order.deliveryAddress}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">{order.customerName}</span>
                        <span className="text-gray-600 ml-2">{order.phone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Earning:</span> 
                      <span className="text-green-600 font-bold ml-1">
                        +{calculateDeliveryFee(order.total).toLocaleString()} XAF
                      </span>
                    </div>
                    
                    {order.status === 'in_transit' && (
                      <button
                        onClick={() => handleCompleteDelivery(order.id)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Mark Delivered</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}