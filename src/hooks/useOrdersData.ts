
import { useState, useEffect } from 'react';
import { Customer, Product, Order } from '@/types';
import { 
  fetchCustomers, 
  fetchProducts, 
  fetchOrders 
} from '@/services/apiService';
import { 
  getCustomerById, 
  getProductById, 
  getOrdersByFilters 
} from '@/services/mockData';

interface UseOrdersDataProps {
  apiUrl: string;
  useLocalData: boolean;
  selectedCustomerId: string;
  selectedProductId: string;
  updateInvokedUrl: (path: string, params: Record<string, string>) => void;
}

export const useOrdersData = ({
  apiUrl,
  useLocalData,
  selectedCustomerId,
  selectedProductId,
  updateInvokedUrl
}: UseOrdersDataProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load all customers and products on hook mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        loadCustomers(),
        loadProducts()
      ]);
      setLoading(false);
    };
    
    loadData();
  }, [apiUrl, useLocalData]);
  
  // Load orders when selectedCustomerId or selectedProductId changes
  useEffect(() => {
    loadOrders();
  }, [selectedCustomerId, selectedProductId, apiUrl, useLocalData]);
  
  // Load customers
  const loadCustomers = async () => {
    try {
      let result: Customer[];
      
      if (useLocalData) {
        result = getCustomerById(undefined);
      } else if (apiUrl) {
        result = await fetchCustomers(apiUrl);
      } else {
        result = [];
      }
      
      setCustomers(result);
    } catch (error) {
      console.error('Failed to load customers:', error);
      setCustomers([]);
    }
  };
  
  // Load products
  const loadProducts = async () => {
    try {
      let result: Product[];
      
      if (useLocalData) {
        result = getProductById(undefined);
      } else if (apiUrl) {
        result = await fetchProducts(apiUrl);
      } else {
        result = [];
      }
      
      setProducts(result);
    } catch (error) {
      console.error('Failed to load products:', error);
      setProducts([]);
    }
  };
  
  // Load orders based on selected customer and product IDs
  const loadOrders = async () => {
    setLoading(true);
    
    const effectiveCustomerId = selectedCustomerId === 'all' ? '' : selectedCustomerId;
    const effectiveProductId = selectedProductId === 'all' ? '' : selectedProductId;
    
    // Only update invoked URL if we have a customer or product ID selected
    if (effectiveCustomerId || effectiveProductId) {
      const params: Record<string, string> = {};
      if (effectiveCustomerId) params.CustomerID = effectiveCustomerId;
      if (effectiveProductId) params.ProductID = effectiveProductId;
      updateInvokedUrl('GetOrders', params);
    } else {
      updateInvokedUrl('GetOrders', {});
    }
    
    try {
      let result: Order[];
      
      if (useLocalData) {
        result = getOrdersByFilters(effectiveCustomerId, effectiveProductId);
      } else if (apiUrl) {
        result = await fetchOrders(apiUrl, effectiveCustomerId, effectiveProductId);
      } else {
        result = [];
      }
      
      setOrders(result);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    customers,
    products,
    orders,
    loading,
    loadOrders
  };
};
