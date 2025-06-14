import React from "react";
import {
  Detail,
  ActionPanel,
  Action,
  Icon,
  openExtensionPreferences,
} from "@raycast/api";

interface WelcomeScreenProps {
  commandName?: string;
}

export function WelcomeScreen({ commandName }: WelcomeScreenProps) {
  const markdown = `
# Welcome to Codegen! 🚀

Before you can start using this command, you'll need to add your API token to get started.

## Quick Setup

1. **Get your API token** from [Codegen Settings](https://app.codegen.com/settings)
2. **Click "Open Extension Preferences"** below to configure your token
3. **Paste your API token** in the API Token field
4. **Come back and try again!** 

## What is Codegen?

Codegen is your AI-powered software engineering assistant that helps you:

- 🤖 **Create AI agent runs** with custom prompts
- 📊 **Monitor agent progress** and view results  
- 🏢 **Manage organizations** and switch between teams
- ⚡ **Streamline your workflow** directly from Raycast

## Need Help?

- 📖 [Documentation](https://docs.codegen.com)
- 💬 [Support](https://codegen.com/support)
- 🌐 [Website](https://codegen.com)

---

*Ready to supercharge your development workflow? Let's get you set up!*
`;

  return (
    <Detail
      markdown={markdown}
      navigationTitle="Welcome to Codegen"
      actions={
        <ActionPanel>
          <Action
            title="Open Extension Preferences"
            icon={Icon.Gear}
            onAction={openExtensionPreferences}
          />
          <Action.OpenInBrowser
            title="Get API Token"
            icon={Icon.Globe}
            url="https://app.codegen.com/settings"
          />
          <Action.OpenInBrowser
            title="View Documentation"
            icon={Icon.Book}
            url="https://docs.codegen.com"
          />
        </ActionPanel>
      }
    />
  );
}

