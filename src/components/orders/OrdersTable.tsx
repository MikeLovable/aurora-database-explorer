
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Order, Customer, Product } from '@/types';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";

interface OrdersTableProps {
  orders: Order[];
  customers: Customer[];
  products: Product[];
  selectedCustomerId: string;
  selectedProductId: string;
  setSelectedCustomerId: (id: string) => void;
  setSelectedProductId: (id: string) => void;
  loading: boolean;
}

const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  customers,
  products,
  selectedCustomerId,
  selectedProductId,
  setSelectedCustomerId,
  setSelectedProductId,
  loading
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Browse Orders</h3>
      
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1">
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
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
              <SelectItem value="all">All Products</SelectItem>
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
  );
};

export default OrdersTable;
