import { AgentRunResponse, AgentRunStatus, AgentRunFilters, SortOptions } from "../api/types";

/**
 * Filter agent runs based on provided criteria
 */
export function filterAgentRuns(
  runs: AgentRunResponse[],
  filters: AgentRunFilters
): AgentRunResponse[] {
  let filteredRuns = [...runs];

  // Filter by status
  if (filters.status && filters.status.length > 0) {
    filteredRuns = filteredRuns.filter(run => 
      filters.status!.includes(run.status as AgentRunStatus)
    );
  }

  // Filter by organization
  if (filters.organizationId) {
    filteredRuns = filteredRuns.filter(run => 
      run.organization_id === filters.organizationId
    );
  }

  // Filter by date range
  if (filters.dateRange) {
    const { start, end } = filters.dateRange;
    filteredRuns = filteredRuns.filter(run => {
      const runDate = new Date(run.created_at);
      return runDate >= start && runDate <= end;
    });
  }

  // Filter by search query
  if (filters.searchQuery && filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase().trim();
    filteredRuns = filteredRuns.filter(run => 
      searchInAgentRun(run, query)
    );
  }

  return filteredRuns;
}

/**
 * Search within an agent run for a query string
 */
export function searchInAgentRun(run: AgentRunResponse, query: string): boolean {
  const searchableText = [
    run.id.toString(),
    run.status.toLowerCase(),
    run.result || "",
    // Add more searchable fields as needed
  ].join(" ").toLowerCase();

  return searchableText.includes(query);
}

/**
 * Sort agent runs based on provided options
 */
export function sortAgentRuns(
  runs: AgentRunResponse[],
  sortOptions: SortOptions
): AgentRunResponse[] {
  const sortedRuns = [...runs];

  sortedRuns.sort((a, b) => {
    let comparison = 0;

    switch (sortOptions.field) {
      case "created_at":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case "status":
        comparison = a.status.localeCompare(b.status);
        break;
      case "organization_id":
        comparison = a.organization_id - b.organization_id;
        break;
      default:
        comparison = 0;
    }

    return sortOptions.direction === "desc" ? -comparison : comparison;
  });

  return sortedRuns;
}

/**
 * Get predefined date ranges for filtering
 */
export function getDateRanges(): Record<string, { start: Date; end: Date }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
  
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  
  const last30Days = new Date(today);
  last30Days.setDate(today.getDate() - 30);

  return {
    today: { start: today, end: now },
    yesterday: { start: yesterday, end: today },
    thisWeek: { start: thisWeekStart, end: now },
    lastWeek: { start: lastWeekStart, end: lastWeekEnd },
    thisMonth: { start: thisMonthStart, end: now },
    lastMonth: { start: lastMonthStart, end: lastMonthEnd },
    last30Days: { start: last30Days, end: now },
  };
}

/**
 * Get status filter options with counts
 */
export function getStatusFilterOptions(
  runs: AgentRunResponse[]
): Array<{ status: AgentRunStatus; count: number; label: string }> {
  const statusCounts = runs.reduce((acc, run) => {
    const status = run.status as AgentRunStatus;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<AgentRunStatus, number>);

  const statusLabels: Record<AgentRunStatus, string> = {
    [AgentRunStatus.ACTIVE]: "Active",
    [AgentRunStatus.COMPLETE]: "Complete", 
    [AgentRunStatus.FAILED]: "Failed",
    [AgentRunStatus.PAUSED]: "Paused",
    [AgentRunStatus.PENDING]: "Pending",
    [AgentRunStatus.ERROR]: "Error",
    [AgentRunStatus.EVALUATION]: "Evaluation",
    [AgentRunStatus.CANCELLED]: "Cancelled",
    [AgentRunStatus.TIMEOUT]: "Timeout",
    [AgentRunStatus.MAX_ITERATIONS_REACHED]: "Max Iterations",
    [AgentRunStatus.OUT_OF_TOKENS]: "Out of Tokens",
  };

  return Object.entries(statusCounts).map(([status, count]) => ({
    status: status as AgentRunStatus,
    count,
    label: statusLabels[status as AgentRunStatus] || status,
  }));
}

/**
 * Create a filter summary string for display
 */
export function getFilterSummary(filters: AgentRunFilters): string {
  const parts: string[] = [];

  if (filters.status && filters.status.length > 0) {
    if (filters.status.length === 1) {
      parts.push(`Status: ${filters.status[0]}`);
    } else {
      parts.push(`Status: ${filters.status.length} selected`);
    }
  }

  if (filters.dateRange) {
    const { start, end } = filters.dateRange;
    const startStr = start.toLocaleDateString();
    const endStr = end.toLocaleDateString();
    
    if (startStr === endStr) {
      parts.push(`Date: ${startStr}`);
    } else {
      parts.push(`Date: ${startStr} - ${endStr}`);
    }
  }

  if (filters.searchQuery && filters.searchQuery.trim()) {
    parts.push(`Search: "${filters.searchQuery.trim()}"`);
  }

  return parts.length > 0 ? parts.join(", ") : "No filters applied";
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: AgentRunFilters): boolean {
  return !!(
    (filters.status && filters.status.length > 0) ||
    filters.dateRange ||
    (filters.searchQuery && filters.searchQuery.trim()) ||
    filters.organizationId
  );
}

/**
 * Clear all filters
 */
export function clearFilters(): AgentRunFilters {
  return {};
}

/**
 * Debounce function for search input
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

