import { getPreferenceValues, showToast, Toast, LocalStorage } from "@raycast/api";
import { getUserProfileService } from "./userProfile";
import { storeUserInfo, clearStoredUserInfo, isStoredUserInfoValid, getStoredUserInfo } from "../storage/userStorage";
import { UserResponse } from "../api/types";
import { API_ENDPOINTS, DEFAULT_API_BASE_URL } from "../api/constants";

export interface Preferences {
  apiToken: string;
  defaultOrganization?: string;
  userId?: string;
  apiBaseUrl?: string;
}

export interface CredentialsValidationResult {
  isValid: boolean;
  error?: string;
  organizations?: Array<{ id: number; name: string }>;
  userDisplayName?: string;
  userInfo?: UserResponse;
}

/**
 * Get user preferences with validation
 */
export function getCredentials(): Preferences {
  const preferences = getPreferenceValues<Preferences>();
  
  if (!preferences.apiToken) {
    throw new Error("API token is required. Please set it in extension preferences.");
  }

  // Check for environment variable first, then preferences, then default
  const apiBaseUrl = process.env.RAYCAST_CODEGEN_API_BASE_URL || 
                     preferences.apiBaseUrl || 
                     "https://api.codegen.sh";

  console.log("🔧 API Base URL configuration:", {
    fromEnv: !!process.env.RAYCAST_CODEGEN_API_BASE_URL,
    fromPrefs: !!preferences.apiBaseUrl,
    finalUrl: apiBaseUrl
  });

  return {
    ...preferences,
    apiBaseUrl,
  };
}

/**
 * Validate API token - uses cache first, only fetches if needed
 */
