# SmartBite with SERVESOFT Database Setup Guide

## Prerequisites

1. **XAMPP** - Make sure XAMPP is installed and running
2. **Node.js** - Version 18 or higher
3. **phpMyAdmin** - Comes with XAMPP

## Database Setup Steps

### 1. Start XAMPP Services
- Start **Apache** and **MySQL** services in XAMPP Control Panel
- Make sure both services are running (green status)

### 2. Create SERVESOFT Database
1. Open your browser and go to `http://localhost/phpmyadmin`
2. Click "New" to create a new database
3. Enter database name: `SERVESOFT`
4. Click "Create"

### 3. Import Database Schema
1. Select the `SERVESOFT` database
2. Click on the "SQL" tab
3. Copy and paste the entire SQL schema you provided (all the CREATE TABLE statements)
4. Click "Go" to execute the SQL

### 4. Configure Environment Variables
The `.env` file has been created with XAMPP defaults:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=SERVESOFT
```

### 5. Install Dependencies and Start
```bash
npm install
npm run dev
```

## Key Changes Made

### Database Mapping
The application has been adapted to work with your SERVESOFT schema:

- **User Management**: Uses `User` + `Account` tables for authentication
- **Role System**: Maps to `Customer`, `Admin`, `RestaurantStaff`, `RestaurantManager`, `DeliveryAgent`
- **Restaurants**: Uses `Restaurant` table with manager relationships
- **Menu**: Uses `MenuItem` table
- **Orders**: Will use `CustomerOrder` and `OrderItem` tables

### Role Mapping
- `customer` → `Customer` table
- `admin` → `Admin` table  
- `owner` → `RestaurantManager` (via `RestaurantStaff`)
- `agent` → `DeliveryAgent` (via `RestaurantStaff`)

### Authentication Flow
1. User registers → Creates records in `User`, `Account`, and role-specific tables
2. User logs in → Validates against `Account` table, determines role from related tables
3. JWT token includes user ID and role for authorization

## Testing the Setup

1. **Start the application**: `npm run dev`
2. **Register as admin**: Go to `/register` and create an admin account
3. **Register as restaurant owner**: Create an owner account
4. **Create a restaurant**: Use the restaurant dashboard
5. **Add menu items**: Use the menu management interface

## Troubleshooting

### Database Connection Issues
- Ensure XAMPP MySQL is running
- Check that SERVESOFT database exists
- Verify `.env` file settings match your XAMPP configuration

### Permission Issues
- Make sure the database user has proper permissions
- XAMPP default is `root` with no password

### Schema Issues
- Ensure all tables are created properly
- Check for foreign key constraint errors
- Verify data types match expectations

## Next Steps

1. **Complete Order System**: Implement `CustomerOrder`, `OrderItem`, `Cart`, `CartItem` integration
2. **Payment System**: Integrate with `Payment` table
3. **Delivery System**: Use `Delivery` and `DeliveryAgent` tables
4. **Reservation System**: Implement `Reservation` and `RestaurantTable` features

The application is now configured to work with your SERVESOFT database schema while maintaining the existing frontend functionality.