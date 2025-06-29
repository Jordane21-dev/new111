import React, { createContext, useContext, useState, useEffect } from 'react';
import { ordersAPI } from '../services/api';
import { useAuth } from './AuthContext';

export interface OrderItem {
  id: string;
  menu_item_id: string;
  quantity: number;
  price: number;
  name: string;
  image?: string;
}

export interface Order {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_image?: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'in_transit' | 'delivered' | 'cancelled';
  created_at: string;
  updated_at: string;
  delivery_address: string;
  payment_method: string;
  payment_status: string;
  agent_id?: string;
  agent_name?: string;
}

interface OrderContextType {
  orders: Order[];
  loading: boolean;
  createOrder: (orderData: any) => Promise<string>;
  updateOrderStatus: (orderId: string, status: Order['status'], agentId?: string) => Promise<void>;
  getCustomerOrders: () => Promise<void>;
  getRestaurantOrders: () => Promise<void>;
  getAvailableDeliveries: () => Promise<Order[]>;
  getAgentOrders: () => Promise<void>;
  acceptDelivery: (orderId: string) => Promise<void>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const createOrder = async (orderData: any): Promise<string> => {
    try {
      setLoading(true);
      console.log('Creating order:', orderData);
      
      const response = await ordersAPI.createOrder(orderData);
      
      // Refresh orders after creation
      if (user?.role === 'customer') {
        await getCustomerOrders();
      }
      
      return response.data.orderId;
    } catch (error: any) {
      console.error('Failed to create order:', error);
      throw new Error(error.response?.data?.error || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status'], agentId?: string): Promise<void> => {
    try {
      await ordersAPI.updateOrderStatus(orderId, { status, agent_id: agentId });
      
      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status, updated_at: new Date().toISOString(), ...(agentId && { agent_id: agentId }) }
          : order
      ));
    } catch (error: any) {
      console.error('Failed to update order status:', error);
      throw new Error(error.response?.data?.error || 'Failed to update order status');
    }
  };

  const getCustomerOrders = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await ordersAPI.getCustomerOrders();
      setOrders(response.data || []);
    } catch (error) {
      console.error('Failed to fetch customer orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getRestaurantOrders = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await ordersAPI.getRestaurantOrders();
      setOrders(response.data || []);
    } catch (error) {
      console.error('Failed to fetch restaurant orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableDeliveries = async (): Promise<Order[]> => {
    try {
      const response = await ordersAPI.getAvailableDeliveries();
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch available deliveries:', error);
      return [];
    }
  };

  const getAgentOrders = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await ordersAPI.getAgentOrders();
      setOrders(response.data || []);
    } catch (error) {
      console.error('Failed to fetch agent orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const acceptDelivery = async (orderId: string): Promise<void> => {
    try {
      await ordersAPI.acceptDelivery(orderId);
      
      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status: 'in_transit', agent_id: user?.id, updated_at: new Date().toISOString() }
          : order
      ));
    } catch (error: any) {
      console.error('Failed to accept delivery:', error);
      throw new Error(error.response?.data?.error || 'Failed to accept delivery');
    }
  };

  return (
    <OrderContext.Provider value={{
      orders,
      loading,
      createOrder,
      updateOrderStatus,
      getCustomerOrders,
      getRestaurantOrders,
      getAvailableDeliveries,
      getAgentOrders,
      acceptDelivery
    }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
}