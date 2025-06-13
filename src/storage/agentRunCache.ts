import { Cache, LocalStorage } from "@raycast/api";
import { AgentRunResponse, AgentRunStatus } from "../api/types";
import { getAPIClient } from "../api/client";
import {
  AgentRunCacheEntry,
  CacheMetadata,
  CACHE_KEYS,
  CACHE_NAMESPACES,
  CACHE_CONFIGS,
  SyncStatus,
  SyncState,
} from "./cacheTypes";

export class AgentRunCache {
  private cache: Cache;
  private metadata: CacheMetadata;

  constructor() {
    this.cache = new Cache({
      namespace: CACHE_NAMESPACES.AGENT_RUNS,
      capacity: 10 * 1024 * 1024, // 10MB
    });
    this.metadata = {
      lastFullSync: "",
      version: "1.0.0",
      organizationSyncStatus: {},
    };
  }

  /**
   * Get cached agent runs for an organization
   */
  async getAgentRuns(organizationId: number): Promise<AgentRunResponse[]> {
    const cacheKey = this.getOrgCacheKey(organizationId);
    const cached = this.cache.get(cacheKey);
    
    if (!cached) {
      return [];
    }

    try {
      const entries: AgentRunCacheEntry[] = JSON.parse(cached);
      const now = new Date();
      
      // Filter out expired entries and return data
      return entries
        .filter(entry => {
          if (entry.expiresAt) {
            return new Date(entry.expiresAt) > now;
          }
          return true;
        })
        .map(entry => entry.data)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error) {
      console.error("Error parsing cached agent runs:", error);
      return [];
    }
  }

  /**
   * Get a specific cached agent run
   */
  async getAgentRun(organizationId: number, agentRunId: number): Promise<AgentRunResponse | null> {
    const runs = await this.getAgentRuns(organizationId);
    return runs.find(run => run.id === agentRunId) || null;
  }

  /**
   * Cache agent runs for an organization
   */
  async setAgentRuns(organizationId: number, agentRuns: AgentRunResponse[]): Promise<void> {
    const cacheKey = this.getOrgCacheKey(organizationId);
    const now = new Date();
    const config = CACHE_CONFIGS[CACHE_NAMESPACES.AGENT_RUNS];
    
    const entries: AgentRunCacheEntry[] = agentRuns.map(run => ({
      data: run,
      timestamp: now.toISOString(),
      expiresAt: new Date(now.getTime() + config.ttl).toISOString(),
      version: this.metadata.version,
      organizationId,
      isPolling: this.shouldPollRun(run),
    }));

    this.cache.set(cacheKey, JSON.stringify(entries));
    
    // Update metadata
    this.metadata.organizationSyncStatus[organizationId] = now.toISOString();
    await this.saveMetadata();
  }

  /**
   * Add or update a single agent run in cache
   */
  async updateAgentRun(organizationId: number, agentRun: AgentRunResponse): Promise<void> {
    const existingRuns = await this.getAgentRuns(organizationId);
    const runIndex = existingRuns.findIndex(run => run.id === agentRun.id);
    
    if (runIndex >= 0) {
      existingRuns[runIndex] = agentRun;
    } else {
      existingRuns.unshift(agentRun); // Add to beginning
    }

    await this.setAgentRuns(organizationId, existingRuns);
  }

  /**
   * Remove an agent run from cache
   */
  async removeAgentRun(organizationId: number, agentRunId: number): Promise<void> {
    const existingRuns = await this.getAgentRuns(organizationId);
    const filteredRuns = existingRuns.filter(run => run.id !== agentRunId);
    await this.setAgentRuns(organizationId, filteredRuns);
  }

  /**
   * Get agent runs that need polling (active status)
   */
  async getPollingRuns(organizationId: number): Promise<AgentRunResponse[]> {
    const runs = await this.getAgentRuns(organizationId);
    return runs.filter(run => this.shouldPollRun(run));
  }

