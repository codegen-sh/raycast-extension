import { getPreferenceValues, showToast, Toast } from "@raycast/api";

export interface Preferences {
  apiToken: string;
  defaultOrganization?: string;
  apiBaseUrl?: string;
}

export interface CredentialsValidationResult {
  isValid: boolean;
  error?: string;
  organizations?: Array<{ id: number; name: string }>;
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

    const data = await response.json();
    
    return {
      isValid: true,
      organizations: data.items || [],
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
 * Get the default organization ID from preferences or return null
 */
export function getDefaultOrganizationId(): number | null {
  try {
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

