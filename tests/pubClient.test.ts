import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PubClient, PubClientError } from '../src/clients/pubClient.js';

describe('PubClient', () => {
  let client: PubClient;

  beforeEach(() => {
    client = new PubClient({ timeout: 5000, retries: 2 });
  });

  describe('searchPackages', () => {
    it('should fetch package search results', async () => {
      const mockResponse = {
        packages: [
          { package: 'http', version: '1.0.0', description: 'HTTP client' },
          { package: 'http_parser', version: '2.0.0', description: 'HTTP parser' },
        ],
        totalCount: 2,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.searchPackages('http');

      expect(result.packages).toHaveLength(2);
      expect(result.packages[0].name).toBe('http');
      expect(result.packages[0].latestVersion).toBe('1.0.0');
    });

    it('should handle 404 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(client.searchPackages('nonexistent')).rejects.toThrow(PubClientError);
    });
  });

  describe('getPackage', () => {
    it('should fetch package info', async () => {
      const mockResponse = {
        name: 'http',
        latest: {
          version: '1.0.0',
          published: '2024-01-01T00:00:00Z',
          description: 'A composable API for HTTP requests',
        },
        publisher: { publisherName: 'dart-lang' },
        urls: {
          homepage: 'https://pub.dev',
          repository: 'https://github.com/dart-lang/http',
          issues: 'https://github.com/dart-lang/http/issues',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getPackage('http');

      expect(result.name).toBe('http');
      expect(result.latestVersion).toBe('1.0.0');
      expect(result.publisher).toBe('dart-lang');
    });

    it('should throw on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(client.getPackage('nonexistent')).rejects.toThrow(PubClientError);
    });
  });

  describe('getPackageVersions', () => {
    it('should fetch package versions', async () => {
      const mockResponse = {
        versions: [
          { version: '1.0.0', published: '2024-01-01T00:00:00Z' },
          { version: '0.9.0', published: '2023-12-01T00:00:00Z' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getPackageVersions('http');

      expect(result).toHaveLength(2);
      expect(result[0].version).toBe('1.0.0');
    });
  });

  describe('getReadme', () => {
    it('should fetch readme content', async () => {
      const readmeContent = '# HTTP Package\n\nThis is the readme.';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => readmeContent,
      });

      const result = await client.getReadme('http');

      expect(result).toBe(readmeContent);
    });

    it('should return empty string on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await client.getReadme('nonexistent');

      expect(result).toBe('');
    });
  });

  describe('getDependencies', () => {
    it('should fetch package dependencies', async () => {
      const mockResponse = {
        latest: {
          dependencies: {
            'meta': '^1.9.0',
            'async': '^2.11.0',
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getDependencies('http');

      expect(result['meta']).toBe('^1.9.0');
      expect(result['async']).toBe('^2.11.0');
    });
  });

  describe('retry logic', () => {
    it('should fail after max retries on 500 errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.searchPackages('test')).rejects.toThrow();
    });

    it('should handle 404 as non-retryable', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(client.searchPackages('test')).rejects.toThrow(PubClientError);
    });
  });
});