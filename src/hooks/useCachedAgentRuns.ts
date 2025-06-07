import { useState, useEffect, useCallback } from "react";
import { showToast, Toast } from "@raycast/api";
import { AgentRunResponse, AgentRunFilters, SortOptions, AgentRunStatus } from "../api/types";
import { getAgentRunCache } from "../storage/agentRunCache";
import { getAPIClient } from "../api/client";
import { filterAgentRuns, sortAgentRuns } from "../utils/filtering";
import { getDefaultOrganizationId } from "../utils/credentials";
import { SyncStatus } from "../storage/cacheTypes";

interface UseCachedAgentRunsResult {
  agentRuns: AgentRunResponse[];
  filteredRuns: AgentRunResponse[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  refresh: () => Promise<void>;
  updateFilters: (filters: AgentRunFilters) => void;
  updateSort: (sort: SortOptions) => void;
  filters: AgentRunFilters;
  sortOptions: SortOptions;
  organizationId: number | null;
  setOrganizationId: (orgId: number) => void;
}

export function useCachedAgentRuns(): UseCachedAgentRunsResult {
  const [agentRuns, setAgentRuns] = useState<AgentRunResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(SyncStatus.IDLE);
  const [organizationId, setOrganizationIdState] = useState<number | null>(getDefaultOrganizationId());
  
  // Filter and sort state
  const [filters, setFilters] = useState<AgentRunFilters>({});
  const [sortOptions, setSortOptions] = useState<SortOptions>({
    field: "created_at",
    direction: "desc",
  });

  const cache = getAgentRunCache();
  const apiClient = getAPIClient();

  // Load cached data
  const loadCachedData = useCallback(async () => {
    if (!organizationId) return;

    try {
      const cachedRuns = await cache.getAgentRuns(organizationId);
      setAgentRuns(cachedRuns);
      
      const status = await cache.getSyncStatus(organizationId);
      setSyncStatus(status.status);
    } catch (err) {
      console.error("Error loading cached data:", err);
      setError(err instanceof Error ? err.message : "Failed to load cached data");
    }
  }, [organizationId, cache]);

  // Sync with API
  const syncWithAPI = useCallback(async (showSuccessToast = false) => {
    if (!organizationId) return;

    try {
      setIsRefreshing(true);
      setError(null);

      const syncResult = await cache.syncAgentRuns(organizationId);
      setSyncStatus(syncResult.status);

      if (syncResult.status === SyncStatus.SUCCESS) {
        const updatedRuns = await cache.getAgentRuns(organizationId);
        setAgentRuns(updatedRuns);
        
        if (showSuccessToast) {
          await showToast({
            style: Toast.Style.Success,
            title: "Agent Runs Updated",
            message: `Loaded ${updatedRuns.length} agent runs`,
          });
        }
      } else if (syncResult.error) {
        setError(syncResult.error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Sync Failed",
          message: syncResult.error,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sync data";
      setError(errorMessage);
      setSyncStatus(SyncStatus.ERROR);
      
      await showToast({
        style: Toast.Style.Failure,
        title: "Sync Error",
        message: errorMessage,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [organizationId, cache]);

  // Refresh function (load cache + sync)
  const refresh = useCallback(async () => {
    await loadCachedData();
    await syncWithAPI(true);
  }, [loadCachedData, syncWithAPI]);

  // Update filters
  const updateFilters = useCallback((newFilters: AgentRunFilters) => {
    setFilters(newFilters);
  }, []);

  // Update sort options
  const updateSort = useCallback((newSort: SortOptions) => {
    setSortOptions(newSort);
  }, []);

  // Set organization ID
  const setOrganizationId = useCallback((orgId: number) => {
    setOrganizationIdState(orgId);
    setAgentRuns([]);
    setError(null);
    setSyncStatus(SyncStatus.IDLE);
  }, []);

  // Initial load
  useEffect(() => {
    if (organizationId) {
      setIsLoading(true);
      loadCachedData().finally(() => {
        setIsLoading(false);
        // Background sync without showing loading state
        syncWithAPI(false);
      });
    }
  }, [organizationId, loadCachedData, syncWithAPI]);

  // Polling for active runs
  useEffect(() => {
    if (!organizationId) return;

    const pollActiveRuns = async () => {
      try {
        const pollingRuns = await cache.getPollingRuns(organizationId);
        
        if (pollingRuns.length === 0) return;

        // Update each active run
        const updatePromises = pollingRuns.map(async (run) => {
          try {
            const updatedRun = await apiClient.getAgentRun(organizationId, run.id);
            await cache.updateAgentRun(organizationId, updatedRun);
            return updatedRun;
          } catch (err) {
            console.warn(`Failed to update agent run ${run.id}:`, err);
            return run;
          }
        });

        const updatedRuns = await Promise.all(updatePromises);
        
        // Check if any runs changed status
        const statusChanged = updatedRuns.some((updated, index) => 
          updated.status !== pollingRuns[index].status
        );

        if (statusChanged) {
          // Reload all cached data to reflect changes
          await loadCachedData();
        }
      } catch (err) {
        console.error("Error polling active runs:", err);
      }
    };

    // Poll every 30 seconds for active runs
    const pollInterval = setInterval(pollActiveRuns, 30000);
    
    // Initial poll
    pollActiveRuns();

    return () => clearInterval(pollInterval);
  }, [organizationId, cache, apiClient, loadCachedData]);

  // Apply filters and sorting
  const filteredRuns = sortAgentRuns(
    filterAgentRuns(agentRuns, filters),
    sortOptions
  );

  return {
    agentRuns,
    filteredRuns,
    isLoading,
    isRefreshing,
    error,
    syncStatus,
    refresh,
    updateFilters,
    updateSort,
    filters,
    sortOptions,
    organizationId,
    setOrganizationId,
  };
}

