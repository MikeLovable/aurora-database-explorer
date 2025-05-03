
// Define types for our application

export interface Customer {
  CustomerID: string;
  Name: string;
  Email: string;
  Phone?: string;
  Address?: string;
}

export interface Product {
  ProductID: string;
  Name: string;
  Description: string;
  Price: number;
  Category?: string;
}

export interface Order {
  OrderID: string;
  CustomerID: string;
  ProductID: string;
  Quantity: number;
  OrderDate: string;
  CustomerName?: string;
  ProductName?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
}

export interface TransactionResponse {
  success: boolean;
  message: string;
  orderId?: string;
}
