
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { Customer, Product } from '@/types';
import { createOrder } from '@/services/apiService';
import { transactOrder as mockTransactOrder } from '@/services/mockData';
import { toast } from '@/components/ui/use-toast';

interface TransactionSectionProps {
  customers: Customer[];
  products: Product[];
  apiUrl: string;
  useLocalData: boolean;
  updateInvokedUrl: (path: string, params: Record<string, string>) => void;
  onTransactionComplete: () => void;
}

const TransactionSection: React.FC<TransactionSectionProps> = ({
  customers,
  products,
  apiUrl,
  useLocalData,
  updateInvokedUrl,
  onTransactionComplete
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [transactionLoading, setTransactionLoading] = useState<boolean>(false);

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
        // Clear selections after successful transaction
        setSelectedCustomerId('');
        setSelectedProductId('');
        // Notify parent component to reload orders
        onTransactionComplete();
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
  );
};

export default TransactionSection;
