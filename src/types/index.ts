export interface PackageInfo {
  name: string;
  description: string;
  latestVersion: string;
  published: string;
  updated: string;
  publisher?: string;
  homepage?: string;
  repository?: string;
  issues?: string;
  pubspec?: Record<string, unknown>;
}

export interface PackageVersion {
  version: string;
  published: string;
}

export interface PackageScore {
  grantedPoints: number;
  maxPoints: number;
  likeCount: number;
  downloadCount30Days: number;
  tags: string[];
  platforms?: string[];
  isFlutterFavorite?: boolean;
  isNullSafe?: boolean;
  isDart3Compatible?: boolean;
  sdk?: string;
}

export interface PackageChangelog {
  version: string;
  published: string;
  content: string;
}

export interface PackageDependencies {
  direct: Record<string, string>;
  dev: Record<string, string>;
  transitive: Record<string, string>;
}

export interface SearchResult {
  packages: {
    name: string;
    description: string;
    latestVersion: string;
    tags?: string[];
  }[];
  total: number;
}

export interface ToolInput {
  query?: string;
  limit?: number;
  name?: string;
  version?: string;
}

export interface ToolOutput {
  packages?: PackageInfo[];
  versions?: PackageVersion[];
  readme?: string;
  dependencies?: PackageDependencies;
  searchResults?: SearchResult;
  [key: string]: unknown;
}
