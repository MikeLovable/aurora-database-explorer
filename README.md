
# HelloDB: A 3-Tier Web Application

HelloDB is a 3-tier web application built with React for the frontend UI, AWS API Gateway and Lambda for the backend API layer, and AWS Aurora PostgreSQL for the database layer.

## Project Structure

The project is organized as follows:

- `src/` - Contains the frontend React application code
- `cdk/` - Contains the AWS CDK infrastructure code for the backend

## Frontend Features

- Tabbed UI for browsing Customers, Products, and Orders
- Toggle between local mock data and live backend API
- Search and filter functionality for all data types
- Order transaction capability

## Backend Features

- AWS CDK infrastructure as code
- VPC with public and private subnets
- Aurora PostgreSQL Serverless V2 database
- API Gateway with Lambda integration
- Custom database initialization

## Getting Started

### Running the Frontend

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Open [http://localhost:8080](http://localhost:8080) in your browser.

### Deploying the Backend

1. Navigate to the CDK directory:
   ```
   cd cdk
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the TypeScript code:
   ```
   npm run build
   ```

4. Deploy to AWS:
   ```
   npm run cdk deploy
   ```

5. After deployment, note the API Gateway URL from the CloudFormation outputs and use it in the frontend application.

## API Endpoints

The API provides the following endpoints:

- `GET /GetProducts` - Get all products or filter by ProductID
- `GET /GetCustomers` - Get all customers or filter by CustomerID
- `GET /GetOrders` - Get all orders or filter by CustomerID and/or ProductID
- `POST /TransactOrder` - Create a new order for a customer buying a product

## Development

To add new features or modify the application:

1. Frontend: Modify React components in the `src/` directory
2. Backend: Modify AWS CDK code in the `cdk/` directory

## License

This project is licensed under the MIT License.
