import { useState, useEffect } from "react";
import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  useNavigation,
  getPreferenceValues,
  Clipboard,
  Icon,
  Color,
  LocalStorage,
} from "@raycast/api";
import { getCurrentUserFirstName } from "./utils/userProfile";
import { getAPIClient } from "./api/client";
import { getAgentRunCache } from "./storage/agentRunCache";
import { validateCredentials, hasCredentials, getCredentials } from "./utils/credentials";
import { OrganizationResponse } from "./api/types";
import { useCachedAgentRuns } from "./hooks/useCachedAgentRuns";
import { getBackgroundMonitoringService } from "./utils/backgroundMonitoring";
import { useCurrentUser } from "./hooks/useCurrentUser";
import AboutCommand from "./about";

interface FormValues {
  prompt: string;
  organizationId: string;
  attachClipboard: boolean;
}

interface Preferences {
  defaultOrganization?: string;
}

export default function CreateAgentRun() {
  const { pop } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationResponse[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [userFirstName, setUserFirstName] = useState<string>("User");
  const [defaultOrgId, setDefaultOrgId] = useState<string | null>(null);
  const { refresh } = useCachedAgentRuns();

  const preferences = getPreferenceValues<Preferences>();
  const apiClient = getAPIClient();
  const cache = getAgentRunCache();
  const backgroundMonitoring = getBackgroundMonitoringService();
  const { userInfo } = useCurrentUser();

  // Create welcome message using full name or GitHub username
  const getWelcomeMessage = () => {
    if (!userInfo) return "Welcome! 👋";
    
    const name = userInfo.full_name || 
                 (userInfo.github_username ? userInfo.github_username : null) ||
                 "there";
    
    return `Welcome, ${name}! 👋`;
  };

  // Validate credentials and load organizations on mount
  useEffect(() => {
    async function initialize() {
      if (!hasCredentials()) {
        setValidationError("API token not configured. Please set it in extension preferences.");
        setIsLoadingOrgs(false);
        return;
      }

      try {
        // Load cached organizations and default from local storage
        const cachedDefaultOrgId = await LocalStorage.getItem<string>("defaultOrganizationId");
        const cachedDefaultOrg = await LocalStorage.getItem<string>("defaultOrganization");
        
        if (cachedDefaultOrgId) {
          setDefaultOrgId(cachedDefaultOrgId);
        }
        
        // Use cached default organization if available
        if (cachedDefaultOrg) {
          try {
            const defaultOrg: OrganizationResponse = JSON.parse(cachedDefaultOrg);
            if (defaultOrg.id && defaultOrg.name && defaultOrg.settings) {
              setOrganizations([defaultOrg]);
            }
          } catch (parseError) {
            console.log("Could not parse cached default organization:", parseError);
          }
        }

        // Just validate credentials without fetching orgs (we have them cached)
        const validation = await validateCredentials();
        if (!validation.isValid) {
          setValidationError(validation.error || "Invalid credentials");
          setIsLoadingOrgs(false);
          return;
        }
          
        // TODO: Re-enable user profile fetching later
        // Try to get user's first name for personalization
        // try {
        //   const credentials = getCredentials();
        //   const firstOrgId = validation.organizations[0]?.id;
        //   const userId = credentials.userId ? parseInt(credentials.userId, 10) : undefined;
        //   
        //   if (firstOrgId) {
        //     const firstName = await getCurrentUserFirstName(firstOrgId, userId);
        //     setUserFirstName(firstName);
        //   }
        // } catch (error) {
        //   console.log("Could not fetch user name:", error);
        //   // Keep default "User" name
        // }
      } catch (error) {
        setValidationError(error instanceof Error ? error.message : "Failed to validate credentials");
      } finally {
        setIsLoadingOrgs(false);
      }
    }

    initialize();
  }, []);

  async function handleSubmit(values: FormValues) {
    if (!values.prompt.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Let me know what to build",
        message: "I need a description of what you want me to create",
      });
      return;
    }

    if (!values.organizationId) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Choose an organization", 
        message: "I need to know which organization to create this in",
      });
      return;
    }

    setIsLoading(true);

    try {
      const organizationId = parseInt(values.organizationId, 10);
      let prompt = values.prompt.trim();

      // Attach clipboard content if requested
      if (values.attachClipboard) {
        try {
          const clipboardText = await Clipboard.readText();
          if (clipboardText && clipboardText.trim()) {
            prompt += `\n\n--- Additional Context ---\n${clipboardText}`;
          }
        } catch (error) {
          console.warn("Failed to read clipboard:", error);
        }
      }

      // Create the agent run
      const agentRun = await apiClient.createAgentRun(organizationId, {
        prompt,
      });

      // Cache the new agent run
      await cache.updateAgentRun(organizationId, agentRun);

      // Add to tracking for notifications
      await cache.addToTracking(organizationId, agentRun);

      // Start background monitoring if not already running
      if (!backgroundMonitoring.isMonitoring()) {
        backgroundMonitoring.start();
      }

      // Refresh the list view to show the new run
      await refresh();

      await showToast({
        style: Toast.Style.Success,
        title: "Got it! I'm on it",
        message: `Starting agent run #${agentRun.id} - I'll let you know when it's done`,
        primaryAction: {
          title: "View Progress",
          onAction: () => {
            // Navigate to agent run details
            // This would be implemented when we create the details view
          },
        },
      });

      pop();
    } catch (error) {
      console.error("Failed to create agent run:", error);
      
      await showToast({
        style: Toast.Style.Failure,
        title: "Oops, something went wrong",
        message: error instanceof Error ? error.message : "Let's try that again",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (validationError) {
    return (
      <Form
        navigationTitle="Let's get you set up"
        actions={
          <ActionPanel>
            <Action.OpenInBrowser
              title="Configure API Token"
              url="raycast://extensions/codegen/codegen"
              icon={Icon.Gear}
            />
          </ActionPanel>
        }
      >
        <Form.Description
          title=""
          text="I need your API token to get started. Once you add it, we can build some amazing things together!"
        />
        <Form.Description
          title=""
          text={validationError}
        />
      </Form>
    );
  }

  return (
    <Form
      navigationTitle="What are we building today?"
      isLoading={isLoading || isLoadingOrgs}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Let's Build This"
            icon={Icon.Rocket}
            onSubmit={handleSubmit}
          />
          <Action
            title="Add from Clipboard"
            icon={Icon.Clipboard}
            shortcut={{ modifiers: ["cmd"], key: "v" }}
            onAction={async () => {
              try {
                const clipboardText = await Clipboard.readText();
                if (clipboardText && clipboardText.trim()) {
                  // This would update the form field if there was a way to do so
                  // For now, users can manually paste
                  await showToast({
                    style: Toast.Style.Success,
                    title: "Clipboard Content Available",
                    message: "You can paste this content into the prompt field",
                  });
                }
              } catch (error) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Clipboard Access Failed",
                  message: "Could not read clipboard content",
                });
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title=""
        text={getWelcomeMessage()}
      />
      
      <Form.TextArea
        id="prompt"
        title=""
        placeholder="What are we building today?"
      />

      <Form.Checkbox
        id="attachClipboard"
        title=""
        label="Include what's on my clipboard for context"
      />


      <Form.Dropdown
        id="organizationId"
        placeholder="Choose org"
        defaultValue={defaultOrgId || preferences.defaultOrganization}
        storeValue={true}
      >
        {organizations.map((org) => (
          <Form.Dropdown.Item
            key={org.id}
            value={org.id.toString()}
            title={org.name}
          />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
