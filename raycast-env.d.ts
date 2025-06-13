/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** API Token - Your Codegen API token. Get it from https://app.codegen.com/settings */
  "apiToken": string,
  /** Default Organization ID - Default organization ID to use (optional) */
  "defaultOrganization"?: string,
  /** User ID - Your user ID for personalized features (optional) */
  "userId"?: string,
  /** API Base URL - Custom API base URL (leave empty for default) */
  "apiBaseUrl"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `create-agent-run` command */
  export type CreateAgentRun = ExtensionPreferences & {}
  /** Preferences accessible in the `list-agent-runs` command */
  export type ListAgentRuns = ExtensionPreferences & {}
  /** Preferences accessible in the `list-organizations` command */
  export type ListOrganizations = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `create-agent-run` command */
  export type CreateAgentRun = {}
  /** Arguments passed to the `list-agent-runs` command */
  export type ListAgentRuns = {}
  /** Arguments passed to the `list-organizations` command */
  export type ListOrganizations = {}
}

