# Codegen Raycast Extension

A powerful Raycast extension for interacting with the Codegen API. Create and manage AI agent runs directly from Raycast with advanced caching, filtering, and real-time updates.

## Features

### 🚀 **Core Functionality**
- **Create Agent Runs**: Launch AI agents with custom prompts
- **Monitor Progress**: Real-time status updates for active runs
- **View Results**: Detailed view of completed agent runs
- **Organization Management**: Switch between organizations seamlessly
- **Smart Notifications**: Automatic notifications when agent run status changes
- **Background Monitoring**: Continuous tracking of agent runs with 30-second intervals

### ⚡ **Performance & UX**
- **Smart Caching**: Instant loading with local cache and background sync
- **Advanced Filtering**: Filter by status, date range, organization, and keywords
- **Real-time Search**: Search through prompts and results instantly
- **Offline Support**: Browse cached agent runs without internet

### 🔐 **Security & Authentication**
- **Secure Token Storage**: API tokens stored securely in Raycast preferences
- **Credential Validation**: Automatic token validation with helpful error messages
- **Organization Context**: Seamless switching between organizations

## Setup

1. **Install the Extension**: Install from Raycast Store or import from source
2. **Configure API Token**: 
   - Open Raycast Preferences → Extensions → Codegen
   - Enter your API token from [Codegen Settings](https://app.codegen.com/settings)
3. **Set Default Organization** (Optional):
   - Use the "Organizations" command to set a default organization
   - Or enter the organization ID in extension preferences

## Commands

### 📝 **Create Agent Run**
- **Command**: `Create Agent Run`
- **Description**: Create a new AI agent run with a custom prompt
- **Features**:
  - Organization selection
  - Clipboard content attachment
  - Form validation and error handling
  - Automatic caching of created runs

### 📋 **Agent Runs**
- **Command**: `Agent Runs`
- **Description**: View and manage your agent runs
- **Features**:
  - Real-time status updates
  - Advanced filtering (status, date, search)
  - Stop/resume actions for active runs
  - Quick access to web view
  - Background polling for active runs

### 🏢 **Organizations**
- **Command**: `Organizations`
- **Description**: View and manage your organizations
- **Features**:
  - Set default organization
  - View organization settings
  - Copy organization details

### 🔔 **Monitor Agent Runs** (Background)
- **Command**: `Monitor Agent Runs`
- **Description**: Background monitoring for agent run status changes
- **Features**:
  - Automatic status change detection
  - Smart notifications (Toast/HUD based on context)
  - Cleanup of completed runs after 24 hours
  - Runs every 30 seconds in the background

## Keyboard Shortcuts

- **⌘ + Enter**: Submit forms / Execute primary action
- **⌘ + R**: Refresh data
- **⌘ + C**: Copy to clipboard
- **⌘ + S**: Stop agent run (when applicable)
- **⌘ + D**: Set/clear default organization

## Configuration

### Extension Preferences

- **API Token** (Required): Your Codegen API token
- **Default Organization ID** (Optional): Default organization for new runs
- **API Base URL** (Optional): Custom API endpoint (defaults to https://api.codegen.com)

### Local Storage

The extension uses Raycast's secure storage for:
- **Cache**: Agent run data with LRU eviction
- **Preferences**: User settings and default organization
- **Sync Status**: Background sync state and error tracking

## Architecture

### 🏗️ **Core Components**
- **API Client**: Robust HTTP client with error handling and rate limiting
- **Cache System**: Smart caching with background sync and conflict resolution
- **Filtering Engine**: Real-time filtering and search capabilities
- **Credentials Manager**: Secure token storage and validation

### 📊 **Data Flow**
1. **Cache First**: Load data instantly from local cache
2. **Background Sync**: Update cache with fresh API data
3. **Real-time Updates**: Poll active runs for status changes
4. **Conflict Resolution**: Merge local and remote changes intelligently

### 🔄 **Sync Strategy**
- **Initial Load**: Cache → Background API sync
- **Active Runs**: 30-second polling for status updates
- **Manual Refresh**: Force sync with success/error feedback
- **Offline Mode**: Full functionality with cached data

## Development

### Prerequisites
- Node.js 22.14+
- npm 7+
- Raycast 1.26.0+

### Setup
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
npm run fix-lint
```

## API Integration

This extension integrates with the Codegen API endpoints:

- `POST /v1/organizations/{org_id}/agent/run` - Create agent run
- `GET /v1/organizations/{org_id}/agent/run/{run_id}` - Get agent run status
- `POST /v1/beta/organizations/{org_id}/agent/run/resume` - Resume agent run
- `POST /v1/beta/organizations/{org_id}/agent/run/stop` - Stop agent run
- `GET /v1/organizations` - List organizations
- `GET /v1/organizations/{org_id}/users` - List users

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and feature requests, please use the GitHub issue tracker or contact support through the Codegen platform.
