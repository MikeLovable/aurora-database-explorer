
import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Customer } from '@/types';
import { fetchCustomers } from '@/services/apiService';
import { getCustomerById } from '@/services/mockData';
import { SearchIcon } from 'lucide-react';

interface CustomersTabProps {
  apiUrl: string;
  useLocalData: boolean;
  updateInvokedUrl: (path: string, params: Record<string, string>) => void;
}

const CustomersTab: React.FC<CustomersTabProps> = ({ apiUrl, useLocalData, updateInvokedUrl }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchId, setSearchId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  // Load all customers initially
  useEffect(() => {
    loadCustomers();
  }, [apiUrl, useLocalData]);

  // Function to load customers based on search ID
  const loadCustomers = async (id?: string) => {
    setLoading(true);
    
    // Update the invoked URL first
    updateInvokedUrl('GetCustomers', id ? { CustomerID: id } : {});
    
    try {
      let result: Customer[];
      
      if (useLocalData) {
        // Use mock data service
        result = getCustomerById(id);
      } else if (apiUrl) {
        // Use API service
        result = await fetchCustomers(apiUrl, id);
      } else {
        result = [];
      }
      
      setCustomers(result);
    } catch (error) {
      console.error('Failed to load customers:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle search button click
  const handleSearch = () => {
    loadCustomers(searchId);
  };

  // Handle clearing the search
  const handleClear = () => {
    setSearchId('');
    loadCustomers();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Browse Customers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-grow max-w-md">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by Customer ID"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button onClick={handleSearch}>Search</Button>
          <Button variant="outline" onClick={handleClear}>Clear</Button>
        </div>
        
        {loading ? (
          <div className="text-center py-10">Loading customers...</div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length > 0 ? (
                  customers.map((customer) => (
                    <TableRow key={customer.CustomerID}>
                      <TableCell className="font-medium">{customer.CustomerID}</TableCell>
                      <TableCell>{customer.Name}</TableCell>
                      <TableCell>{customer.Email}</TableCell>
                      <TableCell>{customer.Phone || '-'}</TableCell>
                      <TableCell>{customer.Address || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      No customers found
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

export default CustomersTab;
