import React, { createContext, useContext, useState, useEffect } from 'react';
import { restaurantsAPI } from '../services/api';

export interface Restaurant {
  id: string;
  name: string;
  description: string;
  image: string;
  town: string;
  rating: number;
  delivery_time: string;
  delivery_fee: number;
  min_order: number;
  categories: string[];
  is_active: boolean;
  user_id: string;
  phone: string;
  address: string;
}

interface RestaurantContextType {
  restaurants: Restaurant[];
  loading: boolean;
  createRestaurant: (restaurantData: any) => Promise<string>;
  updateRestaurant: (restaurantId: string, updates: Partial<Restaurant>) => Promise<void>;
  getRestaurantByOwner: (ownerId: string) => Restaurant | undefined;
  fetchRestaurants: () => Promise<void>;
  myRestaurant: Restaurant | null;
  fetchMyRestaurant: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [myRestaurant, setMyRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const response = await restaurantsAPI.getRestaurants();
      setRestaurants(response.data);
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRestaurant = async () => {
    try {
      const response = await restaurantsAPI.getMyRestaurant();
      setMyRestaurant(response.data);
    } catch (error) {
      console.error('Failed to fetch my restaurant:', error);
      setMyRestaurant(null);
    }
  };

  const createRestaurant = async (restaurantData: any): Promise<string> => {
    try {
      const response = await restaurantsAPI.createRestaurant(restaurantData);
      await fetchMyRestaurant();
      await fetchRestaurants();
      return response.data.restaurantId;
    } catch (error) {
      console.error('Failed to create restaurant:', error);
      throw error;
    }
  };

  const updateRestaurant = async (restaurantId: string, updates: Partial<Restaurant>): Promise<void> => {
    try {
      await restaurantsAPI.updateRestaurant(restaurantId, updates);
      await fetchMyRestaurant();
      await fetchRestaurants();
    } catch (error) {
      console.error('Failed to update restaurant:', error);
      throw error;
    }
  };

  const getRestaurantByOwner = (ownerId: string) => {
    return restaurants.find(restaurant => restaurant.user_id === ownerId);
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  return (
    <RestaurantContext.Provider value={{
      restaurants,
      loading,
      createRestaurant,
      updateRestaurant,
      getRestaurantByOwner,
      fetchRestaurants,
      myRestaurant,
      fetchMyRestaurant
    }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurants() {
  const context = useContext(RestaurantContext);
  if (context === undefined) {
    throw new Error('useRestaurants must be used within a RestaurantProvider');
  }
  return context;
}