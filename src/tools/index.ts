import { z } from 'zod';
import type { PubClient } from '../clients/pubClient.js';
import type { GitHubClient } from '../clients/githubClient.js';
import { parseGitHubUrl } from '../clients/githubClient.js';

export const searchPackagesSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const getPackageInfoSchema = z.object({
  name: z.string().min(1),
});

export const getPackageVersionsSchema = z.object({
  name: z.string().min(1),
});

export const getReadmeSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  format: z.enum(['markdown', 'text', 'html']).default('markdown').optional(),
});

export const getDependenciesSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
});

export const getPackageScoreSchema = z.object({
  name: z.string().min(1),
});

export const getChangelogSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
});

export const getPackageMetricsSchema = z.object({
  name: z.string().min(1),
});

export const getExampleSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
});

export type SearchPackagesInput = {
  query: string;
  limit?: number;
  sdk?: string;
  platform?: string;
  topic?: string;
};
export type GetPackageInfoInput = { name: string };
export type GetPackageVersionsInput = { name: string };
export type GetReadmeInput = {
  name: string;
  version?: string;
  format?: 'markdown' | 'text' | 'html';
};
export type GetDependenciesInput = { name: string; version?: string };
export type GetPackageScoreInput = { name: string };
export type GetChangelogInput = { name: string; version?: string };
export type GetPackageMetricsInput = { name: string };
export type GetExampleInput = { name: string; version?: string };
export type SearchSimilarPackagesInput = { name?: string; tags?: string[]; limit?: number };

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const tools: ToolDefinition[] = [
  {
    name: 'search_packages',
    description: 'Search for packages on pub.dev by query with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        limit: { type: 'number', description: 'Maximum number of results (default 10)' },
        sdk: {
          type: 'string',
          description: 'Filter by SDK: dart, flutter',
          enum: ['dart', 'flutter'],
        },
        platform: {
          type: 'string',
          description: 'Filter by platform: android, ios, web, linux, macOS, windows',
          enum: ['android', 'ios', 'web', 'linux', 'macOS', 'windows'],
        },
        topic: {
          type: 'string',
          description: 'Filter by topic (e.g., http, firebase, state-management)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_package_info',
    description: 'Get detailed information about a specific package',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_package_versions',
    description: 'Get all available versions of a package',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_readme',
    description: 'Get the README content of a package',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
        version: { type: 'string', description: 'Specific version (optional, defaults to latest)' },
        format: {
          type: 'string',
          description: 'Output format: markdown, text, or html (default: markdown)',
          enum: ['markdown', 'text', 'html'],
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_dependencies',
    description: 'Get the dependencies of a package',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
        version: { type: 'string', description: 'Specific version (optional, defaults to latest)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_package_score',
    description: 'Get package score and metrics (pana points, likes, downloads, tags)',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_changelog',
    description: 'Get the changelog of a specific package version',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
        version: { type: 'string', description: 'Specific version (optional, defaults to latest)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_example',
    description: 'Get the example code of a package',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
        version: { type: 'string', description: 'Specific version (optional, defaults to latest)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_package_metrics',
    description: 'Get comprehensive metrics for a package (info + score + versions)',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'search_similar_packages',
    description: 'Find packages similar to a given package or by tags',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name to find similar packages for' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags to search for' },
        limit: { type: 'number', description: 'Maximum number of results (default 10)' },
      },
    },
  },
];

export async function handleSearchPackages(client: PubClient, input: SearchPackagesInput) {
  let searchQuery = input.query;

  if (input.sdk) {
    searchQuery += ` sdk:${input.sdk}`;
  }
  if (input.platform) {
    searchQuery += ` platform:${input.platform}`;
  }
  if (input.topic) {
    searchQuery += ` topic:${input.topic}`;
  }

  const result = await client.searchPackages(searchQuery, input.limit);

  return {
    packages: result.packages.map((p) => ({
      name: p.name,
      description: p.description,
      latestVersion: p.latestVersion,
    })),
    total: result.total,
    filters: {
      sdk: input.sdk,
      platform: input.platform,
      topic: input.topic,
    },
  };
}

export async function handleGetPackageInfo(client: PubClient, input: GetPackageInfoInput) {
  const pkg = await client.getPackage(input.name);
  return pkg;
}

export async function handleGetPackageVersions(client: PubClient, input: GetPackageVersionsInput) {
  const result = await client.getPackageVersions(input.name);
  return {
    versions: result.versions,
    firstPublished: result.firstPublished,
    lastUpdated: result.lastUpdated,
  };
}

export async function handleGetReadme(
  client: PubClient,
  githubClient: GitHubClient,
  input: GetReadmeInput
) {
  const readme = await client.getReadme(input.name, input.version);

  let finalReadme = readme;
  let source = 'pub.dev';

  if (!readme && input.name) {
    try {
      const pkg = await client.getPackage(input.name);
      if (pkg.repository) {
        const parsed = parseGitHubUrl(pkg.repository);
        if (parsed) {
          const githubReadme = await githubClient.getRepositoryReadme(
            parsed.owner,
            parsed.repo,
            parsed.path
          );
          if (githubReadme) {
            finalReadme = githubReadme;
            source = 'github';
          }
        }
      }
    } catch {
      // ignore errors and return no readme
    }
  }

  const content = finalReadme || 'No README available';

  if (input.format === 'text') {
    return {
      readme: content.replace(/[#*`_~\[\]]/g, '').trim(),
      source,
      format: 'text',
    };
  }

  return { readme: content, source, format: input.format || 'markdown' };
}

export async function handleGetDependencies(client: PubClient, input: GetDependenciesInput) {
  const result = await client.getDependencies(input.name, input.version);
  return {
    dependencies: result.dependencies,
    devDependencies: result.devDependencies,
  };
}

export async function handleGetPackageScore(client: PubClient, input: GetPackageScoreInput) {
  const score = await client.getPackageScore(input.name);
  return score;
}

export async function handleGetChangelog(client: PubClient, input: GetChangelogInput) {
  const changelog = await client.getChangelog(input.name, input.version);

  if (!changelog) {
    return {
      version: input.version || 'latest',
      content: 'No changelog available',
      published: '',
    };
  }

  return changelog;
}

export async function handleGetExample(client: PubClient, input: GetExampleInput) {
  const example = await client.getExample(input.name, input.version);

  if (!example || example === 'No example available') {
    return {
      hasExample: false,
      example: 'No example available',
      package: input.name,
      note: 'This package does not have an example configured on pub.dev',
    };
  }

  return {
    hasExample: true,
    example: example,
    package: input.name,
    format: 'dart',
  };
}

export async function handleGetPackageMetrics(client: PubClient, input: GetPackageMetricsInput) {
  const [info, score, versions] = await Promise.all([
    client.getPackage(input.name),
    client.getPackageScore(input.name),
    client.getPackageVersions(input.name),
  ]);

  return {
    info,
    score,
    versionCount: versions.versions.length,
    latestVersion: versions.versions[0]?.version,
  };
}

export async function handleSearchSimilarPackages(
  client: PubClient,
  input: SearchSimilarPackagesInput
) {
  let searchQuery = '';

  if (input.name) {
    const score = await client.getPackageScore(input.name);
    const tags = score.tags?.slice(0, 5) || [];
    searchQuery = tags.join(' ');
  } else if (input.tags) {
    searchQuery = input.tags.join(' ');
  } else {
    return { packages: [], total: 0, message: 'Provide either name or tags' };
  }

  const result = await client.searchPackages(searchQuery, input.limit || 10);

  const filteredPackages = input.name
    ? result.packages.filter((p) => p.name !== input.name)
    : result.packages;

  return {
    packages: filteredPackages.map((p) => ({
      name: p.name,
      description: p.description,
      latestVersion: p.latestVersion,
    })),
    total: filteredPackages.length,
    searchTags: input.tags || [],
  };
}
