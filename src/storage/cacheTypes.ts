import { AgentRunResponse, OrganizationResponse, UserResponse, TrackedAgentRun, AgentRunStatusChange } from "../api/types";

// Cache Keys
export const CACHE_KEYS = {
  AGENT_RUNS: "agent-runs",
  ORGANIZATIONS: "organizations", 
  USERS: "users",
  METADATA: "metadata",
  TRACKED_RUNS: "tracked-runs",
} as const;

// Cache Namespaces
export const CACHE_NAMESPACES = {
  AGENT_RUNS: "agent-runs",
  ORGANIZATIONS: "organizations",
  USERS: "users",
} as const;

// Cache Entry Types
export interface CacheEntry<T> {
  data: T;
  timestamp: string;
  expiresAt?: string;
  version: string;
}

export interface AgentRunCacheEntry extends CacheEntry<AgentRunResponse> {
  organizationId: number;
  isPolling?: boolean;
  lastPolled?: string;
}

export interface OrganizationCacheEntry extends CacheEntry<OrganizationResponse> {
  isDefault?: boolean;
}

export interface UserCacheEntry extends CacheEntry<UserResponse> {
  organizationId: number;
}

// Cache Metadata
export interface CacheMetadata {
  lastFullSync: string;
  version: string;
  organizationSyncStatus: Record<number, string>; // orgId -> lastSyncTime
}

// Cache Configuration
export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxEntries: number;
  namespace: string;
}

// Default cache configurations
export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  [CACHE_NAMESPACES.AGENT_RUNS]: {
    ttl: 5 * 60 * 1000, // 5 minutes for agent runs
    maxEntries: 1000,
    namespace: CACHE_NAMESPACES.AGENT_RUNS,
  },
  [CACHE_NAMESPACES.ORGANIZATIONS]: {
    ttl: 60 * 60 * 1000, // 1 hour for organizations
    maxEntries: 100,
    namespace: CACHE_NAMESPACES.ORGANIZATIONS,
  },
  [CACHE_NAMESPACES.USERS]: {
    ttl: 30 * 60 * 1000, // 30 minutes for users
    maxEntries: 500,
    namespace: CACHE_NAMESPACES.USERS,
  },
};

// Sync Status
export enum SyncStatus {
  IDLE = "idle",
  SYNCING = "syncing",
  ERROR = "error",
  SUCCESS = "success",
}

export interface SyncState {
  status: SyncStatus;
  lastSync?: string;
  error?: string;
  progress?: number;
}

// Tracked Agent Run Cache Entry
export interface TrackedAgentRunCacheEntry extends CacheEntry<TrackedAgentRun> {
  organizationId: number;
}
