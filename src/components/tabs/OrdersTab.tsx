
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Customer, Order, Product } from '@/types';
import { 
  fetchCustomers, 
  fetchProducts, 
  fetchOrders, 
  createOrder 
} from '@/services/apiService';
import { 
  getCustomerById, 
  getProductById, 
  getOrdersByFilters, 
  transactOrder as mockTransactOrder
} from '@/services/mockData';
import { toast } from '@/components/ui/use-toast';
import { Separator } from '@/components/ui/separator';

interface OrdersTabProps {
  apiUrl: string;
  useLocalData: boolean;
  updateInvokedUrl: (path: string, params: Record<string, string>) => void;
}

const OrdersTab: React.FC<OrdersTabProps> = ({ apiUrl, useLocalData, updateInvokedUrl }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [transactionLoading, setTransactionLoading] = useState<boolean>(false);
  
  // Load all customers and products on component mount
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        loadCustomers(),
        loadProducts()
      ]);
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
        result = getCustomerById();
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
        result = getProductById();
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
    
    // Only update invoked URL if we have a customer or product ID selected
    if (selectedCustomerId || selectedProductId) {
      const params: Record<string, string> = {};
      if (selectedCustomerId) params.CustomerID = selectedCustomerId;
      if (selectedProductId) params.ProductID = selectedProductId;
      updateInvokedUrl('GetOrders', params);
    } else {
      updateInvokedUrl('GetOrders');
    }
    
    try {
      let result: Order[];
      
      if (useLocalData) {
        result = getOrdersByFilters(selectedCustomerId, selectedProductId);
      } else if (apiUrl) {
        result = await fetchOrders(apiUrl, selectedCustomerId, selectedProductId);
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
  
  // Handle transaction button click
  const handleTransactOrder = async () => {
    if (!selectedCustomerId || !selectedProductId) {
      toast({
        title: "Error",
        description: "Please select both a customer and a product",
        variant: "destructive",
      });
      return;
    }
    
    setTransactionLoading(true);
    updateInvokedUrl('TransactOrder', { 
      CustomerID: selectedCustomerId, 
      ProductID: selectedProductId 
    });
    
    try {
      let result;
      
      if (useLocalData) {
        result = mockTransactOrder(selectedCustomerId, selectedProductId);
      } else if (apiUrl) {
        result = await createOrder(apiUrl, selectedCustomerId, selectedProductId);
      } else {
        throw new Error('No data source available');
      }
      
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        // Reload orders to show the new order
        loadOrders();
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Transaction failed:', error);
      toast({
        title: "Error",
        description: `Transaction failed: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setTransactionLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Orders Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Transaction Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Transact Order</h3>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.CustomerID} value={customer.CustomerID}>
                        {customer.Name} ({customer.CustomerID})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem key={product.ProductID} value={product.ProductID}>
                        {product.Name} ({product.ProductID})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleTransactOrder} 
                disabled={!selectedCustomerId || !selectedProductId || transactionLoading}
              >
                {transactionLoading ? "Processing..." : "Transact Order"}
              </Button>
            </div>
          </div>
          
          <Separator />
          
          {/* Orders Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Browse Orders</h3>
            
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1">
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Customers</SelectItem>
                    {customers.map(customer => (
                      <SelectItem key={customer.CustomerID} value={customer.CustomerID}>
                        {customer.Name} ({customer.CustomerID})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by Product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Products</SelectItem>
                    {products.map(product => (
                      <SelectItem key={product.ProductID} value={product.ProductID}>
                        {product.Name} ({product.ProductID})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-10">Loading orders...</div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Order Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length > 0 ? (
                      orders.map((order) => (
                        <TableRow key={order.OrderID}>
                          <TableCell className="font-medium">{order.OrderID}</TableCell>
                          <TableCell>{order.CustomerName || order.CustomerID}</TableCell>
                          <TableCell>{order.ProductName || order.ProductID}</TableCell>
                          <TableCell>{order.Quantity}</TableCell>
                          <TableCell>{order.OrderDate}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6">
                          No orders found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrdersTab;
