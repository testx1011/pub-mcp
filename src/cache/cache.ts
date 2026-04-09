export interface CacheOptions {
  ttl: number;
  maxItems: number;
}

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private ttl: number;
  private maxItems: number;

  constructor(options: CacheOptions) {
    this.cache = new Map();
    this.ttl = options.ttl * 1000;
    this.maxItems = options.maxItems;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    if (this.cache.size >= this.maxItems) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    const expiryTime = ttl ? Date.now() + ttl * 1000 : Date.now() + this.ttl;
    this.cache.set(key, { value, expiry: expiryTime });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  stats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0,
      misses: 0,
    };
  }
}

export function createCache<T>(options: CacheOptions): LRUCache<T> {
  return new LRUCache<T>(options);
}

const defaultCacheOptions: CacheOptions = {
  ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
  maxItems: parseInt(process.env.CACHE_MAX_ITEMS || '500', 10),
};

let packageCache: LRUCache<unknown> | null = null;
let searchCache: LRUCache<unknown> | null = null;

export function getPackageCache(): LRUCache<unknown> {
  if (!packageCache) {
    packageCache = new LRUCache(defaultCacheOptions);
  }
  return packageCache;
}

export function getSearchCache(): LRUCache<unknown> {
  if (!searchCache) {
    searchCache = new LRUCache({ ...defaultCacheOptions, ttl: 600 });
  }
  return searchCache;
}

export function clearAllCaches(): void {
  packageCache?.clear();
  searchCache?.clear();
}