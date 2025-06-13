import { useState } from "react";
import {
  List,
  ActionPanel,
  Action,
  Icon,
  Color,
  showToast,
  Toast,
  confirmAlert,
  Alert,
  Clipboard,
} from "@raycast/api";
import { useCachedAgentRuns } from "./hooks/useCachedAgentRuns";
import { getAPIClient } from "./api/client";
import { getAgentRunCache } from "./storage/agentRunCache";
import { AgentRunStatus, AgentRunFilters } from "./api/types";
import { getDateRanges, getStatusFilterOptions, hasActiveFilters, clearFilters } from "./utils/filtering";
import { SyncStatus } from "./storage/cacheTypes";

export default function ListAgentRuns() {
  const {
    filteredRuns,
    isLoading,
    isRefreshing,
    error,
    syncStatus,
    refresh,
    updateFilters,
    filters,
    organizationId,
  } = useCachedAgentRuns();

  const [searchText, setSearchText] = useState("");
  const apiClient = getAPIClient();
  const cache = getAgentRunCache();

  // Update search filter when search text changes
  const handleSearchTextChange = (text: string) => {
    setSearchText(text);
    updateFilters({
      ...filters,
      searchQuery: text,
    });
  };

  // Get status icon and color
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case AgentRunStatus.ACTIVE:
        return { icon: Icon.Clock, color: Color.Blue };
      case AgentRunStatus.COMPLETE:
        return { icon: Icon.CheckRosette, color: Color.Green };
      case AgentRunStatus.ERROR:
        return { icon: Icon.XMarkCircle, color: Color.Red };
      case AgentRunStatus.CANCELLED:
        return { icon: Icon.Stop, color: Color.Orange };
      case AgentRunStatus.EVALUATION:
        return { icon: Icon.Hourglass, color: Color.Yellow };
      case AgentRunStatus.TIMEOUT:
        return { icon: Icon.Clock, color: Color.Red };
      case AgentRunStatus.MAX_ITERATIONS_REACHED:
        return { icon: Icon.ArrowClockwise, color: Color.Red };
      case AgentRunStatus.OUT_OF_TOKENS:
        return { icon: Icon.Coins, color: Color.Red };
      default:
        return { icon: Icon.QuestionMark, color: Color.SecondaryText };
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Stop an agent run
  const stopAgentRun = async (agentRunId: number) => {
    if (!organizationId) return;

    const confirmed = await confirmAlert({
      title: "Stop Agent Run",
      message: `Are you sure you want to stop agent run #${agentRunId}?`,
      primaryAction: {
        title: "Stop",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (!confirmed) return;

    try {
      await apiClient.stopAgentRun(organizationId, { agent_run_id: agentRunId });
      
      await showToast({
        style: Toast.Style.Success,
        title: "Agent Run Stopped",
        message: `Agent run #${agentRunId} has been stopped`,
      });

      // Refresh to get updated status
      await refresh();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Stop Agent Run",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Resume an agent run
  const resumeAgentRun = async (agentRunId: number) => {
    if (!organizationId) return;

    try {
      // For resume, we need a prompt - this is a simplified version
      // In a real implementation, you might want to show a form for the resume prompt
      await apiClient.resumeAgentRun(organizationId, {
        agent_run_id: agentRunId,
        prompt: "Continue with the previous task",
      });

      await showToast({
        style: Toast.Style.Success,
        title: "Agent Run Resumed",
        message: `Agent run #${agentRunId} has been resumed`,
      });

      await refresh();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Resume Agent Run",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Add an agent run to monitor by ID or URL
  const addAgentRunToMonitor = async () => {
    if (!organizationId) return;

    try {
      // Check clipboard for potential agent run ID or URL
      const clipboardText = await Clipboard.readText();
      let suggestedInput = "";
      
      if (clipboardText) {
        // Try to extract agent run ID from clipboard if it looks like a URL or ID
        const urlMatch = clipboardText.match(/codegen\.com\/agent\/trace\/(\d+)/);
        if (urlMatch) {
          suggestedInput = urlMatch[1]; // Extract just the ID
        } else if (/^\d+$/.test(clipboardText.trim())) {
          suggestedInput = clipboardText.trim(); // Use the number directly
        }
      }

      // Show instructions based on whether we found something useful in clipboard
      const instructions = suggestedInput 
        ? `Found agent run ID ${suggestedInput} in clipboard. Press Enter to add it, or replace with a different ID/URL.`
        : "Copy an agent run ID or Codegen URL to your clipboard first, then try again.";

      await showToast({
        style: suggestedInput ? Toast.Style.Success : Toast.Style.Failure,
        title: suggestedInput ? `Add Agent Run #${suggestedInput}?` : "Copy Agent Run ID First",
        message: instructions,
      });

      if (!suggestedInput) return;

      // Parse the agent run ID
      const agentRunId = parseInt(suggestedInput, 10);

      await showToast({
        style: Toast.Style.Animated,
        title: "Adding Agent Run",
        message: `Fetching details for agent run #${agentRunId}...`,
      });

      // Fetch the agent run from the API
      const agentRun = await apiClient.getAgentRun(organizationId, agentRunId);
      
      // Add to cache and tracking
      await cache.updateAgentRun(organizationId, agentRun);
      await cache.addToTracking(organizationId, agentRun);

      await showToast({
        style: Toast.Style.Success,
        title: "Agent Run Added",
        message: `Now monitoring agent run #${agentRunId} - you'll get notifications for status changes`,
      });

      // Refresh to show the new agent run
      await refresh();

    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Add Agent Run",
        message: error instanceof Error ? error.message : "Could not fetch or add the agent run",
      });
    }
  };

  // Delete an agent run
  const deleteAgentRun = async (agentRunId: number) => {
    if (!organizationId) return;

    const confirmed = await confirmAlert({
      title: "Delete Agent Run",
      message: `Are you sure you want to delete agent run #${agentRunId}? This will remove it from your local cache.`,
      primaryAction: {
        title: "Delete",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (!confirmed) return;

    try {
      // Remove from cache
      await cache.removeAgentRun(organizationId, agentRunId);
      
      await showToast({
        style: Toast.Style.Success,
        title: "Agent Run Deleted",
        message: `Agent run #${agentRunId} has been removed`,
      });

      // Refresh to update the list
      await refresh();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Delete Agent Run",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    updateFilters(clearFilters());
    setSearchText("");
  };

  // Filter by status
  const filterByStatus = (status: AgentRunStatus) => {
    const currentStatuses = filters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    
    updateFilters({
      ...filters,
      status: newStatuses.length > 0 ? newStatuses : undefined,
    });
  };

  // Get sync status display
  const getSyncStatusAccessory = () => {
    switch (syncStatus) {
      case SyncStatus.SYNCING:
        return { icon: Icon.ArrowClockwise, tooltip: "Syncing..." };
      case SyncStatus.ERROR:
        return { icon: Icon.ExclamationMark, tooltip: "Sync failed" };
      case SyncStatus.SUCCESS:
        return { icon: Icon.CheckCircle, tooltip: "Synced" };
      default:
        return undefined;
    }
  };

  if (error && !isLoading) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Error Loading Agent Runs"
          description={error}
          actions={
            <ActionPanel>
              <Action title="Retry" onAction={refresh} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={handleSearchTextChange}
      searchBarPlaceholder="Search agent runs..."
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by Status"
          placeholder="All Statuses"
          onChange={(value) => {
            if (value === "all") {
              updateFilters({ ...filters, status: undefined });
            } else {
              filterByStatus(value as AgentRunStatus);
            }
          }}
        >
          <List.Dropdown.Item title="All Statuses" value="all" />
          <List.Dropdown.Section title="Status">
            {Object.values(AgentRunStatus).map((status) => (
              <List.Dropdown.Item
                key={status}
                title={status}
                value={status}
                icon={getStatusDisplay(status).icon}
              />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {filteredRuns.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.RocketShip}
          title={hasActiveFilters(filters) ? "No Matching Agent Runs" : "No Agent Runs"}
          description={
            hasActiveFilters(filters)
              ? "Try adjusting your search or filters"
              : "Create your first agent run to get started"
          }
          actions={
            <ActionPanel>
              <Action
                title="Add Agent Run to Monitor"
                icon={Icon.Binoculars}
                onAction={addAgentRunToMonitor}
                shortcut={{ modifiers: ["cmd"], key: "m" }}
              />
              <Action.Push
                title="Create Agent Run"
                icon={Icon.Plus}
                target={<div>Create Agent Run Form</div>} // This would be the actual create form
              />
              {hasActiveFilters(filters) && (
                <Action
                  title="Clear Filters"
                  icon={Icon.Trash}
                  onAction={handleClearFilters}
                />
              )}
              <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={refresh} />
            </ActionPanel>
          }
        />
      ) : (
        filteredRuns.map((run) => {
          const statusDisplay = getStatusDisplay(run.status);
          const canStop = run.status === AgentRunStatus.ACTIVE;
          const canResume = run.status === AgentRunStatus.PAUSED;

          return (
            <List.Item
              key={run.id}
              title={`Agent Run #${run.id}`}
              subtitle={`Created ${formatDate(run.created_at)}`}
              icon={{ source: statusDisplay.icon, tintColor: statusDisplay.color }}
              accessories={[
                { text: run.status },
              ]}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    <Action
                      title="Add Agent Run to Monitor"
                      icon={Icon.Binoculars}
                      onAction={addAgentRunToMonitor}
                      shortcut={{ modifiers: ["cmd"], key: "m" }}
                    />
                    <Action.OpenInBrowser
                      title="Open in Browser"
                      url={run.web_url}
                      icon={Icon.Globe}
                    />
                    <Action.CopyToClipboard
                      title="Copy Web URL"
                      content={run.web_url}
                      shortcut={{ modifiers: ["cmd"], key: "c" }}
                    />
                  </ActionPanel.Section>

                  <ActionPanel.Section>
                    {canStop && (
                      <Action
                        title="Stop Agent Run"
                        icon={Icon.Stop}
                        style={Action.Style.Destructive}
                        onAction={() => stopAgentRun(run.id)}
                        shortcut={{ modifiers: ["cmd"], key: "s" }}
                      />
                    )}
                    {canResume && (
                      <Action
                        title="Resume Agent Run"
                        icon={Icon.Play}
                        onAction={() => resumeAgentRun(run.id)}
                        shortcut={{ modifiers: ["cmd"], key: "r" }}
                      />
                    )}
                  </ActionPanel.Section>

                  <ActionPanel.Section>
                    <Action
                      title="Refresh"
                      icon={Icon.ArrowClockwise}
                      onAction={refresh}
                      shortcut={{ modifiers: ["cmd"], key: "r" }}
                    />
                    {hasActiveFilters(filters) && (
                      <Action
                        title="Clear Filters"
                        icon={Icon.Trash}
                        onAction={handleClearFilters}
                      />
                    )}
                    <Action
                      title="Delete Agent Run"
                      icon={Icon.Trash}
                      style={Action.Style.Destructive}
                      onAction={() => deleteAgentRun(run.id)}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
