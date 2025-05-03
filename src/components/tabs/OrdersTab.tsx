
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from '@/components/ui/separator';
import { useOrdersData } from '@/hooks/useOrdersData';
import TransactionSection from '../orders/TransactionSection';
import OrdersTable from '../orders/OrdersTable';

interface OrdersTabProps {
  apiUrl: string;
  useLocalData: boolean;
  updateInvokedUrl: (path: string, params: Record<string, string>) => void;
}

const OrdersTab: React.FC<OrdersTabProps> = ({ apiUrl, useLocalData, updateInvokedUrl }) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  const { customers, products, orders, loading, loadOrders } = useOrdersData({
    apiUrl,
    useLocalData,
    selectedCustomerId,
    selectedProductId,
    updateInvokedUrl
  });

  // Handle transaction completion
  const handleTransactionComplete = () => {
    loadOrders();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Orders Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Transaction Section */}
          <TransactionSection 
            customers={customers}
            products={products}
            apiUrl={apiUrl}
            useLocalData={useLocalData}
            updateInvokedUrl={updateInvokedUrl}
            onTransactionComplete={handleTransactionComplete}
          />
          
          <Separator />
          
          {/* Orders Table Section */}
          <OrdersTable 
            orders={orders}
            customers={customers}
            products={products}
            selectedCustomerId={selectedCustomerId}
            selectedProductId={selectedProductId}
            setSelectedCustomerId={setSelectedCustomerId}
            setSelectedProductId={setSelectedProductId}
            loading={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default OrdersTab;
