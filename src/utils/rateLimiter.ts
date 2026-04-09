import pLimit from 'p-limit';

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5', 10);
const RETRY_ATTEMPTS = parseInt(process.env.RETRY_ATTEMPTS || '3', 10);

export class RateLimiter {
  private limit: ReturnType<typeof pLimit>;
  
  constructor(concurrency: number = MAX_CONCURRENT) {
    this.limit = pLimit(concurrency);
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    return this.limit(fn);
  }

  setConcurrency(concurrency: number): void {
    this.limit = pLimit(concurrency);
  }
}

export const rateLimiter = new RateLimiter();

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; backoff?: number } = {}
): Promise<T> {
  const attempts = options.attempts || RETRY_ATTEMPTS;
  const backoff = options.backoff || 1000;

  let lastError: Error | null = null;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const isRetryable = error instanceof Error && 
        ('statusCode' in error 
          ? (error as { statusCode?: number }).statusCode === 429 
          : error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT'));

      if (!isRetryable || i === attempts - 1) {
        throw lastError;
      }

      await new Promise((resolve) => setTimeout(resolve, backoff * Math.pow(2, i)));
    }
  }

  throw lastError;
}

export async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  return rateLimiter.run(fn);
}