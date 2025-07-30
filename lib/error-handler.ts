// Production error handling and logging
export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export function handleError(error: unknown): { message: string; statusCode: number } {
  console.error("Application Error:", error)

  if (error instanceof AppError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
    }
  }

  if (error instanceof Error) {
    // Log the full error in development, sanitize in production
    if (process.env.NODE_ENV === "development") {
      return {
        message: error.message,
        statusCode: 500,
      }
    }
  }

  // Generic error for production
  return {
    message: "An unexpected error occurred",
    statusCode: 500,
  }
}

export function logError(error: unknown, context?: Record<string, any>) {
  const timestamp = new Date().toISOString()
  const errorInfo = {
    timestamp,
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
    context,
    environment: process.env.NODE_ENV,
    url: process.env.VERCEL_URL || "localhost",
  }

  console.error("Error Log:", JSON.stringify(errorInfo, null, 2))

  // In production, you might want to send this to an external service
  // like Sentry, LogRocket, or your own logging service
}
