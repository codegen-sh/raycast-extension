// API Response Types based on Codegen API

export interface AgentRunResponse {
  id: number;
  organization_id: number;
  status: string;
  created_at: string;
  web_url: string;
  result?: string;
}

export interface UserResponse {
  id: number;
  email?: string;
  github_user_id: string;
  github_username: string;
  avatar_url?: string;
  full_name?: string;
}

export interface OrganizationResponse {
  id: number;
  name: string;
  settings: {
    enable_pr_creation: boolean;
    enable_rules_detection: boolean;
  };
}

// API Request Types
export interface CreateAgentRunRequest {
  prompt: string;
  images?: string[]; // Base64 encoded data URIs
}

export interface ResumeAgentRunRequest {
  agent_run_id: number;
  prompt: string;
  images?: string[];
}

export interface StopAgentRunRequest {
  agent_run_id: number;
}

// Paginated Response Type
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Agent Run Status Types (matching backend AgentRunStatusType)
export enum AgentRunStatus {
  ACTIVE = "ACTIVE",
  ERROR = "ERROR",
  EVALUATION = "EVALUATION",
  COMPLETE = "COMPLETE",
  CANCELLED = "CANCELLED",
  TIMEOUT = "TIMEOUT",
  MAX_ITERATIONS_REACHED = "MAX_ITERATIONS_REACHED",
  OUT_OF_TOKENS = "OUT_OF_TOKENS",
  FAILED = "FAILED",
  PAUSED = "PAUSED",
  PENDING = "PENDING",
}

// Local Cache Types
export interface CachedAgentRun extends AgentRunResponse {
  lastUpdated: string;
  organizationName?: string;
  isPolling?: boolean;
}

export interface CachedOrganization extends OrganizationResponse {
  lastUpdated: string;
  isDefault?: boolean;
}

export interface CachedUser extends UserResponse {
  lastUpdated: string;
  organizationId: number;
}

// Filter and Search Types
export interface AgentRunFilters {
  status?: AgentRunStatus[];
  organizationId?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

export interface SortOptions {
  field: "created_at" | "status" | "organization_id";
  direction: "asc" | "desc";
}

// Error Types
export interface APIError {
  message: string;
  status_code: number;
  details?: string;
}

// Cache Metadata
export interface CacheMetadata {
  lastSync: string;
  version: string;
  organizationId?: number;
}

// Status Change Tracking
export interface AgentRunStatusChange {
  agentRunId: number;
  organizationId: number;
  oldStatus: string | null;
  newStatus: string;
  timestamp: string;
  webUrl: string;
}

// Tracked Agent Run
export interface TrackedAgentRun {
  id: number;
  organizationId: number;
  lastKnownStatus: string | null;
  createdAt: string;
  webUrl: string;
  addedAt: string; // When it was added to tracking
}
