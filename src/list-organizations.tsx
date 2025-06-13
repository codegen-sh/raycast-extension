// Load environment variables first
try {
  require('dotenv').config();
} catch (error) {
  console.log("dotenv loading error:", error);
}

import { useState, useEffect } from "react";
import {
  List,
  ActionPanel,
  Action,
  Icon,
  showToast,
  Toast,
  LocalStorage,
} from "@raycast/api";
import { getAPIClient } from "./api/client";
import { validateCredentials, hasCredentials } from "./utils/credentials";
import { OrganizationResponse } from "./api/types";
import { useCurrentUser } from "./hooks/useCurrentUser";

// Type for organizations from validation (simplified structure)
type BasicOrganization = {
  id: number;
  name: string;
};

export default function ListOrganizations() {
  const [organizations, setOrganizations] = useState<BasicOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultOrgId, setDefaultOrgId] = useState<number | null>(null);

  const apiClient = getAPIClient();
  const { displayName: userDisplayName } = useCurrentUser();

  // Load organizations and default org preference
  useEffect(() => {
    async function loadData() {
      if (!hasCredentials()) {
        setError("API token not configured. Please set it in extension preferences.");
        setIsLoading(false);
        return;
      }

      try {
        // Validate credentials and get organizations
        const validation = await validateCredentials();
        if (!validation.isValid) {
          setError(validation.error || "Invalid credentials");
          setIsLoading(false);
          return;
        }

        if (validation.organizations) {
          setOrganizations(validation.organizations);
        }

        // Load default organization preference
        const defaultOrg = await LocalStorage.getItem<string>("defaultOrganizationId");
        if (defaultOrg) {
          setDefaultOrgId(parseInt(defaultOrg, 10));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load organizations");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Set default organization
  const setDefaultOrganization = async (orgId: number) => {
    try {
      const selectedOrg = organizations.find(org => org.id === orgId);
      
      // Store both the ID and the full organization data
      await LocalStorage.setItem("defaultOrganizationId", orgId.toString());
      if (selectedOrg) {
        await LocalStorage.setItem("defaultOrganization", JSON.stringify(selectedOrg));
      }
      
      setDefaultOrgId(orgId);
      
      await showToast({
        style: Toast.Style.Success,
        title: "Default Organization Set",
        message: `${selectedOrg?.name || 'Organization'} will be used as default for new agent runs`,
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Set Default",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Clear default organization
  const clearDefaultOrganization = async () => {
    try {
      await LocalStorage.removeItem("defaultOrganizationId");
      await LocalStorage.removeItem("defaultOrganization");
      setDefaultOrgId(null);
      
      await showToast({
        style: Toast.Style.Success,
        title: "Default Organization Cleared",
        message: "No default organization is set",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Clear Default",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Refresh organizations
  const refresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const validation = await validateCredentials();
      if (validation.isValid && validation.organizations) {
        setOrganizations(validation.organizations);
      } else {
        setError(validation.error || "Failed to load organizations");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh organizations");
    } finally {
      setIsLoading(false);
    }
  };

  if (error && !isLoading) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Error Loading Organizations"
          description={error}
          actions={
            <ActionPanel>
              <Action title="Retry" onAction={refresh} />
              <Action.OpenInBrowser
                title="Open Extension Preferences"
                url="raycast://extensions/codegen/codegen"
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  const navigationTitle = userDisplayName ? `Organizations - ${userDisplayName}` : "Organizations";

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder="Search organizations..."
      navigationTitle={navigationTitle}
    >
      {organizations.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.Building}
          title="No Organizations Found"
          description="You don't have access to any organizations"
          actions={
            <ActionPanel>
              <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={refresh} />
            </ActionPanel>
          }
        />
      ) : (
        organizations.map((org) => {
          const isDefault = defaultOrgId === org.id;
          
          return (
            <List.Item
              key={org.id}
              title={org.name}
              subtitle={`Organization ID: ${org.id}`}
              icon={isDefault ? { source: Icon.Star, tintColor: "#FFD700" } : Icon.Building}
              accessories={[
                ...(isDefault ? [{ text: "Default", icon: Icon.Star }] : []),
              ]}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    {!isDefault ? (
                      <Action
                        title="Set as Default"
                        icon={Icon.Star}
                        onAction={() => setDefaultOrganization(org.id)}
                        shortcut={{ modifiers: ["cmd"], key: "d" }}
                      />
                    ) : (
                      <Action
                        title="Clear Default"
                        icon={Icon.StarDisabled}
                        onAction={clearDefaultOrganization}
                        shortcut={{ modifiers: ["cmd"], key: "d" }}
                      />
                    )}
                  </ActionPanel.Section>

                  <ActionPanel.Section>
                    <Action.CopyToClipboard
                      title="Copy Organization ID"
                      content={org.id.toString()}
                      shortcut={{ modifiers: ["cmd"], key: "c" }}
                    />
                    <Action.CopyToClipboard
                      title="Copy Organization Name"
                      content={org.name}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                    />
                  </ActionPanel.Section>

                  <ActionPanel.Section>
                    <Action
                      title="Refresh"
                      icon={Icon.ArrowClockwise}
                      onAction={refresh}
                      shortcut={{ modifiers: ["cmd"], key: "r" }}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
