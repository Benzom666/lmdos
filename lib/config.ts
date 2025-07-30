// Production configuration
export const config = {
  app: {
    name: "DeliveryOS",
    url: process.env.NODE_ENV === "production" ? "https://lmdsx.vercel.app" : "http://localhost:3000",
    version: "1.0.0",
  },
  api: {
    baseUrl: process.env.NODE_ENV === "production" ? "https://lmdsx.vercel.app/api" : "http://localhost:3000/api",
    timeout: 30000,
  },
  webhooks: {
    shopify: {
      endpoint:
        process.env.NODE_ENV === "production"
          ? "https://lmdsx.vercel.app/api/webhooks/shopify"
          : "http://localhost:3000/api/webhooks/shopify",
      secret: process.env.SHOPIFY_WEBHOOK_SECRET || "your-webhook-secret-here",
    },
  },
  features: {
    enableAnalytics: process.env.NODE_ENV === "production",
    enableErrorReporting: process.env.NODE_ENV === "production",
    enablePerformanceMonitoring: process.env.NODE_ENV === "production",
  },
  security: {
    enableCSP: process.env.NODE_ENV === "production",
    enableRateLimit: process.env.NODE_ENV === "production",
    maxRequestsPerMinute: 100,
  },
}

export const isDevelopment = process.env.NODE_ENV === "development"
export const isProduction = process.env.NODE_ENV === "production"
