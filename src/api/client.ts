import { showToast, Toast } from "@raycast/api";
import { getCredentials, showCredentialsError, validateCredentials } from "../utils/credentials";
import { clearStoredUserInfo } from "../storage/userStorage";
import {
  AgentRunResponse,
  UserResponse,
  OrganizationResponse,
  CreateAgentRunRequest,
  ResumeAgentRunRequest,
  StopAgentRunRequest,
  PaginatedResponse,
  APIError,
} from "./types";

export class CodegenAPIClient {
  private baseUrl: string;
  private apiToken: string;

  constructor() {
    const credentials = getCredentials();
    this.baseUrl = credentials.apiBaseUrl || "https://api.codegen.com";
    this.apiToken = credentials.apiToken;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      "Authorization": `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      if (!response.ok) {
        await this.handleAPIError(response);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error(`Request failed: ${error}`);
    }
  }

  private async handleAPIError(response: Response): Promise<never> {
    let errorMessage = `Request failed with status ${response.status}`;
    
    try {
      const errorData: APIError = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      // If we can't parse the error response, use the default message
    }

    if (response.status === 401) {
      await showCredentialsError("Invalid API token. Please check your credentials in extension preferences.");
      throw new Error("Authentication failed");
    }

    if (response.status === 403) {
      await showCredentialsError("Access denied. Please ensure your API token has the required permissions.");
      throw new Error("Access denied");
    }

    if (response.status === 429) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Rate Limit Exceeded",
        message: "Please wait a moment before trying again.",
      });
      throw new Error("Rate limit exceeded");
    }

    await showToast({
      style: Toast.Style.Failure,
      title: "API Error",
      message: errorMessage,
    });

    throw new Error(errorMessage);
  }

  // Agent Run Methods
  async createAgentRun(
    organizationId: number,
    request: CreateAgentRunRequest
  ): Promise<AgentRunResponse> {
    return this.makeRequest<AgentRunResponse>(
      `/v1/organizations/${organizationId}/agent/run`,
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
  }

  async getAgentRun(
    organizationId: number,
    agentRunId: number
  ): Promise<AgentRunResponse> {
    return this.makeRequest<AgentRunResponse>(
      `/v1/organizations/${organizationId}/agent/run/${agentRunId}`
    );
  }

  async resumeAgentRun(
    organizationId: number,
    request: ResumeAgentRunRequest
  ): Promise<AgentRunResponse> {
    return this.makeRequest<AgentRunResponse>(
      `/v1/beta/organizations/${organizationId}/agent/run/resume`,
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
  }

  async stopAgentRun(
    organizationId: number,
    request: StopAgentRunRequest
  ): Promise<AgentRunResponse> {
    return this.makeRequest<AgentRunResponse>(
      `/v1/beta/organizations/${organizationId}/agent/run/stop`,
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
  }

  // Organization Methods
  async getOrganizations(
    page = 1,
    size = 50
  ): Promise<PaginatedResponse<OrganizationResponse>> {
    return this.makeRequest<PaginatedResponse<OrganizationResponse>>(
      `/v1/organizations?page=${page}&size=${size}`
    );
  }

  // User Methods
  async getUsers(
    organizationId: number,
    page = 1,
    size = 50
  ): Promise<PaginatedResponse<UserResponse>> {
    return this.makeRequest<PaginatedResponse<UserResponse>>(
      `/v1/organizations/${organizationId}/users?page=${page}&size=${size}`
    );
  }

  async getUser(
    organizationId: number,
    userId: number
  ): Promise<UserResponse> {
    return this.makeRequest<UserResponse>(
      `/v1/organizations/${organizationId}/users/${userId}`
    );
  }

  async getCurrentUser(
    organizationId: number,
    userId: number
  ): Promise<UserResponse> {
    return this.makeRequest<UserResponse>(
      `/v1/organizations/${organizationId}/users/${userId}`
    );
  }

  // Get current user info from alpha /me endpoint
  async getMe(): Promise<UserResponse> {
    return this.makeRequest<UserResponse>("/v1/alpha/user/me");
  }

  // Validation Method
  async validateConnection(): Promise<boolean> {
    try {
      const result = await validateCredentials();
      return result.isValid;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let apiClient: CodegenAPIClient | null = null;

export function getAPIClient(): CodegenAPIClient {
  if (!apiClient) {
    apiClient = new CodegenAPIClient();
  }
  return apiClient;
}

// Reset the client (useful when credentials change)
export async function resetAPIClient(): Promise<void> {
  apiClient = null;
  // Clear stored user info when credentials change
  await clearStoredUserInfo();
}
