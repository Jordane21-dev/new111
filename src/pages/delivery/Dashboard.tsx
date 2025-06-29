import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../contexts/OrderContext';
import { Truck, Package, DollarSign, Clock, TrendingUp, MapPin } from 'lucide-react';

export default function DeliveryDashboard() {
  const { user } = useAuth();
  const { getAvailableDeliveries, getOrdersByAgent } = useOrders();

  const availableDeliveries = getAvailableDeliveries();
  const myDeliveries = user ? getOrdersByAgent(user.id) : [];
  
  const activeDeliveries = myDeliveries.filter(order => order.status === 'in_transit');
  const completedDeliveries = myDeliveries.filter(order => order.status === 'delivered');
  
  const totalEarnings = completedDeliveries.reduce((sum, order) => {
    // Assuming delivery fee is 10% of order total (simplified calculation)
    return sum + (order.total * 0.1);
  }, 0);

  const todayDeliveries = completedDeliveries.filter(order => {
    const today = new Date();
    const orderDate = new Date(order.createdAt);
    return orderDate.toDateString() === today.toDateString();
  });

  return (
    <Layout title="Delivery Dashboard">
      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-600 text-white p-3 rounded-xl">
              <Package className="h-6 w-6" />
            </div>
            <span className="text-blue-600 text-sm font-medium">Available</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{availableDeliveries.length}</div>
          <div className="text-gray-600 text-sm">Available Deliveries</div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-orange-600 text-white p-3 rounded-xl">
              <Truck className="h-6 w-6" />
            </div>
            <span className="text-orange-600 text-sm font-medium">Active</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{activeDeliveries.length}</div>
          <div className="text-gray-600 text-sm">Active Deliveries</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-600 text-white p-3 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
            <span className="text-green-600 text-sm font-medium">Today</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{todayDeliveries.length}</div>
          <div className="text-gray-600 text-sm">Deliveries Today</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-600 text-white p-3 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
            <span className="text-purple-600 text-sm font-medium">Total</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {totalEarnings.toLocaleString()} XAF
          </div>
          <div className="text-gray-600 text-sm">Total Earnings</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-orange-100">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h3>
          <div className="space-y-4">
            <Link
              to="/delivery-jobs"
              className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200 hover:from-blue-100 hover:to-blue-200 transition-all duration-200 group"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-blue-600 text-white p-2 rounded-lg group-hover:scale-110 transition-transform">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">View Available Jobs</div>
                  <div className="text-sm text-gray-600">{availableDeliveries.length} available</div>
                </div>
              </div>
              <div className="text-blue-600">→</div>
            </Link>

            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl border border-orange-200">
              <div className="flex items-center space-x-3">
                <div className="bg-orange-600 text-white p-2 rounded-lg">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">Active Deliveries</div>
                  <div className="text-sm text-gray-600">{activeDeliveries.length} in progress</div>
                </div>
              </div>
              <div className="text-orange-600">{activeDeliveries.length}</div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-orange-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">Recent Deliveries</h3>
            <Link
              to="/delivery-jobs"
              className="text-orange-600 hover:text-orange-700 text-sm font-medium"
            >
              View All →
            </Link>
          </div>
          
          {myDeliveries.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No deliveries yet</p>
              <p className="text-sm text-gray-400 mt-1">Start accepting delivery jobs to see them here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myDeliveries.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      order.status === 'delivered' ? 'bg-green-500' :
                      order.status === 'in_transit' ? 'bg-blue-500' :
                      'bg-yellow-500'
                    }`} />
                    <div>
                      <div className="font-medium text-gray-900">#{order.id}</div>
                      <div className="text-sm text-gray-600">{order.restaurantName}</div>
                      <div className="text-xs text-gray-500 flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {order.deliveryAddress.substring(0, 30)}...
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-green-600">
                      +{(order.total * 0.1).toLocaleString()} XAF
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-600' :
                      order.status === 'in_transit' ? 'bg-blue-100 text-blue-600' :
                      'bg-yellow-100 text-yellow-600'
                    }`}>
                      {order.status === 'in_transit' ? 'In Transit' : 
                       order.status === 'delivered' ? 'Delivered' : order.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Available Deliveries Preview */}
      {availableDeliveries.length > 0 && (
        <div className="mt-8">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">🚚 New Deliveries Available!</h3>
                <p className="text-blue-100">
                  {availableDeliveries.length} delivery job{availableDeliveries.length > 1 ? 's' : ''} waiting for pickup
                </p>
              </div>
              <Link
                to="/delivery-jobs"
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors transform hover:scale-105"
              >
                View Jobs
              </Link>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}