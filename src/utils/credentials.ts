import { getPreferenceValues, showToast, Toast, LocalStorage } from "@raycast/api";
import { getUserProfileService } from "./userProfile";
import { storeUserInfo, clearStoredUserInfo, isStoredUserInfoValid, getStoredUserInfo } from "../storage/userStorage";
import { UserResponse } from "../api/types";

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

  return {
    ...preferences,
    apiBaseUrl: preferences.apiBaseUrl || "https://api.codegen.com",
  };
}

/**
 * Validate API token by calling the /me endpoint to verify token and get user info
 */
export async function validateCredentials(): Promise<CredentialsValidationResult> {
  try {
    const credentials = getCredentials();
    
    // First, call the /me endpoint to verify the token and get user info
    const meResponse = await fetch(`${credentials.apiBaseUrl}/user/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${credentials.apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!meResponse.ok) {
      // Clear any stored user info if token is invalid
      await clearStoredUserInfo();
      
      if (meResponse.status === 401) {
        return {
          isValid: false,
          error: "Invalid API token. Please check your token in extension preferences.",
        };
      }
      
      if (meResponse.status === 403) {
        return {
          isValid: false,
          error: "Access denied. Please ensure your API token has the required permissions.",
        };
      }

      return {
        isValid: false,
        error: `API request failed with status ${meResponse.status}. Please try again.`,
      };
    }

    const userInfo = await meResponse.json() as UserResponse;
    
    // Store user info locally
    await storeUserInfo(userInfo, credentials.apiToken);
    
    // Get user display name
    const userDisplayName = userInfo.full_name || 
                           (userInfo.github_username ? `@${userInfo.github_username}` : undefined) ||
                           userInfo.email ||
                           `User ${userInfo.id}`;
    
    // Also fetch organizations for compatibility
    let organizations: Array<{ id: number; name: string }> = [];
    try {
      const orgResponse = await fetch(`${credentials.apiBaseUrl}/v1/organizations`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${credentials.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (orgResponse.ok) {
        const orgData = await orgResponse.json() as { items?: Array<{ id: number; name: string }> };
        organizations = orgData.items || [];
      }
    } catch (orgError) {
      console.log("Could not fetch organizations during validation:", orgError);
      // Don't fail validation if organizations fetch fails
    }
    
    return {
      isValid: true,
      organizations,
      userDisplayName,
      userInfo,
    };
  } catch (error) {
    console.error("Credentials validation error:", error);
    
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
 * Get current user info, either from storage or by fetching from API
 */
export async function getCurrentUserInfo(): Promise<UserResponse | null> {
  try {
    const credentials = getCredentials();
    
    // Check if we have valid stored user info
    const isValid = await isStoredUserInfoValid(credentials.apiToken);
    if (isValid) {
      const storedInfo = await getStoredUserInfo();
      if (storedInfo) {
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
    
    // If no valid stored info, fetch from API
    const meResponse = await fetch(`${credentials.apiBaseUrl}/user/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${credentials.apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!meResponse.ok) {
      console.error(`Failed to fetch user info: ${meResponse.status}`);
      return null;
    }

    const userInfo = await meResponse.json() as UserResponse;
    
    // Store the fetched user info
    await storeUserInfo(userInfo, credentials.apiToken);
    
    return userInfo;
  } catch (error) {
    console.error("Failed to get current user info:", error);
    return null;
  }
}
