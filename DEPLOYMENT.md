# DeliveryOS Production Deployment Guide

## Environment Variables Required

Add these environment variables to your Vercel project:

### Supabase Configuration
\`\`\`
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
\`\`\`

### Production Configuration
\`\`\`
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://lmdsx.vercel.app
\`\`\`

### Shopify Integration (Optional)
\`\`\`
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here
\`\`\`

## Deployment Steps

### 1. Vercel Configuration
- Ensure your domain `lmdsx.vercel.app` is properly configured
- Set all required environment variables in Vercel dashboard
- Enable automatic deployments from your Git repository

### 2. Supabase Configuration
- Update your Supabase project settings:
  - Add `https://lmdsx.vercel.app` to allowed origins
  - Configure RLS policies for production
  - Set up proper database backups

### 3. Security Setup
- The system now includes:
  - Rate limiting (100 requests/minute per IP)
  - CORS protection
  - Content Security Policy headers
  - XSS protection
  - CSRF protection

### 4. Monitoring & Analytics
- Health check endpoint: `https://lmdsx.vercel.app/api/health`
- Error logging is configured for production
- Analytics tracking is enabled

### 5. Shopify Webhooks (if using Shopify integration)
Configure these webhook endpoints in your Shopify admin:
- Orders Create: `https://lmdsx.vercel.app/api/webhooks/shopify`
- Orders Update: `https://lmdsx.vercel.app/api/webhooks/shopify`
- Orders Cancelled: `https://lmdsx.vercel.app/api/webhooks/shopify`
- Orders Fulfilled: `https://lmdsx.vercel.app/api/webhooks/shopify`

## Production Features Enabled

✅ Rate limiting and security headers
✅ Error handling and logging
✅ Performance monitoring
✅ Health check endpoint
✅ Webhook signature verification
✅ Analytics tracking
✅ CORS configuration
✅ CSP headers

## Post-Deployment Checklist

- [ ] Test login functionality
- [ ] Verify admin dashboard access
- [ ] Test driver mobile interface
- [ ] Check Shopify integration (if applicable)
- [ ] Monitor health check endpoint
- [ ] Verify webhook endpoints (if using Shopify)
- [ ] Test rate limiting
- [ ] Check error logging

## Monitoring URLs

- Health Check: https://lmdsx.vercel.app/api/health
- API Documentation: https://lmdsx.vercel.app/api-docs
- Main Application: https://lmdsx.vercel.app

Your DeliveryOS system is now production-ready! 🚀
