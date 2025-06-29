import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem } from './CartContext';

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  restaurantId: string;
  restaurantName: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'in_transit' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  deliveryAddress: string;
  phone: string;
  agentId?: string;
  agentName?: string;
}

interface OrderContextType {
  orders: Order[];
  createOrder: (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateOrderStatus: (orderId: string, status: Order['status'], agentId?: string) => void;
  getOrdersByCustomer: (customerId: string) => Order[];
  getOrdersByRestaurant: (restaurantId: string) => Order[];
  getAvailableDeliveries: () => Order[];
  getOrdersByAgent: (agentId: string) => Order[];
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const savedOrders = localStorage.getItem('smartbite_orders');
    if (savedOrders) {
      const parsed = JSON.parse(savedOrders);
      setOrders(parsed.map((order: any) => ({
        ...order,
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt)
      })));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('smartbite_orders', JSON.stringify(orders));
  }, [orders]);

  const createOrder = (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): string => {
    const orderId = Date.now().toString();
    const newOrder: Order = {
      ...orderData,
      id: orderId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setOrders(prev => [newOrder, ...prev]);
    
    // Simulate real-time updates
    setTimeout(() => {
      updateOrderStatus(orderId, 'preparing');
    }, 30000); // 30 seconds

    return orderId;
  };

  const updateOrderStatus = (orderId: string, status: Order['status'], agentId?: string) => {
    setOrders(prev =>
      prev.map(order =>
        order.id === orderId
          ? {
              ...order,
              status,
              updatedAt: new Date(),
              ...(agentId && { agentId, agentName: `Agent ${agentId}` })
            }
          : order
      )
    );
  };

  const getOrdersByCustomer = (customerId: string) => {
    return orders.filter(order => order.customerId === customerId);
  };

  const getOrdersByRestaurant = (restaurantId: string) => {
    return orders.filter(order => order.restaurantId === restaurantId);
  };

  const getAvailableDeliveries = () => {
    return orders.filter(order => order.status === 'ready' && !order.agentId);
  };

  const getOrdersByAgent = (agentId: string) => {
    return orders.filter(order => order.agentId === agentId);
  };

  return (
    <OrderContext.Provider value={{
      orders,
      createOrder,
      updateOrderStatus,
      getOrdersByCustomer,
      getOrdersByRestaurant,
      getAvailableDeliveries,
      getOrdersByAgent
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