import { getPreferenceValues, showToast, Toast, LocalStorage } from "@raycast/api";
import { getUserProfileService } from "./userProfile";

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
 * Validate API token by making a test request to the organizations endpoint
 */
export async function validateCredentials(): Promise<CredentialsValidationResult> {
  try {
    const credentials = getCredentials();
    
    const response = await fetch(`${credentials.apiBaseUrl}/v1/organizations`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${credentials.apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          isValid: false,
          error: "Invalid API token. Please check your token in extension preferences.",
        };
      }
      
      if (response.status === 403) {
        return {
          isValid: false,
          error: "Access denied. Please ensure your API token has the required permissions.",
        };
      }

      return {
        isValid: false,
        error: `API request failed with status ${response.status}. Please try again.`,
      };
    }

    const data = await response.json() as { items?: Array<{ id: number; name: string }> };
    
    // TODO: Re-enable user profile fetching later
    // Try to fetch user profile for personalization
    // let userDisplayName: string | undefined;
    // try {
    //   const credentials = getCredentials();
    //   const userProfileService = getUserProfileService();
    //   
    //   // Get the first organization ID to fetch user profile
    //   const firstOrgId = data.items?.[0]?.id;
    //   const userId = credentials.userId ? parseInt(credentials.userId, 10) : undefined;
    //   
    //   if (firstOrgId) {
    //     const profile = await userProfileService.getCurrentUserProfile(firstOrgId, userId);
    //     if (profile) {
    //       userDisplayName = userProfileService.getDisplayName(profile);
    //     }
    //   }
    // } catch (profileError) {
    //   console.log("Could not fetch user profile during validation:", profileError);
    //   // Don't fail validation if profile fetch fails
    // }
    
    return {
      isValid: true,
      organizations: data.items || [],
      // userDisplayName,
    };
  } catch (error) {
    console.error("Credentials validation error:", error);
    
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

