import type {
  PackageInfo,
  PackageVersion,
  SearchResult,
  PackageScore,
  PackageChangelog,
} from '../types/index.js';
import { getPackageCache, getSearchCache } from '../cache/cache.js';

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_RETRIES = 3;

export interface PubClientOptions {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

export class PubClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'PubClientError';
  }
}

export class PubClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;

  constructor(options: PubClientOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.PUB_DEV_API_URL || 'https://pub.dev/api';
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.retries = options.retries || DEFAULT_RETRIES;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, options);

        if (!response.ok) {
          const isRetryable =
            response.status === 429 || (response.status >= 500 && response.status < 600);
          if (isRetryable && attempt < this.retries - 1) {
            await this.delay(Math.pow(2, attempt) * 1000);
            continue;
          }

          throw new PubClientError(
            `HTTP error: ${response.status} ${response.statusText}`,
            response.status,
            isRetryable
          );
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.retries - 1 && lastError.name === 'AbortError') {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new PubClientError('Failed to fetch after retries');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async searchPackages(query: string, limit: number = 10): Promise<SearchResult> {
    const cacheKey = `search:${query}:${limit}`;
    const cached = getSearchCache().get(cacheKey);
    if (cached) {
      return cached as SearchResult;
    }

    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const response = await this.fetchWithRetry(url);

    const data = (await response.json()) as {
      packages?: { package: string; version: string; description?: string }[];
      totalCount?: number;
    };

    const packages = (data.packages || []).map((p) => ({
      name: p.package,
      description: p.description || '',
      latestVersion: p.version,
    }));

    const result = {
      packages,
      total: data.totalCount || packages.length,
    };

    getSearchCache().set(cacheKey, result);
    return result;
  }

  async getPackage(name: string): Promise<PackageInfo> {
    const cacheKey = `package:${name}`;
    const cached = getPackageCache().get(cacheKey);
    if (cached) {
      return cached as PackageInfo;
    }

    const url = `${this.baseUrl}/packages/${name}`;
    const response = await this.fetchWithRetry(url);

    if (response.status === 404) {
      throw new PubClientError(`Package not found: ${name}`, 404, false);
    }

    const data = (await response.json()) as {
      name: string;
      latest: {
        version: string;
        published: string;
        description?: string;
        pubspec?: Record<string, unknown>;
      };
      publisher?: { publisherName?: string };
      urls?: { homepage?: string; repository?: string; issues?: string };
    };

    const result: PackageInfo = {
      name: data.name,
      description: data.latest.description || '',
      latestVersion: data.latest.version,
      published: data.latest.published,
      updated: data.latest.published,
      publisher: data.publisher?.publisherName,
      homepage: data.urls?.homepage || (data.latest.pubspec?.homepage as string),
      repository: data.urls?.repository || (data.latest.pubspec?.repository as string),
      issues: data.urls?.issues,
      pubspec: data.latest.pubspec,
    };

    getPackageCache().set(cacheKey, result);
    return result;
  }

  async getPackageVersions(
    name: string
  ): Promise<{ versions: PackageVersion[]; firstPublished?: string; lastUpdated?: string }> {
    const cacheKey = `versions:${name}`;
    const cached = getPackageCache().get(cacheKey);
    if (cached) {
      return cached as {
        versions: PackageVersion[];
        firstPublished?: string;
        lastUpdated?: string;
      };
    }

    const url = `${this.baseUrl}/packages/${name}`;
    const response = await this.fetchWithRetry(url);

    if (response.status === 404) {
      throw new PubClientError(`Package not found: ${name}`, 404, false);
    }

    const data = (await response.json()) as {
      versions: { version: string; published: string }[];
    };

    const versions = data.versions.map((v) => ({
      version: v.version,
      published: v.published,
    }));

    const sortedByDate = [...versions].sort(
      (a, b) => new Date(a.published).getTime() - new Date(b.published).getTime()
    );

    const result = {
      versions,
      firstPublished: sortedByDate[0]?.published,
      lastUpdated: sortedByDate[sortedByDate.length - 1]?.published,
    };

    getPackageCache().set(cacheKey, result);
    return result;
  }

  async getReadme(name: string, version?: string): Promise<string> {
    const cacheKey = `readme:${name}:${version || 'latest'}`;
    const cached = getPackageCache().get(cacheKey);
    if (cached) {
      return cached as string;
    }

    const versionPart = version ? `/${version}` : '';
    const url = `${this.baseUrl}/packages/${name}${versionPart}/readme`;

    try {
      const response = await this.fetchWithRetry(url);

      if (response.status === 404) {
        return '';
      }

      const content = await response.text();

      if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
        return '';
      }

      if (content.length < 10) {
        return '';
      }

      getPackageCache().set(cacheKey, content);
      return content;
    } catch (error) {
      if (error instanceof PubClientError && error.statusCode === 404) {
        return '';
      }
      throw error;
    }
  }

  async getDependencies(
    name: string,
    version?: string
  ): Promise<{ dependencies: Record<string, string>; devDependencies: Record<string, string> }> {
    const cacheKey = `deps:${name}:${version || 'latest'}`;
    const cached = getPackageCache().get(cacheKey);
    if (cached) {
      return cached as {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      };
    }

    const versionPart = version ? `/${version}` : '';
    const url = `${this.baseUrl}/packages/${name}${versionPart}`;
    const response = await this.fetchWithRetry(url);

    if (response.status === 404) {
      throw new PubClientError(`Package not found: ${name}`, 404, false);
    }

    const data = (await response.json()) as {
      latest?: {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
    };

    const result = {
      dependencies: data.latest?.dependencies || {},
      devDependencies: data.latest?.devDependencies || {},
    };

    getPackageCache().set(cacheKey, result);
    return result;
  }

  async getPackageScore(name: string): Promise<PackageScore> {
    const cacheKey = `score:${name}`;
    const cached = getPackageCache().get(cacheKey);
    if (cached) {
      return cached as PackageScore;
    }

    const url = `${this.baseUrl}/packages/${name}/score`;
    const response = await this.fetchWithRetry(url);

    if (response.status === 404) {
      throw new PubClientError(`Package not found: ${name}`, 404, false);
    }

    const data = (await response.json()) as {
      grantedPoints?: number;
      maxPoints?: number;
      likeCount?: number;
      downloadCount30Days?: number;
      tags?: string[];
    };

    const tags = data.tags ?? [];
    const platforms = tags
      .filter((t) => t.startsWith('platform:'))
      .map((t) => t.replace('platform:', ''));
    const sdk = tags.find((t) => t.startsWith('sdk:'))?.replace('sdk:', '');

    const result: PackageScore = {
      grantedPoints: data.grantedPoints ?? 0,
      maxPoints: data.maxPoints ?? 0,
      likeCount: data.likeCount ?? 0,
      downloadCount30Days: data.downloadCount30Days ?? 0,
      tags,
      platforms: platforms.length > 0 ? platforms : undefined,
      sdk: sdk,
      isFlutterFavorite: tags.includes('is:flutter-favorite'),
      isNullSafe: tags.includes('is:null-safe'),
      isDart3Compatible: tags.includes('is:dart3-compatible'),
    };

    getPackageCache().set(cacheKey, result);
    return result;
  }

  async getChangelog(name: string, version?: string): Promise<PackageChangelog | null> {
    const cacheKey = `changelog:${name}:${version || 'latest'}`;
    const cached = getPackageCache().get(cacheKey);
    if (cached) {
      return cached as PackageChangelog;
    }

    const versionPart = version ? `/${version}` : '';
    const url = `${this.baseUrl}/packages/${name}${versionPart}/changelog`;

    try {
      const response = await this.fetchWithRetry(url);

      if (response.status === 404) {
        return null;
      }

      const data = (await response.json()) as {
        version: string;
        published: string;
        content?: string;
      };

      const result: PackageChangelog = {
        version: data.version,
        published: data.published,
        content: data.content || '',
      };

      getPackageCache().set(cacheKey, result);
      return result;
    } catch (error) {
      if (error instanceof PubClientError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getExample(name: string, version?: string): Promise<string> {
    const cacheKey = `example:${name}:${version || 'latest'}`;
    const cached = getPackageCache().get(cacheKey);
    if (cached) {
      return cached as string;
    }

    try {
      const versionPart = version ? `/${version}` : '';
      const webUrl = `https://pub.dev/packages/${name}/example`;

      const webResponse = await fetch(webUrl);
      if (webResponse.ok) {
        const webHtml = await webResponse.text();

        const preMatch = webHtml.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/);
        if (preMatch && preMatch[1]) {
          const exampleCode = preMatch[1]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#47;/g, '/')
            .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
            .trim();

          if (exampleCode.length > 10) {
            getPackageCache().set(cacheKey, exampleCode);
            return exampleCode;
          }
        }
      }

      const apiUrl = `${this.baseUrl}/packages/${name}${versionPart}/example`;
      const apiResponse = await this.fetchWithRetry(apiUrl);

      if (apiResponse.status === 404) {
        return '';
      }

      const apiHtml = await apiResponse.text();

      if (apiHtml.includes('<!DOCTYPE html>') || apiHtml.includes('<html')) {
        const preMatch = apiHtml.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/);
        if (preMatch && preMatch[1]) {
          const exampleCode = preMatch[1]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#47;/g, '/')
            .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
            .trim();

          if (exampleCode.length > 10) {
            getPackageCache().set(cacheKey, exampleCode);
            return exampleCode;
          }
        }
      } else if (apiHtml.length > 10) {
        const exampleCode = apiHtml
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#47;/g, '/')
          .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
          .trim();

        if (exampleCode.length > 10) {
          getPackageCache().set(cacheKey, exampleCode);
          return exampleCode;
        }
      }

      return '';
    } catch (error) {
      if (error instanceof PubClientError && error.statusCode === 404) {
        return '';
      }
      throw error;
    }
  }
}
