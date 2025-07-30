interface ShopifyApiConfig {
  maxRetries: number
  retryDelay: number
  timeout: number
  method?: string
  body?: string
}

const defaultConfig: ShopifyApiConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  timeout: 30000, // 30 seconds
  method: "GET",
}

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isRetryable = false,
  ) {
    super(message)
    this.name = "ShopifyApiError"
  }
}

export async function makeShopifyRequest(
  url: string,
  accessToken: string,
  options: Partial<ShopifyApiConfig> = {},
): Promise<any> {
  const config = { ...defaultConfig, ...options }

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(`🌐 Shopify API attempt ${attempt}/${config.maxRetries}: ${config.method} ${url}`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.timeout)

      const fetchOptions: RequestInit = {
        method: config.method,
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
          "User-Agent": "DeliveryOS/1.0",
          Accept: "application/json",
        },
        signal: controller.signal,
      }

      if (config.body && config.method !== "GET") {
        fetchOptions.body = config.body
      }

      const response = await fetch(url, fetchOptions)

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        const isRetryable = response.status >= 500 || response.status === 429

        throw new ShopifyApiError(`Shopify API error (${response.status}): ${errorText}`, response.status, isRetryable)
      }

      const data = await response.json()
      console.log(`✅ Shopify API success on attempt ${attempt}`)
      return data
    } catch (error) {
      console.error(`❌ Shopify API attempt ${attempt} failed:`, error)

      // Don't retry on the last attempt
      if (attempt === config.maxRetries) {
        if (error instanceof ShopifyApiError) {
          throw error
        }

        // Handle network errors
        if (error instanceof TypeError && error.message.includes("fetch")) {
          throw new ShopifyApiError(
            "Network error: Unable to connect to Shopify API. Please check your internet connection.",
            0,
            true,
          )
        }

        // Handle abort errors (timeout)
        if (error instanceof Error && error.name === "AbortError") {
          throw new ShopifyApiError("Request timeout: Shopify API took too long to respond.", 0, true)
        }

        throw new ShopifyApiError(
          `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
          0,
          false,
        )
      }

      // Check if error is retryable
      const isRetryable = error instanceof ShopifyApiError ? error.isRetryable : true

      if (!isRetryable) {
        throw error
      }

      // Wait before retrying
      console.log(`⏳ Waiting ${config.retryDelay}ms before retry...`)
      await new Promise((resolve) => setTimeout(resolve, config.retryDelay))

      // Exponential backoff
      config.retryDelay *= 2
    }
  }
}

export async function fetchShopifyOrders(shopDomain: string, accessToken: string, limit = 50): Promise<any[]> {
  if (!shopDomain || !accessToken) {
    throw new ShopifyApiError("Shop domain and access token are required")
  }

  // Clean up shop domain
  const cleanDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const url = `https://${cleanDomain}/admin/api/2023-10/orders.json?status=any&limit=${limit}`

  try {
    const data = await makeShopifyRequest(url, accessToken)
    return data.orders || []
  } catch (error) {
    console.error("❌ Failed to fetch Shopify orders:", error)
    throw error
  }
}

export async function testShopifyConnection(shopDomain: string, accessToken: string): Promise<boolean> {
  try {
    const cleanDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")
    const url = `https://${cleanDomain}/admin/api/2023-10/shop.json`

    await makeShopifyRequest(url, accessToken, { maxRetries: 1 })
    return true
  } catch (error) {
    console.error("❌ Shopify connection test failed:", error)
    return false
  }
}
