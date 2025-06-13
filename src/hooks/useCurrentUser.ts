import { useState, useEffect } from "react";
import { UserResponse } from "../api/types";
import { getCurrentUserInfo } from "../utils/credentials";
import { getUserDisplayName } from "../storage/userStorage";

export interface UseCurrentUserResult {
  userInfo: UserResponse | null;
  displayName: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get current user information
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [userInfo, setUserInfo] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserInfo = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const info = await getCurrentUserInfo();
      setUserInfo(info);
      
      if (!info) {
        setError("Failed to fetch user information");
      }
    } catch (err) {
      console.error("Error fetching user info:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const displayName = userInfo ? getUserDisplayName(userInfo) : null;

  return {
    userInfo,
    displayName,
    isLoading,
    error,
    refetch: fetchUserInfo,
  };
}
