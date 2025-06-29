import React, { createContext, useContext, useState } from 'react';
import { menuAPI } from '../services/api';

export interface MenuItem {
  id: string;
  restaurant_id: string;
  item_name: string;
  item_description: string;
  item_price: number;
  image: string;
  category: string;
  is_available: boolean;
  prep_time: number;
}

interface MenuContextType {
  menuItems: MenuItem[];
  loading: boolean;
  addMenuItem: (item: any) => Promise<string>;
  updateMenuItem: (itemId: string, updates: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem: (itemId: string) => Promise<void>;
  toggleAvailability: (itemId: string) => Promise<void>;
  getMenuByRestaurant: (restaurantId: string) => Promise<MenuItem[]>;
  fetchMenuItems: (restaurantId: string) => Promise<void>;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMenuItems = async (restaurantId: string) => {
    try {
      setLoading(true);
      const response = await menuAPI.getMenuItems(restaurantId);
      setMenuItems(response.data);
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMenuItem = async (itemData: any): Promise<string> => {
    try {
      const response = await menuAPI.createMenuItem(itemData);
      await fetchMenuItems(itemData.restaurant_id);
      return response.data.itemId;
    } catch (error) {
      console.error('Failed to add menu item:', error);
      throw error;
    }
  };

  const updateMenuItem = async (itemId: string, updates: Partial<MenuItem>): Promise<void> => {
    try {
      await menuAPI.updateMenuItem(itemId, updates);
      // Refresh menu items for the restaurant
      const item = menuItems.find(item => item.id === itemId);
      if (item) {
        await fetchMenuItems(item.restaurant_id);
      }
    } catch (error) {
      console.error('Failed to update menu item:', error);
      throw error;
    }
  };

  const deleteMenuItem = async (itemId: string): Promise<void> => {
    try {
      const item = menuItems.find(item => item.id === itemId);
      await menuAPI.deleteMenuItem(itemId);
      if (item) {
        await fetchMenuItems(item.restaurant_id);
      }
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      throw error;
    }
  };

  const toggleAvailability = async (itemId: string): Promise<void> => {
    try {
      const item = menuItems.find(item => item.id === itemId);
      if (item) {
        await updateMenuItem(itemId, { is_available: !item.is_available });
      }
    } catch (error) {
      console.error('Failed to toggle availability:', error);
      throw error;
    }
  };

  const getMenuByRestaurant = async (restaurantId: string): Promise<MenuItem[]> => {
    try {
      const response = await menuAPI.getMenuItems(restaurantId);
      return response.data;
    } catch (error) {
      console.error('Failed to get menu by restaurant:', error);
      return [];
    }
  };

  return (
    <MenuContext.Provider value={{
      menuItems,
      loading,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
      toggleAvailability,
      getMenuByRestaurant,
      fetchMenuItems
    }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
}