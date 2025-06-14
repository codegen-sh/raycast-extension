// API Constants - All endpoints in one place for easy maintenance

export const API_ENDPOINTS = {
  // User endpoints
  USER_ME: "/v1/users/me",
  
  // Organization endpoints
  ORGANIZATIONS: "/v1/organizations",
  ORGANIZATIONS_PAGINATED: (page: number, size: number) => `/v1/organizations?page=${page}&size=${size}`,
  
  // User management endpoints
  ORG_USERS: (organizationId: number, page: number, size: number) => 
    `/v1/organizations/${organizationId}/users?page=${page}&size=${size}`,
  ORG_USER: (organizationId: number, userId: number) => 
    `/v1/organizations/${organizationId}/users/${userId}`,
  
  // Agent Run endpoints
  AGENT_RUN_CREATE: (organizationId: number) => 
    `/v1/organizations/${organizationId}/agent/run`,
  AGENT_RUN_GET: (organizationId: number, agentRunId: number) => 
    `/v1/organizations/${organizationId}/agent/run/${agentRunId}`,
  AGENT_RUN_RESUME: (organizationId: number) => 
    `/v1/beta/organizations/${organizationId}/agent/run/resume`,
  AGENT_RUN_STOP: (organizationId: number) => 
    `/v1/beta/organizations/${organizationId}/agent/run/stop`,
} as const;

// API Base URL fallback
export const DEFAULT_API_BASE_URL = "https://api.codegen.com"; 