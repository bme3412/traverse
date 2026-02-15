/**
 * Simple in-memory rate limiter for API routes
 * Limits requests per IP address to prevent abuse
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Store rate limit data in memory (will reset on server restart)
const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number;
  /**
   * Time window in milliseconds
   */
  windowMs: number;
}

export interface RateLimitResult {
  /**
   * Whether the request should be allowed
   */
  allowed: boolean;
  /**
   * Number of requests remaining in the current window
   */
  remaining: number;
  /**
   * Time in seconds until the rate limit resets
   */
  resetIn: number;
}

/**
 * Get client identifier from request
 * Uses X-Forwarded-For header in production, fallbacks to connection IP
 */
function getClientIdentifier(request: Request): string {
  // Try to get real IP from Vercel headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a constant for local development
  return 'unknown-client';
}

/**
 * Check if a request should be rate limited
 * Returns result with allowed status and metadata
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig
): RateLimitResult {
  const clientId = getClientIdentifier(request);
  const now = Date.now();
  const key = `${clientId}`;

  let entry = rateLimitMap.get(key);

  // Create new entry if it doesn't exist or has expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
    rateLimitMap.set(key, entry);
  }

  // Increment request count
  entry.count++;

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const resetIn = Math.ceil((entry.resetAt - now) / 1000);
  const allowed = entry.count <= config.maxRequests;

  return {
    allowed,
    remaining,
    resetIn,
  };
}

/**
 * Create a rate limit response with appropriate headers
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${result.resetIn} seconds.`,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': result.resetIn.toString(),
        'X-RateLimit-Limit': '0',
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetIn.toString(),
      },
    }
  );
}

/**
 * Middleware helper to apply rate limiting to an API route
 *
 * @example
 * ```ts
 * export async function POST(request: Request) {
 *   const rateLimit = checkRateLimit(request, { maxRequests: 10, windowMs: 60000 });
 *   if (!rateLimit.allowed) {
 *     return createRateLimitResponse(rateLimit);
 *   }
 *   // ... handle request
 * }
 * ```
 */
export function withRateLimit(
  handler: (request: Request) => Promise<Response>,
  config: RateLimitConfig
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const rateLimit = checkRateLimit(request, config);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }
    return handler(request);
  };
}

/**
 * Preset rate limit configurations
 */
export const RATE_LIMIT_PRESETS = {
  /**
   * Strict limits for expensive operations (10 requests per minute)
   */
  STRICT: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
  /**
   * Standard limits for normal API endpoints (30 requests per minute)
   */
  STANDARD: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  },
  /**
   * Relaxed limits for lightweight operations (100 requests per minute)
   */
  RELAXED: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },
} as const;
