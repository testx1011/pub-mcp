# pub-mcp 📦✨

[![npm version](https://img.shields.io/npm/v/pub-mcp)](https://www.npmjs.com/package/pub-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/pub-mcp)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org)

> MCP (Model Context Protocol) server for pub.dev - Open Source. Enables LLMs and AI assistants to access Dart/Flutter package information from pub.dev.

---

## ⚡ Quick Start

### Option 1: Install Globally

```bash
npm install -g pub-mcp
pub-mcp
```

### Option 2: Use npx (Recommended)

No installation required! Use directly in your MCP config:

```json
{
  "mcpServers": {
    "pub-mcp": {
      "command": "npx",
      "args": ["-y", "pub-mcp"]
    }
  }
}
```

### Option 3: Local Installation

```bash
npm install pub-mcp
npx pub-mcp
```

That's it! Your MCP server is running on port 3000 (HTTP) and listening on stdio.

---

## 🎯 Features

| Feature                   | Description                                     |
| ------------------------- | ----------------------------------------------- |
| 🔍 **Package Search**     | Search packages on pub.dev by query             |
| 📦 **Package Info**       | Get metadata, versions, publisher info          |
| ⭐ **Package Score**      | Pana points, likes, downloads, tags             |
| 📝 **Changelog**          | Package changelog for any version               |
| 📊 **Metrics**            | Comprehensive metrics (info + score + versions) |
| 📖 **README**             | Package README with GitHub fallback             |
| 🔗 **Dependencies**       | Package dependency tree                         |
| 🌐 **MCP Resources**      | Access packages as resources                    |
| 🚇 **Dual Transport**     | Stdio and Streamable HTTP                       |
| 💾 **LRU Caching**        | Built-in caching for performance                |
| ⚡ **Rate Limiting**      | Retry with exponential backoff                  |
| 📝 **Structured Logging** | Pino logger integration                         |

---

## 🚀 Usage

### Starting the Server

```bash
# Both transports (default - stdio + HTTP on port 3000)
pub-mcp

# Stdio only (for Claude Desktop, etc.)
pub-mcp --stdio

# HTTP only
pub-mcp --http

# HTTP on custom port
pub-mcp --http --port 8080

# Check version
pub-mcp --version

# Check API health
pub-mcp --health
```

### Connecting AI Clients

#### Claude Desktop / VS Code / Cursor

Add to your MCP settings file:

- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **VS Code**: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/Model Context Protocol/mcp_settings.json`
- **Cursor**: `[project root]/.cursor/mcp.json`

**Option 1: npx (Recommended - no installation needed)**

```json
{
  "mcpServers": {
    "pub-mcp": {
      "command": "npx",
      "args": ["-y", "pub-mcp"]
    }
  }
}
```

**Option 2: Global installation**

```json
{
  "mcpServers": {
    "pub-mcp": {
      "command": "pub-mcp",
      "args": ["--stdio"]
    }
  }
}
```

**Option 3: Local installation**

```json
{
  "mcpServers": {
    "pub-mcp": {
      "command": "node",
      "args": ["./node_modules/pub-mcp/dist/cli.js", "--stdio"]
    }
  }
}
```

#### Other MCP Clients

```bash
# Start HTTP server
pub-mcp --http

# Connect to http://localhost:3000/mcp
```

---

## 🔧 Configuration

Environment variables (optional, can be set in `.env`):

| Variable                  | Default                  | Description                         |
| ------------------------- | ------------------------ | ----------------------------------- |
| `PORT`                    | `3000`                   | HTTP server port                    |
| `CACHE_TTL`               | `3600`                   | Cache TTL in seconds                |
| `CACHE_MAX_ITEMS`         | `500`                    | Maximum cache items                 |
| `MAX_CONCURRENT_REQUESTS` | `5`                      | Concurrent request limit            |
| `RETRY_ATTEMPTS`          | `3`                      | Retry attempts                      |
| `PUB_DEV_API_URL`         | `https://pub.dev/api`    | pub.dev API URL                     |
| `GITHUB_API_URL`          | `https://api.github.com` | GitHub API URL                      |
| `GITHUB_TOKEN`            | -                        | GitHub token for higher rate limits |
| `LOG_LEVEL`               | `info`                   | Logging level                       |

---

## 🛠️ MCP Tools

| Tool                   | Description                   | Parameters                    |
| ---------------------- | ----------------------------- | ----------------------------- |
| `search_packages`      | 🔍 Search packages on pub.dev | `query`, `limit?`             |
| `get_package_info`     | 📦 Get package details        | `name`                        |
| `get_package_versions` | 📋 Get all package versions   | `name`                        |
| `get_readme`           | 📖 Get package README         | `name`, `version?`, `format?` |
| `get_dependencies`     | 🔗 Get package dependencies   | `name`, `version?`            |
| `get_package_score`    | ⭐ Get score & metrics        | `name`                        |
| `get_changelog`        | 📝 Get package changelog      | `name`, `version?`            |
| `get_package_metrics`  | 📊 Get comprehensive metrics  | `name`                        |

### 📖 Get Readme Format

The `get_readme` tool supports a `format` parameter:

```json
{
  "name": "get_readme",
  "arguments": {
    "name": "http",
    "format": "markdown" // "markdown" | "text" | "html"
  }
}
```

---

## 📚 MCP Resources

| URI                      | Description                              |
| ------------------------ | ---------------------------------------- |
| `pub://popular-packages` | 📦 List of popular Dart/Flutter packages |
| `pub://package/{name}`   | 📋 Package documentation and metrics     |

---

## 💡 Examples

### 🔍 Search Packages

```json
{
  "name": "search_packages",
  "arguments": {
    "query": "http client",
    "limit": 5
  }
}
```

**Response:**

```json
{
  "packages": [
    {
      "name": "http",
      "description": "A composable, Future-based library for making HTTP requests.",
      "latestVersion": "1.2.1"
    },
    { "name": "dio", "description": "A powerful HTTP client for Dart.", "latestVersion": "5.4.0" }
  ],
  "total": 2
}
```

### ⭐ Get Package Score

```json
{
  "name": "get_package_score",
  "arguments": {
    "name": "http"
  }
}
```

**Response:**

```json
{
  "grantedPoints": 160,
  "maxPoints": 160,
  "likeCount": 8425,
  "downloadCount30Days": 8375591,
  "tags": ["sdk:dart", "sdk:flutter", "topic:http", "topic:network"]
}
```

### 📊 Get Package Metrics

```json
{
  "name": "get_package_metrics",
  "arguments": {
    "name": "provider"
  }
}
```

**Response:**

```json
{
  "info": {
    "name": "provider",
    "description": "A wrapper around InheritedNotifier...",
    "latestVersion": "6.1.2",
    "published": "2024-01-15T..."
  },
  "score": {
    "grantedPoints": 160,
    "maxPoints": 160,
    "likeCount": 3200,
    "downloadCount30Days": 1500000,
    "tags": ["sdk:flutter", "is:flutter-friendly"]
  },
  "versionCount": 45,
  "latestVersion": "6.1.2"
}
```

---

## 🏗️ Development

```bash
# Clone and install
git clone https://github.com/testx1011/pub-mcp.git
cd pub-mcp
npm install

# Build
npm run build

# Development mode with watch
npm run dev

# Run tests
npm run test

# Watch mode for tests
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

---

<p align="center">
  Made with ❤️ for the Dart/Flutter community
</p>
