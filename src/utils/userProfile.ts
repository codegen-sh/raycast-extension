import { LocalStorage } from "@raycast/api";
import { getAPIClient } from "../api/client";
import { UserResponse } from "../api/types";

export interface UserProfile extends UserResponse {
  organizationId: number;
  lastUpdated: string;
}

const USER_PROFILE_KEY = "currentUserProfile";

/**
 * User Profile Service
 * Manages the current user's profile information
 */
class UserProfileService {
  private cachedProfile: UserProfile | null = null;

  /**
   * Get the current user's profile, with caching
   */
  async getCurrentUserProfile(organizationId: number, userId?: number): Promise<UserProfile | null> {
    try {
      // Check cache first
      if (this.cachedProfile && this.cachedProfile.organizationId === organizationId) {
        const cacheAge = Date.now() - new Date(this.cachedProfile.lastUpdated).getTime();
        // Cache for 1 hour
        if (cacheAge < 60 * 60 * 1000) {
          return this.cachedProfile;
        }
      }

      // Fetch from API
      const apiClient = getAPIClient();
      let userResponse: UserResponse;

      try {
        // Try the /me endpoint first (if available)
        userResponse = await apiClient.getMe();
      } catch (meError) {
        // Fallback to specific user endpoint if we have a user ID
        if (userId) {
          userResponse = await apiClient.getCurrentUser(organizationId, userId);
        } else {
          throw new Error("No user ID provided and /me endpoint not available");
        }
      }
      
      const profile: UserProfile = {
        ...userResponse,
        organizationId,
        lastUpdated: new Date().toISOString(),
      };

      // Cache the profile
      this.cachedProfile = profile;
      await LocalStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));

      return profile;
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      
      // Try to return cached profile even if expired
      if (this.cachedProfile) {
        return this.cachedProfile;
      }
      
      return null;
    }
  }

  /**
   * Load cached user profile from LocalStorage
   */
  async loadCachedProfile(): Promise<UserProfile | null> {
    try {
      const cached = await LocalStorage.getItem<string>(USER_PROFILE_KEY);
      if (cached) {
        this.cachedProfile = JSON.parse(cached);
        return this.cachedProfile;
      }
    } catch (error) {
      console.error("Failed to load cached user profile:", error);
    }
    return null;
  }

  /**
   * Get the user's display name (full name or GitHub username fallback)
   */
  getDisplayName(profile: UserProfile | null): string {
    if (!profile) {
      return "User";
    }

    // Prefer full name if available and not empty
    if (profile.full_name && profile.full_name.trim()) {
      return profile.full_name.trim();
    }

    // Fallback to GitHub username
    if (profile.github_username) {
      return profile.github_username;
    }

    // Last resort fallback
    return "User";
  }

  /**
   * Get the user's first name (from full name or GitHub username)
   */
  getFirstName(profile: UserProfile | null): string {
    const displayName = this.getDisplayName(profile);
    
    // If it looks like a full name (contains space), take the first part
    if (displayName.includes(" ")) {
      return displayName.split(" ")[0];
    }
    
    return displayName;
  }

  /**
   * Clear cached profile (useful for logout or switching users)
   */
  async clearProfile(): Promise<void> {
    this.cachedProfile = null;
    await LocalStorage.removeItem(USER_PROFILE_KEY);
  }

  /**
   * Get cached profile without making API calls
   */
  getCachedProfile(): UserProfile | null {
    return this.cachedProfile;
  }
}

// Singleton instance
let userProfileService: UserProfileService | null = null;

export function getUserProfileService(): UserProfileService {
  if (!userProfileService) {
    userProfileService = new UserProfileService();
  }
  return userProfileService;
}

/**
 * Convenience function to get the current user's display name
 */
export async function getCurrentUserDisplayName(organizationId?: number, userId?: number): Promise<string> {
  const service = getUserProfileService();
  
  // Try to load from cache first
  let profile = await service.loadCachedProfile();
  
  // If we have org ID, try to fetch fresh data (user ID is optional)
  if (organizationId && (!profile || profile.organizationId !== organizationId)) {
    profile = await service.getCurrentUserProfile(organizationId, userId);
  }
  
  return service.getDisplayName(profile);
}

/**
 * Convenience function to get the current user's first name
 */
export async function getCurrentUserFirstName(organizationId?: number, userId?: number): Promise<string> {
  const service = getUserProfileService();
  
  // Try to load from cache first
  let profile = await service.loadCachedProfile();
  
  // If we have org ID, try to fetch fresh data (user ID is optional)
  if (organizationId && (!profile || profile.organizationId !== organizationId)) {
    profile = await service.getCurrentUserProfile(organizationId, userId);
  }
  
  return service.getFirstName(profile);
} 