  /**
   * Sync agent runs from API for an organization
   */
  async syncAgentRuns(organizationId: number): Promise<SyncState> {
    try {
      await this.setSyncStatus(organizationId, SyncStatus.SYNCING);
      
      const apiClient = getAPIClient();
      
      // For now, we'll implement a simple approach since the API doesn't have a list endpoint
      // In a real implementation, you might need to track agent run IDs separately
      const cachedRuns = await this.getAgentRuns(organizationId);
      const updatedRuns: AgentRunResponse[] = [];
      
      // Update existing runs that might have changed status
      for (const cachedRun of cachedRuns) {
        try {
          const updatedRun = await apiClient.getAgentRun(organizationId, cachedRun.id);
          updatedRuns.push(updatedRun);
        } catch (error) {
          // If we can't fetch a run, keep the cached version
          console.warn(`Failed to update agent run ${cachedRun.id}:`, error);
          updatedRuns.push(cachedRun);
        }
      }

      await this.setAgentRuns(organizationId, updatedRuns);
      await this.setSyncStatus(organizationId, SyncStatus.SUCCESS);
      
      return {
        status: SyncStatus.SUCCESS,
        lastSync: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Failed to sync agent runs:", error);
      await this.setSyncStatus(organizationId, SyncStatus.ERROR, error instanceof Error ? error.message : "Unknown error");
      
      return {
        status: SyncStatus.ERROR,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Clear cache for an organization
   */
  async clearCache(organizationId?: number): Promise<void> {
    if (organizationId) {
      const cacheKey = this.getOrgCacheKey(organizationId);
      this.cache.remove(cacheKey);
      delete this.metadata.organizationSyncStatus[organizationId];
    } else {
      this.cache.clear();
      this.metadata.organizationSyncStatus = {};
    }
    
    await this.saveMetadata();
  }

  /**
   * Get sync status for an organization
   */
  async getSyncStatus(organizationId: number): Promise<SyncState> {
    const statusKey = `sync-status-${organizationId}`;
    const status = await LocalStorage.getItem<string>(statusKey);
    
    if (status) {
      try {
        return JSON.parse(status);
      } catch {
        // Fall through to default
      }
    }
    
    return { status: SyncStatus.IDLE };
  }

  /**
   * Set sync status for an organization
   */
  private async setSyncStatus(organizationId: number, status: SyncStatus, error?: string): Promise<void> {
    const statusKey = `sync-status-${organizationId}`;
    const syncState: SyncState = {
      status,
      lastSync: new Date().toISOString(),
      error,
    };
    
    await LocalStorage.setItem(statusKey, JSON.stringify(syncState));
  }

  /**
   * Check if an agent run should be polled for updates
   */
  private shouldPollRun(run: AgentRunResponse): boolean {
    return run.status === AgentRunStatus.ACTIVE || run.status === AgentRunStatus.PENDING;
  }

  /**
   * Generate cache key for organization
   */
  private getOrgCacheKey(organizationId: number): string {
    return `${CACHE_KEYS.AGENT_RUNS}-org-${organizationId}`;
  }

  /**
   * Save metadata to LocalStorage
   */
  private async saveMetadata(): Promise<void> {
    await LocalStorage.setItem(CACHE_KEYS.METADATA, JSON.stringify(this.metadata));
  }

  /**
   * Load metadata from LocalStorage
   */
  private async loadMetadata(): Promise<void> {
    const stored = await LocalStorage.getItem<string>(CACHE_KEYS.METADATA);
    if (stored) {
      try {
        this.metadata = JSON.parse(stored);
      } catch (error) {
        console.error("Error loading cache metadata:", error);
      }
    }
  }
}

// Singleton instance
let agentRunCache: AgentRunCache | null = null;

export function getAgentRunCache(): AgentRunCache {
  if (!agentRunCache) {
    agentRunCache = new AgentRunCache();
  }
  return agentRunCache;
}

