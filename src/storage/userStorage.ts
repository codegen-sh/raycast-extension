import { LocalStorage } from "@raycast/api";
import { UserResponse } from "../api/types";

export interface StoredUserInfo extends UserResponse {
  lastUpdated: string;
  apiToken: string; // Store the token that was used to fetch this user info
}

const USER_STORAGE_KEY = "current_user_info";

/**
 * Store user information locally
 */
export async function storeUserInfo(userInfo: UserResponse, apiToken: string): Promise<void> {
  const storedUserInfo: StoredUserInfo = {
    ...userInfo,
    lastUpdated: new Date().toISOString(),
    apiToken,
  };
  
  await LocalStorage.setItem(USER_STORAGE_KEY, JSON.stringify(storedUserInfo));
}

/**
 * Get stored user information
 */
export async function getStoredUserInfo(): Promise<StoredUserInfo | null> {
  try {
    const stored = await LocalStorage.getItem<string>(USER_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    
    return JSON.parse(stored) as StoredUserInfo;
  } catch (error) {
    console.error("Failed to parse stored user info:", error);
    return null;
  }
}

/**
 * Clear stored user information
 */
export async function clearStoredUserInfo(): Promise<void> {
  await LocalStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Check if stored user info is valid for the current API token
 */
export async function isStoredUserInfoValid(currentApiToken: string): Promise<boolean> {
  const storedInfo = await getStoredUserInfo();
  if (!storedInfo) {
    return false;
  }
  
  // Check if the stored info is for the same API token
  return storedInfo.apiToken === currentApiToken;
}

/**
 * Get user display name from stored info
 */
export function getUserDisplayName(userInfo: UserResponse): string {
  if (userInfo.full_name) {
    return userInfo.full_name;
  }
  
  if (userInfo.github_username) {
    return `@${userInfo.github_username}`;
  }
  
  if (userInfo.email) {
    return userInfo.email;
  }
  
  return `User ${userInfo.id}`;
}
