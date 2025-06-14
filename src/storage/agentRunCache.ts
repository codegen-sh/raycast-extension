import { Cache, LocalStorage } from "@raycast/api";
import {
  AgentRunResponse,
  AgentRunStatus,
  TrackedAgentRun,
  AgentRunStatusChange,
} from "../api/types";
import { getAPIClient } from "../api/client";
import {
  AgentRunCacheEntry,
  CacheMetadata,
  CACHE_KEYS,
  CACHE_NAMESPACES,
  CACHE_CONFIGS,
  SyncStatus,
  SyncState,
  TrackedAgentRunCacheEntry,
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
        .filter((entry) => {
          if (entry.expiresAt) {
            return new Date(entry.expiresAt) > now;
          }
          return true;
        })
        .map((entry) => entry.data)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    } catch (error) {
      console.error("Error parsing cached agent runs:", error);
      return [];
    }
  }

  /**
   * Get a specific cached agent run
   */
  async getAgentRun(
    organizationId: number,
    agentRunId: number,
  ): Promise<AgentRunResponse | null> {
    const runs = await this.getAgentRuns(organizationId);
    return runs.find((run) => run.id === agentRunId) || null;
  }

  /**
   * Cache agent runs for an organization
   */
  async setAgentRuns(
    organizationId: number,
    agentRuns: AgentRunResponse[],
  ): Promise<void> {
    const cacheKey = this.getOrgCacheKey(organizationId);
    const now = new Date();
    const config = CACHE_CONFIGS[CACHE_NAMESPACES.AGENT_RUNS];

    const entries: AgentRunCacheEntry[] = agentRuns.map((run) => ({
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
  async updateAgentRun(
    organizationId: number,
    agentRun: AgentRunResponse,
  ): Promise<void> {
    const existingRuns = await this.getAgentRuns(organizationId);
    const runIndex = existingRuns.findIndex((run) => run.id === agentRun.id);

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
  async removeAgentRun(
    organizationId: number,
    agentRunId: number,
  ): Promise<void> {
    const existingRuns = await this.getAgentRuns(organizationId);
    const filteredRuns = existingRuns.filter((run) => run.id !== agentRunId);
    await this.setAgentRuns(organizationId, filteredRuns);
  }

  /**
   * Get agent runs that need polling (active status)
   */
  async getPollingRuns(organizationId: number): Promise<AgentRunResponse[]> {
    const runs = await this.getAgentRuns(organizationId);
    return runs.filter((run) => this.shouldPollRun(run));
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
          const updatedRun = await apiClient.getAgentRun(
            organizationId,
            cachedRun.id,
          );
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
      await this.setSyncStatus(
        organizationId,
        SyncStatus.ERROR,
        error instanceof Error ? error.message : "Unknown error",
      );

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
  private async setSyncStatus(
    organizationId: number,
    status: SyncStatus,
    error?: string,
  ): Promise<void> {
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
    return (
      run.status === AgentRunStatus.ACTIVE ||
      run.status === AgentRunStatus.EVALUATION
    );
  }

  /**
   * Add an agent run to the tracking list
   */
  async addToTracking(
    organizationId: number,
    agentRun: AgentRunResponse,
  ): Promise<void> {
    // Add to tracking
    const trackedRun: TrackedAgentRun = {
      id: agentRun.id,
      organizationId,
      lastKnownStatus: agentRun.status,
      createdAt: agentRun.created_at || new Date().toISOString(),
      webUrl: agentRun.web_url || "",
      addedAt: new Date().toISOString(),
    };

    const entry: TrackedAgentRunCacheEntry = {
      data: trackedRun,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      organizationId,
    };

    const key = this.getTrackedRunKey(organizationId, agentRun.id);
    this.cache.set(key, JSON.stringify(entry));
    await this.addKeyToTracking(key);

    // Also add to main agent runs cache
    await this.updateAgentRun(organizationId, agentRun);

    console.log(
      `Added agent run ${agentRun.id} to tracking for org ${organizationId}`,
    );
  }

  /**
   * Get all tracked agent runs for an organization
   */
  async getTrackedRuns(organizationId: number): Promise<TrackedAgentRun[]> {
    const prefix = `${CACHE_KEYS.TRACKED_RUNS}-org-${organizationId}-`;
    const keys = await this.getAllKeysWithPrefix(prefix);
    const trackedRuns: TrackedAgentRun[] = [];

    for (const key of keys) {
      const cached = this.cache.get(key);
      if (cached) {
        try {
          const entry: TrackedAgentRunCacheEntry = JSON.parse(cached);
          trackedRuns.push(entry.data);
        } catch (error) {
          console.error(
            `Error parsing tracked run from cache key ${key}:`,
            error,
          );
        }
      }
    }

    return trackedRuns.sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
    );
  }

  /**
   * Get all organizations that have tracked agent runs
   */
  async getTrackedOrganizations(): Promise<number[]> {
    // Get all organization tracking keys
    const orgTrackingKey = "cache-keys-tracked-organizations";
    const stored = await LocalStorage.getItem<string>(orgTrackingKey);

    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error("Error parsing tracked organizations:", error);
      }
    }

    return [];
  }

  /**
   * Check for status changes in tracked agent runs
   */
  async checkForStatusChanges(
    organizationId: number,
  ): Promise<AgentRunStatusChange[]> {
    const trackedRuns = await this.getTrackedRuns(organizationId);
    if (trackedRuns.length === 0) {
      return [];
    }

    const apiClient = getAPIClient();
    const statusChanges: AgentRunStatusChange[] = [];

    // Check each tracked run for status changes
    for (const trackedRun of trackedRuns) {
      try {
        const currentRun = await apiClient.getAgentRun(
          organizationId,
          trackedRun.id,
        );
        if (currentRun && currentRun.status !== trackedRun.lastKnownStatus) {
          // Status has changed!
          const change: AgentRunStatusChange = {
            agentRunId: trackedRun.id,
            organizationId,
            oldStatus: trackedRun.lastKnownStatus,
            newStatus: currentRun.status || "UNKNOWN",
            timestamp: new Date().toISOString(),
            webUrl: currentRun.web_url || trackedRun.webUrl,
          };

          statusChanges.push(change);

          // Update the tracked run with the new status
          await this.updateTrackedRunStatus(
            organizationId,
            trackedRun.id,
            currentRun.status,
          );
        }
      } catch (error) {
        console.error(`Error checking status for run ${trackedRun.id}:`, error);
        // Continue with other runs even if one fails
      }
    }

    return statusChanges;
  }

  /**
   * Update the status of a tracked agent run
   */
  private async updateTrackedRunStatus(
    organizationId: number,
    agentRunId: number,
    newStatus: string | null,
  ): Promise<void> {
    const key = this.getTrackedRunKey(organizationId, agentRunId);
    const cached = this.cache.get(key);

    if (cached) {
      try {
        const entry: TrackedAgentRunCacheEntry = JSON.parse(cached);
        entry.data.lastKnownStatus = newStatus;
        entry.timestamp = new Date().toISOString();

        this.cache.set(key, JSON.stringify(entry));
        console.log(`Updated tracked run ${agentRunId} status to ${newStatus}`);
      } catch (error) {
        console.error(
          `Error updating tracked run status for ${agentRunId}:`,
          error,
        );
      }
    }
  }

  /**
   * Remove completed or failed runs from tracking (optional cleanup)
   */
  async cleanupCompletedRuns(organizationId: number): Promise<void> {
    const trackedRuns = await this.getTrackedRuns(organizationId);
    const completedStatuses = [
      AgentRunStatus.COMPLETE,
      AgentRunStatus.ERROR,
      AgentRunStatus.CANCELLED,
      AgentRunStatus.TIMEOUT,
      AgentRunStatus.MAX_ITERATIONS_REACHED,
      AgentRunStatus.OUT_OF_TOKENS,
    ];

    for (const trackedRun of trackedRuns) {
      if (
        trackedRun.lastKnownStatus &&
        completedStatuses.includes(trackedRun.lastKnownStatus as AgentRunStatus)
      ) {
        // Check if it's been completed for more than 24 hours
        const completedTime = new Date(trackedRun.addedAt).getTime();
        const now = new Date().getTime();
        const hoursSinceCompleted = (now - completedTime) / (1000 * 60 * 60);

        if (hoursSinceCompleted > 24) {
          const key = this.getTrackedRunKey(organizationId, trackedRun.id);
          this.cache.remove(key);
          console.log(`Cleaned up completed tracked run ${trackedRun.id}`);
        }
      }
    }
  }

  /**
   * Get cache key for a tracked run
   */
  private getTrackedRunKey(organizationId: number, agentRunId: number): string {
    return `${CACHE_KEYS.TRACKED_RUNS}-org-${organizationId}-run-${agentRunId}`;
  }

  /**
   * Get all cache keys with a given prefix
   */
  private async getAllKeysWithPrefix(prefix: string): Promise<string[]> {
    // Note: Raycast Cache doesn't provide a way to list keys, so we'll use LocalStorage for tracking
    const trackingKey = `cache-keys-${prefix}`;
    const stored = await LocalStorage.getItem<string>(trackingKey);

    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error(`Error parsing cache keys for prefix ${prefix}:`, error);
        return [];
      }
    }

    return [];
  }

  /**
   * Add a key to the tracking list (for getAllKeysWithPrefix)
   */
  private async addKeyToTracking(key: string): Promise<void> {
    // Extract the organization ID from the key
    const match = key.match(/tracked-runs-org-(\d+)-/);
    if (!match) {
      console.error(`Invalid key format for tracking: ${key}`);
      return;
    }

    const orgId = parseInt(match[1], 10);

    // Track the run key
    const prefix = `tracked-runs-org-${orgId}-`;
    const trackingKey = `cache-keys-${prefix}`;
    const stored = await LocalStorage.getItem<string>(trackingKey);

    let keys: string[] = [];
    if (stored) {
      try {
        keys = JSON.parse(stored);
      } catch (error) {
        console.error(`Error parsing existing keys for ${trackingKey}:`, error);
      }
    }

    if (!keys.includes(key)) {
      keys.push(key);
      await LocalStorage.setItem(trackingKey, JSON.stringify(keys));
      console.log(`Added key ${key} to tracking for org ${orgId}`);
    }

    // Track the organization
    const orgTrackingKey = "cache-keys-tracked-organizations";
    const orgStored = await LocalStorage.getItem<string>(orgTrackingKey);

    let orgIds: number[] = [];
    if (orgStored) {
      try {
        orgIds = JSON.parse(orgStored);
      } catch (error) {
        console.error("Error parsing tracked organizations:", error);
      }
    }

    if (!orgIds.includes(orgId)) {
      orgIds.push(orgId);
      await LocalStorage.setItem(orgTrackingKey, JSON.stringify(orgIds));
      console.log(`Added organization ${orgId} to tracking`);
    }
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
    await LocalStorage.setItem(
      CACHE_KEYS.METADATA,
      JSON.stringify(this.metadata),
    );
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
