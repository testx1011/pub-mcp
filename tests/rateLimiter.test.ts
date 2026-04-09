import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimiter, withRetry, withRateLimit } from '../src/utils/rateLimiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(2);
  });

  it('should limit concurrency', async () => {
    let active = 0;
    let maxActive = 0;
    const tasks: Promise<void>[] = [];

    for (let i = 0; i < 4; i++) {
      tasks.push(
        limiter.run(async () => {
          active++;
          maxActive = Math.max(maxActive, active);
          await new Promise((r) => setTimeout(r, 50));
          active--;
        })
      );
    }

    await Promise.all(tasks);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('should allow sequential execution', async () => {
    const results: number[] = [];
    
    await limiter.run(async () => {
      results.push(1);
      await new Promise((r) => setTimeout(r, 10));
      results.push(2);
    });

    expect(results).toEqual([1, 2]);
  });
});

describe('withRetry', () => {
  it('should throw after max attempts on non-retryable errors', async () => {
    await expect(
      withRetry(async () => {
        throw new Error('Always fails');
      }, { attempts: 2 })
    ).rejects.toThrow('Always fails');
  });

  it('should throw after max attempts on retryable errors', async () => {
    const error = new Error('Connection reset');
    (error as { statusCode?: number }).statusCode = 429;

    await expect(
      withRetry(async () => {
        throw error;
      }, { attempts: 2, backoff: 10 })
    ).rejects.toThrow();
  });
});

describe('withRateLimit', () => {
  it('should execute function with rate limiting', async () => {
    const result = await withRateLimit(async () => 'done');
    expect(result).toBe('done');
  });
});