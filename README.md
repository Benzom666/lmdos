# Delivery System

A comprehensive delivery management system built with Next.js, featuring advanced route optimization, real-time tracking, and multi-role user management.

## 🚀 Features

- **Multi-Role Authentication**: Super Admin, Admin, and Driver roles with different permissions
- **Advanced Route Optimization**: AI-powered route planning with traffic consideration
- **Real-time Tracking**: Live order status updates and driver location tracking
- **Interactive Maps**: Leaflet-based mapping with geocoding and route visualization
- **Bulk Operations**: CSV import/export, bulk order management
- **PWA Support**: Offline functionality and mobile app-like experience
- **Dark Mode**: System-wide theme support
- **Responsive Design**: Mobile-first approach with Tailwind CSS

## 🛠️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS + shadcn/ui
- **Maps**: Leaflet with OpenStreetMap
- **State Management**: React Context + Hooks
- **Type Safety**: TypeScript
- **Testing**: Jest + React Testing Library

## 📦 Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd delivery-system
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Set up environment variables:
\`\`\`bash
cp .env.example .env.local
\`\`\`

4. Configure your Supabase project:
   - Create a new Supabase project
   - Run the database migrations from the `sql/` directory
   - Update your environment variables

5. Start the development server:
\`\`\`bash
npm run dev
\`\`\`

## 🏗️ Project Structure

\`\`\`
delivery-system/
├── app/                    # Next.js App Router pages
│   ├── admin/             # Admin dashboard pages
│   ├── driver/            # Driver interface pages
│   ├── super-admin/       # Super admin pages
│   └── api/               # API routes
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   └── ...               # Custom components
├── contexts/             # React contexts
├── lib/                  # Utility functions and services
├── hooks/                # Custom React hooks
└── sql/                  # Database schemas and migrations
\`\`\`

## 🔧 Configuration

### Environment Variables

Required environment variables:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
\`\`\`

### Database Setup

1. Run the database migrations in order:
   - `database-schema-updates.sql`
   - `enhanced-pod-schema.sql`
   - `persistent-route-schema.sql`

2. Set up Row Level Security (RLS) policies for your tables

## 🧪 Testing

Run the test suite:

\`\`\`bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
\`\`\`

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Configure environment variables
3. Deploy automatically on push to main

### Manual Deployment

\`\`\`bash
# Build the application
npm run build

# Start production server
npm start
\`\`\`

## 📱 PWA Features

The application includes Progressive Web App features:

- Offline functionality
- App-like experience on mobile devices
- Push notifications (when configured)
- Installable on devices

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- JWT-based authentication
- CSRF protection
- Input validation and sanitization
- Secure headers configuration

## 🎨 UI/UX

- **Design System**: Built with shadcn/ui components
- **Responsive**: Mobile-first design approach
- **Accessibility**: WCAG 2.1 AA compliant
- **Dark Mode**: System preference detection
- **Loading States**: Skeleton loaders and spinners

## 📊 Performance

- **Code Splitting**: Automatic route-based splitting
- **Image Optimization**: Next.js Image component
- **Bundle Analysis**: Webpack bundle analyzer
- **Core Web Vitals**: Performance monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the documentation
- Contact the development team

## 🔄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.




## 🛍️ **Complete Shopify Integration Guide**

I've created a comprehensive Shopify integration system for your delivery platform. Here's how to connect your Shopify store:

### 🚀 **Quick Setup Steps**

#### **1. Create Shopify Private App**

- Go to your Shopify admin → **Apps** → **App and sales channel settings**
- Click **"Develop apps"** → **"Create an app"**
- Name it "DeliveryOS Integration"


#### **2. Configure API Permissions**

Grant these **Admin API scopes**:

- ✅ `read_orders` - View order information
- ✅ `write_orders` - Update order status
- ✅ `read_products` - Access product details
- ✅ `read_customers` - View customer information
- ✅ `write_fulfillments` - Create fulfillments
- ✅ `read_fulfillments` - View fulfillment status


#### **3. Get Your Access Token**

- Install the app in your Shopify admin
- Copy the **Admin API access token** (starts with `shpat_`)
- Note your shop domain: `your-store.myshopify.com`


#### **4. Connect to DeliveryOS**

- Navigate to **Admin → Integrations → Shopify Integration**
- Click **"Connect Store"**
- Enter your shop domain and access token
- Test the connection


#### **5. Setup Webhooks (Optional but Recommended)**

- **Webhook URL**: `https://your-domain.com/api/webhooks/shopify`
- **Events**: `orders/create`, `orders/updated`, `orders/paid`, `orders/cancelled`, `orders/fulfilled`


### 🔧 **Features Included**

#### **📦 Automatic Order Sync**

- **Real-time synchronization** of new orders from Shopify
- **Automatic delivery order creation** with customer details
- **Order status updates** synced back to Shopify
- **Bulk order import** for existing orders


#### **⚙️ Smart Configuration**

- **Auto-create orders**: Automatically create delivery orders for new Shopify orders
- **Auto-assign drivers**: Optionally assign drivers automatically
- **Status synchronization**: Keep Shopify and DeliveryOS in sync
- **Email notifications**: Get notified of important events


#### **🔒 Security & Reliability**

- **Webhook signature verification** for secure communication
- **Encrypted token storage** for API credentials
- **Error handling and logging** for troubleshooting
- **Rate limiting protection** to prevent API abuse


#### **📊 Analytics & Monitoring**

- **Order sync statistics** and success rates
- **Connection health monitoring** with test functionality
- **Webhook delivery logs** for debugging
- **Performance metrics** and usage tracking


### 🎯 **What Happens After Connection**

1. **New Shopify orders** automatically appear in your delivery dashboard
2. **Customer information** is imported including name, phone, email, and address
3. **Order details** like items, total price, and special instructions are synced
4. **Delivery status updates** are sent back to Shopify when orders are completed
5. **Real-time notifications** keep you informed of new orders


### 🛠️ **Advanced Configuration**

#### **Custom Order Mapping**

- Map Shopify order fields to delivery system fields
- Set priority levels based on order value or customer type
- Configure pickup locations for different product types


#### **Driver Assignment Rules**

- Auto-assign based on delivery location
- Priority assignment for VIP customers
- Load balancing across available drivers


#### **Fulfillment Integration**

- Mark orders as fulfilled in Shopify when delivered
- Add tracking information and delivery photos
- Send customer notifications through Shopify


The integration is now **fully functional** and ready to streamline your Shopify order fulfillment process! 🎉
