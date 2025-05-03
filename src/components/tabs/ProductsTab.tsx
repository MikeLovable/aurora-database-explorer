
import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Product } from '@/types';
import { fetchProducts } from '@/services/apiService';
import { getProductById } from '@/services/mockData';
import { SearchIcon } from 'lucide-react';

interface ProductsTabProps {
  apiUrl: string;
  useLocalData: boolean;
  updateInvokedUrl: (path: string, params: Record<string, string>) => void;
}

const ProductsTab: React.FC<ProductsTabProps> = ({ apiUrl, useLocalData, updateInvokedUrl }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchId, setSearchId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  // Load all products initially
  useEffect(() => {
    loadProducts();
  }, [apiUrl, useLocalData]);

  // Function to load products based on search ID
  const loadProducts = async (id?: string) => {
    setLoading(true);
    
    // Update the invoked URL first
    updateInvokedUrl('GetProducts', id ? { ProductID: id } : {});
    
    try {
      let result: Product[];
      
      if (useLocalData) {
        // Use mock data service
        result = getProductById(id);
      } else if (apiUrl) {
        // Use API service
        result = await fetchProducts(apiUrl, id);
      } else {
        result = [];
      }
      
      setProducts(result);
    } catch (error) {
      console.error('Failed to load products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle search button click
  const handleSearch = () => {
    loadProducts(searchId);
  };

  // Handle clearing the search
  const handleClear = () => {
    setSearchId('');
    loadProducts();
  };

  // Format price with currency symbol
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Browse Products</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-grow max-w-md">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by Product ID"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button onClick={handleSearch}>Search</Button>
          <Button variant="outline" onClick={handleClear}>Clear</Button>
        </div>
        
        {loading ? (
          <div className="text-center py-10">Loading products...</div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length > 0 ? (
                  products.map((product) => (
                    <TableRow key={product.ProductID}>
                      <TableCell className="font-medium">{product.ProductID}</TableCell>
                      <TableCell>{product.Name}</TableCell>
                      <TableCell>{product.Description}</TableCell>
                      <TableCell>{formatPrice(product.Price)}</TableCell>
                      <TableCell>{product.Category || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      No products found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductsTab;
