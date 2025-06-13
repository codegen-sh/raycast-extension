import { getAgentRunCache } from "../storage/agentRunCache";
import { getNotificationManager } from "./notifications";

class BackgroundMonitoringService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly MONITORING_INTERVAL = 30000; // 30 seconds

  /**
   * Start background monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Background monitoring is already running");
      return;
    }

    console.log("Starting background agent run monitoring...");
    this.isRunning = true;

    // Initialize notification manager
    const notificationManager = getNotificationManager();
    await notificationManager.initialize();

    // Run immediately
    this.checkForStatusChanges();

    // Then run every 30 seconds
    this.intervalId = setInterval(() => {
      this.checkForStatusChanges();
    }, this.MONITORING_INTERVAL);
  }

  /**
   * Stop background monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("Background monitoring stopped");
  }

  /**
   * Check for status changes across all tracked organizations
   */
  private async checkForStatusChanges(): Promise<void> {
    try {
      const cache = getAgentRunCache();
      const notificationManager = getNotificationManager();

      // Get all organizations with tracked runs
      const trackedOrganizations = await cache.getTrackedOrganizations();
      
      if (trackedOrganizations.length === 0) {
        return; // No organizations to monitor
      }

      console.log(`Monitoring ${trackedOrganizations.length} organizations for status changes`);

      // Check each organization for status changes
      for (const organizationId of trackedOrganizations) {
        try {
          const statusChanges = await cache.checkForStatusChanges(organizationId);
          
          if (statusChanges.length > 0) {
            console.log(`Found ${statusChanges.length} status changes for org ${organizationId}`);
            
            // Send notifications for each status change
            for (const change of statusChanges) {
              await notificationManager.notifyStatusChange(change);
            }
          }

          // Cleanup completed runs (optional, runs once per check)
          await cache.cleanupCompletedRuns(organizationId);
          
        } catch (error) {
          console.error(`Error monitoring organization ${organizationId}:`, error);
          // Continue with other organizations even if one fails
        }
      }

    } catch (error) {
      console.error("Error in background monitoring:", error);
    }
  }

  /**
   * Get monitoring status
   */
  isMonitoring(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
let backgroundMonitoringService: BackgroundMonitoringService | null = null;

export function getBackgroundMonitoringService(): BackgroundMonitoringService {
  if (!backgroundMonitoringService) {
    backgroundMonitoringService = new BackgroundMonitoringService();
  }
  return backgroundMonitoringService;
} 