import { Detail } from "@raycast/api";

export default function AboutCommand() {
  const markdown = `
# About Codegen Extension

Welcome to the Codegen Raycast Extension! This extension helps you interact with Codegen's AI assistant directly from Raycast.

## Features

🚀 **Create Agent Runs** - Launch new AI agent runs with custom prompts
📋 **Manage Agent Runs** - View, monitor, and manage your agent runs with advanced filtering
🏢 **Organization Management** - Switch between organizations and manage settings
🔄 **Real-time Updates** - Get notifications when your agent runs complete
📊 **Background Monitoring** - Automatic monitoring of agent run progress

## Getting Started

1. **Get your API Token** - Visit [app.codegen.com/settings](https://app.codegen.com/settings) to get your API token
2. **Configure the Extension** - Add your API token in the extension preferences
3. **Create Your First Agent Run** - Use the "Create Agent Run" command to get started

## Commands

- **Create Agent Run** - Start a new AI agent with a custom prompt
- **Agent Runs** - View and manage all your agent runs
- **Organizations** - Switch between your organizations

## Support

Need help? Here are some resources:

- 📖 [Documentation](https://docs.codegen.com)
- 💬 [Discord Community](https://discord.gg/codegen)
- 🐛 [Report Issues](https://github.com/codegen-sh/raycast-extension/issues)
- 📧 [Contact Support](mailto:support@codegen.com)

## About Codegen

Codegen is an AI-powered development platform that helps teams build software faster and more efficiently. Our AI agents can help with coding, debugging, documentation, and much more.

Visit [codegen.com](https://codegen.com) to learn more.
  `;

  return (
    <Detail
      markdown={markdown}
      navigationTitle="About Codegen Extension"
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Extension Version" text="1.0.0" />
          <Detail.Metadata.Label title="Author" text="Codegen" />
          <Detail.Metadata.Label title="License" text="MIT" />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Link 
            title="Website" 
            target="https://codegen.com" 
            text="codegen.com" 
          />
          <Detail.Metadata.Link 
            title="Documentation" 
            target="https://docs.codegen.com" 
            text="docs.codegen.com" 
          />
          <Detail.Metadata.Link 
            title="GitHub" 
            target="https://github.com/codegen-sh/raycast-extension" 
            text="raycast-extension" 
          />
        </Detail.Metadata>
      }
    />
  );
}
