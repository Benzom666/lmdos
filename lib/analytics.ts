// Production analytics and monitoring
export interface AnalyticsEvent {
  event: string
  properties?: Record<string, any>
  userId?: string
  timestamp?: string
}

export class Analytics {
  private static instance: Analytics
  private enabled: boolean

  private constructor() {
    this.enabled = process.env.NODE_ENV === "production"
  }

  public static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics()
    }
    return Analytics.instance
  }

  public track(event: string, properties?: Record<string, any>, userId?: string) {
    if (!this.enabled) return

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      userId,
      timestamp: new Date().toISOString(),
    }

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.log("Analytics Event:", analyticsEvent)
      return
    }

    // In production, send to your analytics service
    this.sendToAnalyticsService(analyticsEvent)
  }

  private async sendToAnalyticsService(event: AnalyticsEvent) {
    try {
      // Replace with your analytics service endpoint
      // Examples: Google Analytics, Mixpanel, Amplitude, etc.
      console.log("Would send to analytics service:", event)

      // Example implementation:
      // await fetch('/api/analytics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event),
      // })
    } catch (error) {
      console.error("Failed to send analytics event:", error)
    }
  }

  // Common tracking methods
  public trackPageView(page: string, userId?: string) {
    this.track("page_view", { page }, userId)
  }

  public trackUserAction(action: string, properties?: Record<string, any>, userId?: string) {
    this.track("user_action", { action, ...properties }, userId)
  }

  public trackError(error: Error, context?: Record<string, any>) {
    this.track("error", {
      error_name: error.name,
      error_message: error.message,
      ...context,
    })
  }

  public trackPerformance(metric: string, value: number, unit = "ms") {
    this.track("performance", { metric, value, unit })
  }
}

export const analytics = Analytics.getInstance()
