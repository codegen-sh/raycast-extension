import { showToast, Toast, showHUD } from "@raycast/api";
import { AgentRunStatusChange, AgentRunStatus } from "../api/types";

export interface NotificationManager {
  notifyStatusChange(change: AgentRunStatusChange): Promise<void>;
  notifyAgentRunCreated(agentRunId: number, organizationId: number): Promise<void>;
  initialize(): Promise<void>;
  testNotification(): Promise<void>;
}

class RaycastNotificationManager implements NotificationManager {
  private isInitialized = false;

  /**
   * Initialize the notification system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("Notification system already initialized");
      return;
    }

    this.isInitialized = true;
    console.log("Notification system initialized successfully");
  }

  async notifyStatusChange(change: AgentRunStatusChange): Promise<void> {
    const { agentRunId, oldStatus, newStatus, webUrl } = change;
    
    console.log(`Processing status change notification for agent run ${agentRunId}: ${oldStatus} -> ${newStatus}`);
    
    // Determine notification style based on status
    const { title, message, style, shouldNotify } = this.getStatusChangeNotification(
      agentRunId,
      oldStatus,
      newStatus
    );

    if (!shouldNotify) {
      console.log(`Skipping notification for agent run ${agentRunId}: ${oldStatus} -> ${newStatus} (shouldNotify=false)`);
      return;
    }

    console.log(`Sending notification for agent run ${agentRunId}: "${title}"`);

    try {
      await showToast({
        style,
        title,
        message,
        ...(webUrl && {
          primaryAction: {
            title: "View Run",
            onAction: () => {
              // We could implement opening the web URL here if needed
              console.log(`Would open: ${webUrl}`);
            }
          }
        })
      });
      
      console.log(`✅ Toast notification sent successfully for agent run ${agentRunId}: ${oldStatus} -> ${newStatus}`);
      
    } catch (error) {
      console.error(`❌ Failed to send toast notification for agent run ${agentRunId}:`, error);
      
      // Fallback to HUD notification
      try {
        await showHUD(title);
        console.log(`✅ HUD fallback notification sent for agent run ${agentRunId}`);
      } catch (hudError) {
        console.error(`❌ Failed to send HUD notification for agent run ${agentRunId}:`, hudError);
      }
    }
  }

  async notifyAgentRunCreated(agentRunId: number, organizationId: number): Promise<void> {
    try {
      await showToast({
        style: Toast.Style.Success,
        title: `Agent Run #${agentRunId} • Started`,
        message: "🚀 Your agent run has been created and is now being tracked"
      });
      console.log(`✅ Creation notification sent for agent run ${agentRunId}`);
    } catch (error) {
      console.error(`❌ Failed to send creation notification for agent run ${agentRunId}:`, error);
      
      // Fallback to HUD
      try {
        await showHUD(`🚀 Agent run #${agentRunId} started`);
      } catch (hudError) {
        console.error(`❌ Failed to send HUD creation notification:`, hudError);
      }
    }
  }

  private getStatusChangeNotification(
    agentRunId: number,
    oldStatus: string | null,
    newStatus: string
  ): {
    title: string;
    message: string;
    style: Toast.Style;
    shouldNotify: boolean;
  } {
    // Don't notify for initial status setting or certain transitions
    if (!oldStatus || oldStatus === newStatus) {
      return {
        title: "",
        message: "",
        style: Toast.Style.Success,
        shouldNotify: false,
      };
    }

    // Don't notify for intermediate states that users don't care about
    if (newStatus === AgentRunStatus.EVALUATION) {
      return {
        title: "",
        message: "",
        style: Toast.Style.Success,
        shouldNotify: false,
      };
    }

    const baseTitle = `Agent Run #${agentRunId}`;
    
    switch (newStatus) {
      case AgentRunStatus.COMPLETE:
        return {
          title: `${baseTitle} • Complete`,
          message: "✅ Your agent run has finished successfully",
          style: Toast.Style.Success,
          shouldNotify: true,
        };

      case AgentRunStatus.ERROR:
        return {
          title: `${baseTitle} • Failed`,
          message: "❌ Your agent run encountered an error",
          style: Toast.Style.Failure,
          shouldNotify: true,
        };

      case AgentRunStatus.CANCELLED:
        return {
          title: `${baseTitle} • Cancelled`,
          message: "🛑 Your agent run was cancelled",
          style: Toast.Style.Failure,
          shouldNotify: true,
        };

      case AgentRunStatus.TIMEOUT:
        return {
          title: `${baseTitle} • Timed Out`,
          message: "⏰ Your agent run exceeded the time limit",
          style: Toast.Style.Failure,
          shouldNotify: true,
        };

      case AgentRunStatus.MAX_ITERATIONS_REACHED:
        return {
          title: `${baseTitle} • Max Iterations`,
          message: "🔄 Your agent run reached the maximum number of iterations",
          style: Toast.Style.Failure,
          shouldNotify: true,
        };

      case AgentRunStatus.OUT_OF_TOKENS:
        return {
          title: `${baseTitle} • Out of Tokens`,
          message: "🪙 Your agent run ran out of tokens",
          style: Toast.Style.Failure,
          shouldNotify: true,
        };

      case AgentRunStatus.ACTIVE:
        // Only notify if transitioning from a non-active state (like resuming)
        if (oldStatus && oldStatus !== AgentRunStatus.ACTIVE) {
          return {
            title: `${baseTitle} • Active`,
            message: "🚀 Your agent run is now active",
            style: Toast.Style.Success,
            shouldNotify: true,
          };
        }
        return {
          title: "",
          message: "",
          style: Toast.Style.Success,
          shouldNotify: false,
        };

      default:
        return {
          title: `${baseTitle} • Status Changed`,
          message: `📋 Status changed to ${newStatus}`,
          style: Toast.Style.Success,
          shouldNotify: true,
        };
    }
  }

  /**
   * Test method - can be called manually for debugging
   */
  async testNotification(): Promise<void> {
    console.log("🧪 Testing notification system...");
    
    try {
      await showToast({
        style: Toast.Style.Success,
        title: "🧪 Test Notification",
        message: "This is a test notification from Codegen"
      });
      console.log("✅ Test notification sent successfully");
    } catch (error) {
      console.warn("❌ Test notification failed, trying HUD fallback:", error);
      try {
        await showHUD("🧪 Test notification (HUD fallback)");
        console.log("✅ HUD test notification sent");
      } catch (hudError) {
        console.error("❌ Both notification methods failed:", hudError);
      }
    }
  }
}

// Singleton instance
let notificationManager: NotificationManager | null = null;

export function getNotificationManager(): NotificationManager {
  if (!notificationManager) {
    notificationManager = new RaycastNotificationManager();
    // Initialize immediately
    notificationManager.initialize();
  }
  return notificationManager;
}

// Global test function for easy debugging
export async function testNotifications(): Promise<void> {
  const manager = getNotificationManager();
  await manager.testNotification();
}