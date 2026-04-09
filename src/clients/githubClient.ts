export interface GitHubClientOptions {
  baseUrl?: string;
  token?: string;
  timeout?: number;
}

export class GitHubClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'GitHubClientError';
  }
}

export class GitHubClient {
  private baseUrl: string;
  private token?: string;
  private timeout: number;

  constructor(options: GitHubClientOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.GITHUB_API_URL || 'https://api.github.com';
    this.token = options.token || process.env.GITHUB_TOKEN;
    this.timeout = options.timeout || 10000;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getRepositoryReadme(owner: string, repo: string, path?: string): Promise<string> {
    const readmePath = path ? `${path}/README.md` : 'README.md';
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${readmePath}`;
    const response = await this.fetchWithTimeout(url);

    if (response.status === 404) {
      if (path) {
        return this.getRepositoryReadme(owner, repo);
      }
      return '';
    }

    if (!response.ok) {
      throw new GitHubClientError(
        `Failed to fetch README: ${response.statusText}`,
        response.status
      );
    }

    const data = (await response.json()) as { content?: string };

    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return '';
  }

  async getChangelog(owner: string, repo: string): Promise<string> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/CHANGELOG.md`;
    const response = await this.fetchWithTimeout(url);

    if (response.status === 404) {
      const altUrls = ['CHANGELOG.md', 'changelog.md', 'HISTORY.md', 'history.md'];
      for (const altUrl of altUrls) {
        const altResponse = await this.fetchWithTimeout(
          `${this.baseUrl}/repos/${owner}/${repo}/contents/${altUrl}`
        );
        if (altResponse.ok) {
          const data = (await altResponse.json()) as { content?: string };
          if (data.content) {
            return Buffer.from(data.content, 'base64').toString('utf-8');
          }
        }
      }
      return '';
    }

    if (!response.ok) {
      throw new GitHubClientError(
        `Failed to fetch changelog: ${response.statusText}`,
        response.status
      );
    }

    const data = (await response.json()) as { content?: string };
    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return '';
  }

  async getLatestRelease(
    owner: string,
    repo: string
  ): Promise<{ tag: string; body: string } | null> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/releases/latest`;
    const response = await this.fetchWithTimeout(url);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new GitHubClientError(
        `Failed to fetch release: ${response.statusText}`,
        response.status
      );
    }

    const data = (await response.json()) as { tag_name?: string; body?: string };
    return {
      tag: data.tag_name || '',
      body: data.body || '',
    };
  }

  async getRepositoryInfo(
    owner: string,
    repo: string
  ): Promise<{
    description: string;
    stars: number;
    forks: number;
    url: string;
  } | null> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}`;
    const response = await this.fetchWithTimeout(url);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new GitHubClientError(
        `Failed to fetch repo info: ${response.statusText}`,
        response.status
      );
    }

    const data = (await response.json()) as {
      description?: string;
      stargazers_count?: number;
      forks_count?: number;
      html_url?: string;
    };

    return {
      description: data.description || '',
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      url: data.html_url || '',
    };
  }
}

export function parseGitHubUrl(url: string): { owner: string; repo: string; path?: string } | null {
  if (!url || !url.includes('github.com')) {
    return null;
  }

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    if (pathParts.length < 2) {
      return null;
    }

    const owner = pathParts[0];
    const repo = pathParts[1].replace(/\.git$/, '');

    let path: string | undefined;
    if (pathParts.length > 2) {
      const treeIndex = pathParts.indexOf('tree');
      if (treeIndex !== -1 && treeIndex + 2 < pathParts.length) {
        path = pathParts.slice(treeIndex + 2).join('/');
      }
    }

    return { owner, repo, path: path || undefined };
  } catch {
    return null;
  }
}
