# Codegen Raycast Extension

A Raycast extension for managing AI agent runs with advanced filtering, real-time status monitoring, and native macOS notifications.

## Features

- **Create Agent Runs**: Start new AI agent runs with custom prompts
- **List & Filter Agent Runs**: View and filter your agent runs by status, date, and more
- **Real-time Monitoring**: Automatic background monitoring of agent run status changes
- **Native macOS Notifications**: Get clickable system notifications when agent runs complete
- **Organization Management**: Switch between different organizations

## Setup

### Prerequisites

1. **Install the Raycast Notification extension** for native macOS notifications:
   ```
   raycast://extensions/maxnyby/raycast-notification
   ```
   Or search for "Raycast Notification" in the Raycast Store.

2. **Configure your Codegen credentials** in the extension preferences:
   - API Token
   - Default Organization (optional)

### Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Run in development mode: `npm run dev`

## Usage

### Creating Agent Runs

1. Open Raycast and search for "Create Agent Run"
2. Select your organization
3. Enter your prompt
4. The agent run will be created and automatically tracked

### Viewing Agent Runs

1. Open Raycast and search for "Agent Runs"
2. Filter by status, search by keywords
3. Click on any run to view details or open in browser

### Notifications

The extension automatically monitors your agent runs and sends native macOS notifications when:
- An agent run completes successfully ✅
- An agent run fails or encounters an error ❌
- An agent run is cancelled or times out ⏰

Notifications are clickable and include a "View Agent Run" action to open the run in your browser.

## Development

```bash
npm install
npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and feature requests, please use the GitHub issue tracker or contact support through the Codegen platform.
