
import { Customer, Product, Order, ApiResponse, TransactionResponse } from '@/types';
import { toast } from '@/components/ui/use-toast';

/**
 * Fetches customers from the API
 * @param baseUrl The base URL for the API
 * @param customerId Optional customer ID to filter by
 */
export const fetchCustomers = async (
  baseUrl: string,
  customerId?: string
): Promise<Customer[]> => {
  try {
    const url = `${baseUrl}/GetCustomers${customerId ? `?CustomerID=${customerId}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data: ApiResponse<Customer> = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching customers:', error);
    toast({
      title: "Error",
      description: `Failed to fetch customers: ${(error as Error).message}`,
      variant: "destructive",
    });
    return [];
  }
};

/**
 * Fetches products from the API
 * @param baseUrl The base URL for the API
 * @param productId Optional product ID to filter by
 */
export const fetchProducts = async (
  baseUrl: string,
  productId?: string
): Promise<Product[]> => {
  try {
    const url = `${baseUrl}/GetProducts${productId ? `?ProductID=${productId}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data: ApiResponse<Product> = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching products:', error);
    toast({
      title: "Error",
      description: `Failed to fetch products: ${(error as Error).message}`,
      variant: "destructive",
    });
    return [];
  }
};

/**
 * Fetches orders from the API
 * @param baseUrl The base URL for the API
 * @param customerId Optional customer ID to filter by
 * @param productId Optional product ID to filter by
 */
export const fetchOrders = async (
  baseUrl: string,
  customerId?: string,
  productId?: string
): Promise<Order[]> => {
  try {
    let queryParams = [];
    if (customerId) queryParams.push(`CustomerID=${customerId}`);
    if (productId) queryParams.push(`ProductID=${productId}`);
    
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    const url = `${baseUrl}/GetOrders${queryString}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data: ApiResponse<Order> = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching orders:', error);
    toast({
      title: "Error",
      description: `Failed to fetch orders: ${(error as Error).message}`,
      variant: "destructive",
    });
    return [];
  }
};

/**
 * Creates a new order transaction
 * @param baseUrl The base URL for the API
 * @param customerId The customer ID
 * @param productId The product ID
 */
export const createOrder = async (
  baseUrl: string,
  customerId: string,
  productId: string
): Promise<TransactionResponse> => {
  try {
    const url = `${baseUrl}/TransactOrder`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ CustomerID: customerId, ProductID: productId }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating order:', error);
    return {
      success: false,
      message: `Failed to create order: ${(error as Error).message}`,
    };
  }
};