export async function validateCredentials(): Promise<CredentialsValidationResult> {
  console.log("🔍 Starting credential validation...");
  try {
    const credentials = getCredentials();
    console.log("📋 Credentials loaded:", {
      apiBaseUrl: credentials.apiBaseUrl,
      hasApiToken: !!credentials.apiToken,
      tokenLength: credentials.apiToken?.length || 0,
      defaultOrganization: credentials.defaultOrganization,
      userId: credentials.userId
    });
    
    // Check if we have valid cached user info first
    const isValid = await isStoredUserInfoValid(credentials.apiToken);
    if (isValid) {
      const storedInfo = await getStoredUserInfo();
      if (storedInfo) {
        console.log("✅ Using cached user info - no API call needed");
        
        // Get user display name from cache
        const userDisplayName = storedInfo.full_name || 
                               (storedInfo.github_username ? `@${storedInfo.github_username}` : undefined) ||
                               storedInfo.email ||
                               `User ${storedInfo.id}`;
        
        // Try to get cached organizations
        let organizations: Array<{ id: number; name: string }> = [];
        try {
          const cachedOrgs = await LocalStorage.getItem<string>("cachedOrganizations");
          if (cachedOrgs) {
            organizations = JSON.parse(cachedOrgs);
            console.log("✅ Using cached organizations:", organizations.length, "orgs");
          }
        } catch (error) {
          console.log("⚠️ Could not load cached organizations:", error);
        }
        
        return {
          isValid: true,
          organizations,
          userDisplayName,
          userInfo: {
            id: storedInfo.id,
            email: storedInfo.email,
            github_user_id: storedInfo.github_user_id,
            github_username: storedInfo.github_username,
            avatar_url: storedInfo.avatar_url,
            full_name: storedInfo.full_name,
          },
        };
      }
    }
    
    console.log("💫 No valid cache found - fetching fresh data");
    const endpoint = `${credentials.apiBaseUrl || DEFAULT_API_BASE_URL}${API_ENDPOINTS.USER_ME}`;
    console.log("🌐 Making request to:", endpoint);
    
    // Only make API call if no valid cache exists
    const meResponse = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${credentials.apiToken}`,
        "Content-Type": "application/json",
      },
    });
    
    console.log("📡 API Response:", {
      status: meResponse.status,
      statusText: meResponse.statusText,
      ok: meResponse.ok,
      headers: Object.fromEntries(meResponse.headers.entries())
    });

    if (!meResponse.ok) {
      console.error("❌ API request failed:", {
        status: meResponse.status,
        statusText: meResponse.statusText,
        url: endpoint
      });
      
      // Clear any stored user info if token is invalid
      await clearStoredUserInfo();
      
      if (meResponse.status === 401) {
        console.error("🔐 Authentication failed - invalid token");
        return {
          isValid: false,
          error: "Invalid API token. Please check your token in extension preferences.",
        };
      }
      
      if (meResponse.status === 403) {
        console.error("🚫 Access denied - insufficient permissions");
        return {
          isValid: false,
          error: "Access denied. Please ensure your API token has the required permissions.",
        };
      }

      console.error("⚠️ Generic API error:", meResponse.status);
      return {
        isValid: false,
        error: `API request failed with status ${meResponse.status}. Please try again.`,
      };
    }

    const userInfo = await meResponse.json() as UserResponse;
    console.log("👤 User info received:", {
      id: userInfo.id,
      email: userInfo.email,
      github_username: userInfo.github_username,
      full_name: userInfo.full_name,
      hasAvatarUrl: !!userInfo.avatar_url
    });
    
    // Store user info locally
    await storeUserInfo(userInfo, credentials.apiToken);
    console.log("💾 User info stored locally");
    
    // Get user display name
    const userDisplayName = userInfo.full_name || 
                           (userInfo.github_username ? `@${userInfo.github_username}` : undefined) ||
                           userInfo.email ||
                           `User ${userInfo.id}`;
    console.log("🏷️ User display name:", userDisplayName);
    
    // Fetch and cache organizations for first-time setup
    let organizations: Array<{ id: number; name: string }> = [];
    try {
      const orgEndpoint = `${credentials.apiBaseUrl || DEFAULT_API_BASE_URL}${API_ENDPOINTS.ORGANIZATIONS}`;
      console.log("🏢 Fetching organizations from:", orgEndpoint);
      
      const orgResponse = await fetch(orgEndpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${credentials.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log("🏢 Organizations response:", {
        status: orgResponse.status,
        ok: orgResponse.ok
      });

      if (orgResponse.ok) {
        const orgData = await orgResponse.json() as { items?: Array<{ id: number; name: string }> };
        organizations = orgData.items || [];
        console.log("🏢 Organizations loaded:", organizations.length, "orgs");
        
        // Cache the organizations for future use
        try {
          await LocalStorage.setItem("cachedOrganizations", JSON.stringify(organizations));
          console.log("💾 Organizations cached successfully");
        } catch (cacheError) {
          console.error("⚠️ Failed to cache organizations:", cacheError);
        }
      } else {
        console.warn("⚠️ Organizations fetch failed:", orgResponse.status);
      }
    } catch (orgError) {
      console.error("❌ Organizations fetch error:", orgError);
      // Don't fail validation if organizations fetch fails
    }
    
    console.log("✅ Credential validation successful");
    return {
      isValid: true,
      organizations,
      userDisplayName,
      userInfo,
    };
  } catch (error) {
    console.error("❌ Credentials validation error:", error);
    
    // Log additional error details
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: (error as any).cause
      });
    }
    
    // Clear stored user info on error
    await clearStoredUserInfo();
    
    if (error instanceof Error) {
      return {
        isValid: false,
        error: error.message,
      };
    }

    return {
      isValid: false,
      error: "Failed to validate credentials. Please check your network connection and try again.",
    };
  }
}

/**
 * Show a toast notification for credential errors
 */
export async function showCredentialsError(error: string) {
  await showToast({
    style: Toast.Style.Failure,
    title: "Authentication Error",
    message: error,
    primaryAction: {
      title: "Open Preferences",
      onAction: () => {
        // This will open the extension preferences
        // Users can update their API token there
      },
    },
  });
}

/**
 * Check if credentials are configured
 */
export function hasCredentials(): boolean {
  try {
    const preferences = getPreferenceValues<Preferences>();
    return !!preferences.apiToken;
  } catch {
    return false;
  }
}

/**
 * Get the default organization ID from preferences or LocalStorage
 */
export async function getDefaultOrganizationId(): Promise<number | null> {
  try {
    // First check LocalStorage (set by the organization list)
    const localStorageOrgId = await LocalStorage.getItem<string>("defaultOrganizationId");
    if (localStorageOrgId) {
      const orgId = parseInt(localStorageOrgId, 10);
      if (!isNaN(orgId)) {
        return orgId;
      }
    }

    // Fallback to preferences
    const credentials = getCredentials();
    if (credentials.defaultOrganization) {
      const orgId = parseInt(credentials.defaultOrganization, 10);
      return isNaN(orgId) ? null : orgId;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Get current user info - always uses cache, no API calls
 */
export async function getCurrentUserInfo(): Promise<UserResponse | null> {
  try {
    const credentials = getCredentials();
    
    // Always check cache first
    const isValid = await isStoredUserInfoValid(credentials.apiToken);
    if (isValid) {
      const storedInfo = await getStoredUserInfo();
      if (storedInfo) {
        console.log("✅ getCurrentUserInfo: Using cached user info");
        return {
          id: storedInfo.id,
          email: storedInfo.email,
          github_user_id: storedInfo.github_user_id,
          github_username: storedInfo.github_username,
          avatar_url: storedInfo.avatar_url,
          full_name: storedInfo.full_name,
        };
      }
    }
    
    console.log("⚠️ getCurrentUserInfo: No valid cached user info available");
    return null;
  } catch (error) {
    console.error("Failed to get current user info:", error);
    return null;
  }
}

/**
 * Force refresh user info and organizations from API - only use when explicitly needed
 */
export async function refreshUserDataFromAPI(): Promise<CredentialsValidationResult> {
  console.log("🔄 Force refreshing user data from API...");
  try {
    const credentials = getCredentials();
    
    // Clear existing cache
    await clearStoredUserInfo();
    await LocalStorage.removeItem("cachedOrganizations");
    
    const endpoint = `${credentials.apiBaseUrl || DEFAULT_API_BASE_URL}${API_ENDPOINTS.USER_ME}`;
    console.log("🌐 Fetching fresh user info from:", endpoint);
    
    const meResponse = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${credentials.apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!meResponse.ok) {
      console.error("❌ Failed to refresh user info:", meResponse.status);
      return {
        isValid: false,
        error: `API request failed with status ${meResponse.status}`,
      };
    }

    const userInfo = await meResponse.json() as UserResponse;
    console.log("👤 Fresh user info received");
    
    // Store fresh user info
    await storeUserInfo(userInfo, credentials.apiToken);
    
    const userDisplayName = userInfo.full_name || 
                           (userInfo.github_username ? `@${userInfo.github_username}` : undefined) ||
                           userInfo.email ||
                           `User ${userInfo.id}`;
    
    // Fetch and cache fresh organizations
    let organizations: Array<{ id: number; name: string }> = [];
    try {
      const orgEndpoint = `${credentials.apiBaseUrl || DEFAULT_API_BASE_URL}${API_ENDPOINTS.ORGANIZATIONS}`;
      console.log("🏢 Fetching fresh organizations from:", orgEndpoint);
      
      const orgResponse = await fetch(orgEndpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${credentials.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (orgResponse.ok) {
        const orgData = await orgResponse.json() as { items?: Array<{ id: number; name: string }> };
        organizations = orgData.items || [];
        console.log("🏢 Fresh organizations loaded:", organizations.length, "orgs");
        
        // Cache the fresh organizations
        await LocalStorage.setItem("cachedOrganizations", JSON.stringify(organizations));
        console.log("💾 Fresh data cached successfully");
      }
    } catch (orgError) {
      console.error("❌ Organizations refresh error:", orgError);
    }
    
    return {
      isValid: true,
      organizations,
      userDisplayName,
      userInfo,
    };
  } catch (error) {
    console.error("❌ Failed to refresh user data:", error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Failed to refresh data",
    };
  }
}
