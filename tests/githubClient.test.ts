import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubClient, parseGitHubUrl, GitHubClientError } from '../src/clients/githubClient.js';

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    client = new GitHubClient({ timeout: 5000 });
    vi.clearAllMocks();
  });

  describe('getRepositoryReadme', () => {
    it('should fetch repository readme', async () => {
      const mockReadme = { content: Buffer.from('# Test README').toString('base64') };
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockReadme,
      });

      const result = await client.getRepositoryReadme('owner', 'repo');
      expect(result).toContain('Test README');
    });

    it('should return empty string on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await client.getRepositoryReadme('owner', 'repo');
      expect(result).toBe('');
    });
  });

  describe('getChangelog', () => {
    it('should fetch CHANGELOG.md', async () => {
      const mockContent = { content: Buffer.from('# Changelog').toString('base64') };
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockContent,
      });

      const result = await client.getChangelog('owner', 'repo');
      expect(result).toContain('Changelog');
    });

    it('should try alternative filenames on 404', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ content: Buffer.from('History').toString('base64') }) });

      const result = await client.getChangelog('owner', 'repo');
      expect(result).toContain('History');
    });
  });

  describe('getLatestRelease', () => {
    it('should fetch latest release info', async () => {
      const mockRelease = { tag_name: 'v1.0.0', body: 'Release notes' };
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      });

      const result = await client.getLatestRelease('owner', 'repo');
      expect(result?.tag).toBe('v1.0.0');
      expect(result?.body).toBe('Release notes');
    });

    it('should return null on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await client.getLatestRelease('owner', 'repo');
      expect(result).toBeNull();
    });
  });

  describe('getRepositoryInfo', () => {
    it('should fetch repository info', async () => {
      const mockInfo = {
        description: 'A test repo',
        stargazers_count: 100,
        forks_count: 20,
        html_url: 'https://github.com/owner/repo',
      };
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockInfo,
      });

      const result = await client.getRepositoryInfo('owner', 'repo');
      expect(result?.description).toBe('A test repo');
      expect(result?.stars).toBe(100);
    });

    it('should return null on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await client.getRepositoryInfo('owner', 'repo');
      expect(result).toBeNull();
    });
  });
});

describe('parseGitHubUrl', () => {
  it('should parse GitHub URLs', () => {
    expect(parseGitHubUrl('https://github.com/owner/repo')).toEqual({ owner: 'owner', repo: 'repo' });
    expect(parseGitHubUrl('https://github.com/owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' });
    expect(parseGitHubUrl('github.com/owner/repo')).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('should return null for invalid URLs', () => {
    expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull();
    expect(parseGitHubUrl('not-a-url')).toBeNull();
  });
});