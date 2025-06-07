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
} from "@raycast/api";
import { getAPIClient } from "./api/client";
import { getAgentRunCache } from "./storage/agentRunCache";
import { validateCredentials, hasCredentials } from "./utils/credentials";
import { OrganizationResponse } from "./api/types";

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

  const preferences = getPreferenceValues<Preferences>();
  const apiClient = getAPIClient();
  const cache = getAgentRunCache();

  // Validate credentials and load organizations on mount
  useEffect(() => {
    async function initialize() {
      if (!hasCredentials()) {
        setValidationError("API token not configured. Please set it in extension preferences.");
        setIsLoadingOrgs(false);
        return;
      }

      try {
        const validation = await validateCredentials();
        if (!validation.isValid) {
          setValidationError(validation.error || "Invalid credentials");
          setIsLoadingOrgs(false);
          return;
        }

        if (validation.organizations) {
          setOrganizations(validation.organizations);
        }
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
        title: "Validation Error",
        message: "Prompt is required",
      });
      return;
    }

    if (!values.organizationId) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Validation Error", 
        message: "Organization is required",
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
            prompt += `\n\nClipboard content:\n${clipboardText}`;
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

      await showToast({
        style: Toast.Style.Success,
        title: "Agent Run Created",
        message: `Agent run #${agentRun.id} has been started`,
        primaryAction: {
          title: "View Run",
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
        title: "Failed to Create Agent Run",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (validationError) {
    return (
      <Form
        actions={
          <ActionPanel>
            <Action.OpenInBrowser
              title="Open Extension Preferences"
              url="raycast://extensions/codegen/codegen"
            />
          </ActionPanel>
        }
      >
        <Form.Description
          title="Authentication Error"
          text={validationError}
        />
      </Form>
    );
  }

  return (
    <Form
      isLoading={isLoading || isLoadingOrgs}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Create Agent Run"
            onSubmit={handleSubmit}
          />
          <Action.Paste
            title="Paste from Clipboard"
            target="prompt"
            shortcut={{ modifiers: ["cmd"], key: "v" }}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="organizationId"
        title="Organization"
        placeholder="Select an organization"
        defaultValue={preferences.defaultOrganization}
      >
        {organizations.map((org) => (
          <Form.Dropdown.Item
            key={org.id}
            value={org.id.toString()}
            title={org.name}
          />
        ))}
      </Form.Dropdown>

      <Form.TextArea
        id="prompt"
        title="Prompt"
        placeholder="Enter your prompt for the AI agent..."
        info="Describe what you want the AI agent to do. Be specific and clear."
      />

      <Form.Checkbox
        id="attachClipboard"
        title="Attach Clipboard"
        label="Include clipboard content with the prompt"
        info="If checked, the current clipboard content will be appended to your prompt"
      />

      <Form.Description
        title="Tips"
        text="• Be specific about what you want the agent to do
• Include relevant context in your prompt
• Use the clipboard attachment for code or text you want the agent to work with"
      />
    </Form>
  );
}

