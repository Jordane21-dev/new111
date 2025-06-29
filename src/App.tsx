import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { OrderProvider } from './contexts/OrderContext';
import { RestaurantProvider } from './contexts/RestaurantContext';
import { MenuProvider } from './contexts/MenuContext';
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import CustomerDashboard from './pages/customer/Dashboard';
import RestaurantDashboard from './pages/restaurant/Dashboard';
import DeliveryDashboard from './pages/delivery/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import RestaurantDetail from './pages/customer/RestaurantDetail';
import MyOrders from './pages/customer/MyOrders';
import ManageMenu from './pages/restaurant/ManageMenu';
import RestaurantOrders from './pages/restaurant/Orders';
import DeliveryJobs from './pages/delivery/Jobs';
import AdminUsers from './pages/admin/Users';
import AdminRestaurants from './pages/admin/Restaurants';
import './index.css';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={`/${user.role}`} replace /> : <Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Customer Routes */}
      <Route path="/customer" element={
        <ProtectedRoute allowedRoles={['customer']}>
          <CustomerDashboard />
        </ProtectedRoute>
      } />
      <Route path="/restaurant/:id" element={
        <ProtectedRoute allowedRoles={['customer']}>
          <RestaurantDetail />
        </ProtectedRoute>
      } />
      <Route path="/my-orders" element={
        <ProtectedRoute allowedRoles={['customer']}>
          <MyOrders />
        </ProtectedRoute>
      } />
      
      {/* Restaurant Owner Routes */}
      <Route path="/owner" element={
        <ProtectedRoute allowedRoles={['owner']}>
          <RestaurantDashboard />
        </ProtectedRoute>
      } />
      <Route path="/manage-menu" element={
        <ProtectedRoute allowedRoles={['owner']}>
          <ManageMenu />
        </ProtectedRoute>
      } />
      <Route path="/restaurant-orders" element={
        <ProtectedRoute allowedRoles={['owner']}>
          <RestaurantOrders />
        </ProtectedRoute>
      } />
      
      {/* Delivery Agent Routes */}
      <Route path="/agent" element={
        <ProtectedRoute allowedRoles={['agent']}>
          <DeliveryDashboard />
        </ProtectedRoute>
      } />
      <Route path="/delivery-jobs" element={
        <ProtectedRoute allowedRoles={['agent']}>
          <DeliveryJobs />
        </ProtectedRoute>
      } />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminUsers />
        </ProtectedRoute>
      } />
      <Route path="/admin/restaurants" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminRestaurants />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <RestaurantProvider>
        <MenuProvider>
          <CartProvider>
            <OrderProvider>
              <Router>
                <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
                  <AppRoutes />
                </div>
              </Router>
            </OrderProvider>
          </CartProvider>
        </MenuProvider>
      </RestaurantProvider>
    </AuthProvider>
  );
}

export default App;