import { LaunchType, environment, showHUD } from "@raycast/api";
import { getAgentRunCache } from "./storage/agentRunCache";
import { getNotificationManager } from "./utils/notifications";

export default async function MonitorAgentRuns() {
  // This command is designed to run in the background
  if (environment.launchType !== LaunchType.Background) {
    await showHUD("This command is designed to run in the background");
    return;
  }

  console.log("Starting agent run monitoring...");

  try {
    const cache = getAgentRunCache();
    const notificationManager = getNotificationManager();

    // Get all organizations with tracked runs
    const trackedOrganizations = await cache.getTrackedOrganizations();
    
    if (trackedOrganizations.length === 0) {
      console.log("No organizations with tracked runs found");
      return;
    }

    console.log(`Monitoring ${trackedOrganizations.length} organizations for status changes`);

    // Check each organization for status changes
    for (const organizationId of trackedOrganizations) {
      try {
        console.log(`Checking status changes for organization ${organizationId}`);
        
        const statusChanges = await cache.checkForStatusChanges(organizationId);
        
        if (statusChanges.length > 0) {
          console.log(`Found ${statusChanges.length} status changes for org ${organizationId}`);
          
          // Send notifications for each status change
          for (const change of statusChanges) {
            await notificationManager.notifyStatusChange(change);
          }
        } else {
          console.log(`No status changes found for org ${organizationId}`);
        }

        // Cleanup completed runs (optional, runs once per check)
        await cache.cleanupCompletedRuns(organizationId);
        
      } catch (error) {
        console.error(`Error monitoring organization ${organizationId}:`, error);
        // Continue with other organizations even if one fails
      }
    }

    console.log("Agent run monitoring completed");

  } catch (error) {
    console.error("Error in agent run monitoring:", error);
    // Don't show error to user in background mode, just log it
  }
}

