
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import CustomersTab from '@/components/tabs/CustomersTab';
import ProductsTab from '@/components/tabs/ProductsTab';
import OrdersTab from '@/components/tabs/OrdersTab';
import { toast } from '@/components/ui/use-toast';

const Index = () => {
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [acceptedUrl, setAcceptedUrl] = useState<string>('');
  const [invokedUrl, setInvokedUrl] = useState<string>('LOCAL');
  const [useLocalData, setUseLocalData] = useState<boolean>(true);

  // Handle accepting the backend URL
  const handleAcceptUrl = () => {
    if (!backendUrl) {
      toast({
        title: "Error",
        description: "Please enter a valid backend URL",
        variant: "destructive",
      });
      return;
    }
    
    // Remove trailing slash if present
    const formattedUrl = backendUrl.endsWith('/') 
      ? backendUrl.slice(0, -1) 
      : backendUrl;
    
    setAcceptedUrl(formattedUrl);
    toast({
      title: "Success",
      description: "Backend URL has been set",
    });
  };

  // Update the invokedUrl whenever an API call is made
  const updateInvokedUrl = (path: string, params: Record<string, string> = {}) => {
    if (useLocalData) {
      setInvokedUrl('LOCAL');
      return;
    }

    // Build the query string from params
    const queryParams = Object.entries(params)
      .filter(([_, value]) => value) // Filter out empty values
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    const url = `${acceptedUrl}/${path}${queryParams ? `?${queryParams}` : ''}`;
    setInvokedUrl(url);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="bg-slate-900 text-white p-4 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold mb-4">HelloDB</h1>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex gap-2 items-center flex-grow">
              <Input
                type="text"
                placeholder="Enter Backend URL"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                className="max-w-md bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
              />
              <Button onClick={handleAcceptUrl} variant="secondary">
                Accept
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                id="localOrApi"
                checked={!useLocalData}
                onCheckedChange={(checked) => setUseLocalData(!checked)}
              />
              <Label htmlFor="localOrApi">
                {useLocalData ? "Using Local Data" : "Using API"}
              </Label>
            </div>
          </div>
          <div className="mt-2 text-sm text-slate-300">
            <span className="font-semibold">Invoked URL:</span> {invokedUrl}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4">
        <Tabs defaultValue="customers" className="w-full">
          <TabsList className="mb-4 w-full flex justify-start">
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>
          
          <TabsContent value="customers">
            <CustomersTab 
              apiUrl={acceptedUrl} 
              useLocalData={useLocalData} 
              updateInvokedUrl={updateInvokedUrl} 
            />
          </TabsContent>
          
          <TabsContent value="products">
            <ProductsTab 
              apiUrl={acceptedUrl} 
              useLocalData={useLocalData} 
              updateInvokedUrl={updateInvokedUrl} 
            />
          </TabsContent>
          
          <TabsContent value="orders">
            <OrdersTab 
              apiUrl={acceptedUrl} 
              useLocalData={useLocalData} 
              updateInvokedUrl={updateInvokedUrl} 
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
