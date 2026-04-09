#!/usr/bin/env node

import { parseArgs } from 'util';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PubClient } from './clients/pubClient.js';
import { GitHubClient } from './clients/githubClient.js';
import {
  tools,
  handleSearchPackages,
  handleGetPackageInfo,
  handleGetPackageVersions,
  handleGetReadme,
  handleGetDependencies,
  handleGetPackageScore,
  handleGetChangelog,
  handleGetPackageMetrics,
  handleGetExample,
  handleSearchSimilarPackages,
} from './tools/index.js';
import pino from 'pino';
import express from 'express';
import cors from 'cors';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const VERSION = '0.2.3';

const client = new PubClient();
const githubClient = new GitHubClient();

function createServer(): Server {
  const server = new Server(
    {
      name: 'pub-mcp',
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'pub://popular-packages',
          name: 'popular_packages',
          description: 'List of popular Dart/Flutter packages from pub.dev',
          mimeType: 'application/json',
        },
        {
          uri: 'pub://package/{name}',
          name: 'package_docs',
          description: 'Get package documentation and metrics',
          mimeType: 'application/json',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      if (uri === 'pub://popular-packages') {
        const result = await client.searchPackages('', 20);
        return {
          contents: [
            {
              uri: 'pub://popular-packages',
              mimeType: 'application/json',
              text: JSON.stringify(result.packages),
            },
          ],
        };
      }

      if (uri.startsWith('pub://package/')) {
        const name = uri.replace('pub://package/', '');
        const [info, score, versions] = await Promise.all([
          client.getPackage(name),
          client.getPackageScore(name),
          client.getPackageVersions(name),
        ]);
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ info, score, versionCount: versions.versions.length }),
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: JSON.stringify({ error: message }),
          },
        ],
        isError: true,
      };
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.info({ tool: name, args }, 'Tool called');

    try {
      let result: unknown;

      switch (name) {
        case 'ping':
          return {
            content: [{ type: 'text', text: 'pong' }],
          };

        case 'health':
          return {
            content: [{ type: 'text', text: JSON.stringify({ status: 'ok', version: VERSION }) }],
          };

        case 'search_packages':
          result = await handleSearchPackages(client, args as { query: string; limit?: number });
          break;

        case 'get_package_info':
          result = await handleGetPackageInfo(client, args as { name: string });
          break;

        case 'get_package_versions':
          result = await handleGetPackageVersions(client, args as { name: string });
          break;

        case 'get_readme':
          result = await handleGetReadme(
            client,
            githubClient,
            args as { name: string; version?: string; format?: 'markdown' | 'text' | 'html' }
          );
          break;

        case 'get_dependencies':
          result = await handleGetDependencies(client, args as { name: string; version?: string });
          break;

        case 'get_package_score':
          result = await handleGetPackageScore(client, args as { name: string });
          break;

        case 'get_changelog':
          result = await handleGetChangelog(client, args as { name: string; version?: string });
          break;

        case 'get_package_metrics':
          result = await handleGetPackageMetrics(client, args as { name: string });
          break;

        case 'get_example':
          result = await handleGetExample(client, args as { name: string; version?: string });
          break;

        case 'search_similar_packages':
          result = await handleSearchSimilarPackages(
            client,
            args as { name?: string; tags?: string[]; limit?: number }
          );
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ tool: name, error: message }, 'Tool error');
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  });

  return server;
}

async function startStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('pub-mcp server running on stdio');
}

async function startHttp(port: number) {
  const app = express();
  app.use(express.json());

  const transports: Map<string, StreamableHTTPServerTransport> = new Map();

  app.use(
    cors({
      exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id', 'Mcp-Protocol-Version'],
      origin: '*',
    })
  );

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res, req.body);
    } else {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (sid: string) => {
          transports.set(sid, transport);
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
        }
      };
      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    }
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: VERSION });
  });

  app.get('/', (_req, res) => {
    res.json({
      name: 'pub-mcp',
      version: VERSION,
      description: 'MCP server for pub.dev',
      endpoints: {
        mcp: 'POST /mcp',
        health: 'GET /health',
      },
    });
  });

  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      logger.info(`pub-mcp HTTP server listening on port ${port}`);
      resolve();
    });
  });
}

async function runHealthCheck() {
  console.log('Checking pub.dev API...');
  try {
    await client.getPackage('http');
    console.log('✓ pub.dev API is reachable');
    console.log(JSON.stringify({ status: 'ok', version: VERSION }));
  } catch (error) {
    console.error('✗ pub.dev API is not reachable');
    console.error(error);
    process.exit(1);
  }
}

function showVersion() {
  console.log(`pub-mcp version ${VERSION}`);
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      health: { type: 'boolean' },
      http: { type: 'boolean', default: false },
      stdio: { type: 'boolean', default: false },
      port: { type: 'string', default: '3000' },
    },
    allowPositionals: true,
  });

  const subcommand = positionals[0]?.toLowerCase();
  const isMcpCommand = subcommand === 'mcp' || subcommand === 'server';

  if (values.help || (!isMcpCommand && positionals.length > 0)) {
    showHelp();
    return;
  }

  if (values.version) {
    showVersion();
    return;
  }

  if (values.health) {
    await runHealthCheck();
    return;
  }

  const useHttp = values.http || (!values.stdio && positionals.length === 0);
  const useStdio = values.stdio || (!values.http && positionals.length === 0);
  const port = parseInt(values.port as string, 10);

  if (useHttp && useStdio) {
    logger.info('Starting both stdio and HTTP servers');
    await Promise.all([startStdio(), startHttp(port)]);
  } else if (useHttp) {
    await startHttp(port);
  } else if (useStdio) {
    await startStdio();
  }
}

function showHelp() {
  console.log(`pub-mcp - MCP server for pub.dev

Usage:
  pub-mcp              Start MCP server with both transports
  pub-mcp --stdio      Start MCP server (stdio only)
  pub-mcp --http       Start MCP server (HTTP only)
  pub-mcp --http --port 8080  Start HTTP on port 8080
  pub-mcp --version    Show version
  pub-mcp --health     Check pub.dev API connectivity
  pub-mcp --help       Show this help

HTTP Endpoints:
  POST /mcp           MCP protocol endpoint
  GET  /health        Health check
  GET  /              Server info`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
