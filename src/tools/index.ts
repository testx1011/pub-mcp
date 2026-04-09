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

export type SearchPackagesInput = { query: string; limit?: number };
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
    description: 'Search for packages on pub.dev by query',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        limit: { type: 'number', description: 'Maximum number of results (default 10)' },
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
];

export async function handleSearchPackages(client: PubClient, input: SearchPackagesInput) {
  const result = await client.searchPackages(input.query, input.limit);
  return {
    packages: result.packages.map((p) => ({
      name: p.name,
      description: p.description,
      latestVersion: p.latestVersion,
    })),
    total: result.total,
  };
}

export async function handleGetPackageInfo(client: PubClient, input: GetPackageInfoInput) {
  const pkg = await client.getPackage(input.name);
  return pkg;
}

export async function handleGetPackageVersions(client: PubClient, input: GetPackageVersionsInput) {
  const versions = await client.getPackageVersions(input.name);
  return { versions };
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
  const dependencies = await client.getDependencies(input.name, input.version);
  return { dependencies };
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

export async function handleGetPackageMetrics(client: PubClient, input: GetPackageMetricsInput) {
  const [info, score, versions] = await Promise.all([
    client.getPackage(input.name),
    client.getPackageScore(input.name),
    client.getPackageVersions(input.name),
  ]);

  return {
    info,
    score,
    versionCount: versions.length,
    latestVersion: versions[0]?.version,
  };
}
