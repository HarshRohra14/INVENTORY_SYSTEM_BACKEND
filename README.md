# Inventory Management & Stock Request System

A comprehensive inventory management system with BoxHero API integration, built with Node.js, Express, Prisma, MySQL, and Next.js.

## 🏗️ Project Structure

```
Inventory Management System/
├── src/                          # Backend source code
│   ├── controllers/              # Route controllers
│   │   └── authController.js     # Authentication logic
│   ├── middleware/               # Custom middleware
│   │   ├── authMiddleware.js     # JWT authentication
│   │   └── roleMiddleware.js     # Role-based access control
│   ├── routes/                   # API routes
│   │   └── authRoutes.js         # Authentication routes
│   ├── services/                 # Business logic services
│   │   └── boxHeroService.js     # BoxHero API integration
│   └── server.js                 # Main server file
├── prisma/                       # Database schema and migrations
│   └── schema.prisma             # Database schema definition
├── frontend/                     # Next.js frontend application
├── package.json                  # Backend dependencies
├── env.example                   # Environment variables template
└── README.md                     # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- MySQL 8.0+
- npm or yarn

### Backend Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   Edit `.env` with your database credentials and API keys.

3. **Set up the database:**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   ```

4. **Start the backend server:**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the frontend development server:**
   ```bash
   npm run dev
   ```

## 📊 Database Schema

The system uses the following main entities:

- **Users**: Authentication and role management
- **Branches**: Multi-branch structure support
- **Items**: Inventory items synced from BoxHero
- **Orders**: Stock requests from branch users
- **Order_Items**: Specific items in each order
- **Tracking**: Courier and delivery tracking
- **Notifications**: System alerts and notifications

## 🔐 Authentication & Authorization

### User Roles

- **ADMIN**: Full system access
- **MANAGER**: Can manage orders and users in assigned branches
- **BRANCH_USER**: Can create stock requests
- **ACCOUNTS**: Read-only access to financial data

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user (Admin/Manager only)
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout user

## 🔄 BoxHero Integration

The system includes a comprehensive BoxHero API service with the following functions:

- `syncInventoryFromBoxHero()` - Syncs inventory data every 10 minutes
- `updateBoxHeroStock()` - Updates stock levels when orders are dispatched
- `getBoxHeroStockLevels()` - Fetches current stock levels
- `getBoxHeroCategories()` - Fetches product categories

## ⏰ Scheduled Tasks

- **Inventory Sync**: Runs every 10 minutes to keep local data fresh
- **Notifications**: Automatic alerts for low stock and system events

## 🛠️ Development

### Available Scripts

```bash
# Backend
npm run dev          # Start development server with nodemon
npm start            # Start production server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes to database
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio

# Frontend
cd frontend
npm run dev          # Start Next.js development server
npm run build        # Build for production
npm run start        # Start production server
```

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="mysql://username:password@localhost:3306/inventory_management"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# BoxHero API
BOXHERO_API_KEY="your-boxhero-api-key"
BOXHERO_BASE_URL="https://api.boxhero.com"

# Server
PORT=3001
NODE_ENV="development"
```

## 📋 Phase 1 Implementation Status

✅ **Completed:**
- Database schema with all required tables and relationships
- JWT-based authentication system
- Role-based access control (RBAC)
- BoxHero API service with stubbed functions
- Express server with middleware and security
- Next.js frontend initialization with Tailwind CSS
- Scheduled inventory sync (every 10 minutes)

🔄 **Next Steps (Phase 2):**
- Branch User dashboard and item listing
- Shopping cart functionality
- Order creation and management
- Manager approval workflow

## 🔧 Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Prisma** - Database ORM
- **MySQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **node-cron** - Scheduled tasks

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **App Router** - Next.js routing

## 📞 Support

For questions or issues, please contact the development team.

---

**Note**: This is Phase 1 of the Inventory Management System. The system is designed to be scalable and will include additional features in subsequent phases.
