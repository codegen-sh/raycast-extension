import { showToast, Toast, showHUD, environment, LaunchType } from "@raycast/api";
import { AgentRunStatusChange, AgentRunStatus } from "../api/types";

export interface NotificationManager {
  notifyStatusChange(change: AgentRunStatusChange): Promise<void>;
  notifyAgentRunCreated(agentRunId: number, organizationId: number): Promise<void>;
}

class RaycastNotificationManager implements NotificationManager {
  async notifyStatusChange(change: AgentRunStatusChange): Promise<void> {
    const { agentRunId, oldStatus, newStatus, webUrl } = change;
    
    // Determine notification style based on status
    const { title, message, style, shouldNotify } = this.getStatusChangeNotification(
      agentRunId,
      oldStatus,
      newStatus
    );

    if (!shouldNotify) {
      console.log(`Skipping notification for agent run ${agentRunId}: ${oldStatus} -> ${newStatus}`);
      return;
    }

    try {
      // Use HUD for background notifications, Toast for foreground
      if (environment.launchType === LaunchType.Background) {
        await showHUD(title);
      } else {
        await showToast({
          style,
          title,
          message,
          primaryAction: {
            title: "View Run",
            onAction: () => {
              // This will open the web URL in the default browser
              // Note: We can't use Action.OpenInBrowser here since we're in a toast
              console.log(`Opening agent run: ${webUrl}`);
            },
          },
        });
      }

      console.log(`Notification sent for agent run ${agentRunId}: ${oldStatus} -> ${newStatus}`);
    } catch (error) {
      console.error(`Failed to send notification for agent run ${agentRunId}:`, error);
    }
  }

  async notifyAgentRunCreated(agentRunId: number, organizationId: number): Promise<void> {
    try {
      await showToast({
        style: Toast.Style.Success,
        title: "Agent Run Created",
        message: `Agent run #${agentRunId} has been started and is now being tracked`,
      });
    } catch (error) {
      console.error(`Failed to send creation notification for agent run ${agentRunId}:`, error);
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
          title: `✅ ${baseTitle} Completed`,
          message: "Your agent run has finished successfully",
          style: Toast.Style.Success,
          shouldNotify: true,
        };

      case AgentRunStatus.ERROR:
        return {
          title: `❌ ${baseTitle} Failed`,
          message: "Your agent run encountered an error",
          style: Toast.Style.Failure,
          shouldNotify: true,
        };

      case AgentRunStatus.CANCELLED:
        return {
          title: `🛑 ${baseTitle} Cancelled`,
          message: "Your agent run was cancelled",
          style: Toast.Style.Failure,
          shouldNotify: true,
        };

      case AgentRunStatus.TIMEOUT:
        return {
          title: `⏰ ${baseTitle} Timed Out`,
          message: "Your agent run exceeded the time limit",
          style: Toast.Style.Failure,
          shouldNotify: true,
        };

      case AgentRunStatus.MAX_ITERATIONS_REACHED:
        return {
          title: `🔄 ${baseTitle} Max Iterations`,
          message: "Your agent run reached the maximum number of iterations",
          style: Toast.Style.Failure,
          shouldNotify: true,
        };

      case AgentRunStatus.OUT_OF_TOKENS:
        return {
          title: `🪙 ${baseTitle} Out of Tokens`,
          message: "Your agent run ran out of tokens",
          style: Toast.Style.Failure,
          shouldNotify: true,
        };

      case AgentRunStatus.ACTIVE:
        // Only notify if transitioning from a non-active state (like resuming)
        if (oldStatus && oldStatus !== AgentRunStatus.ACTIVE) {
          return {
            title: `🚀 ${baseTitle} Active`,
            message: "Your agent run is now active",
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
          title: `📋 ${baseTitle} Status Changed`,
          message: `Status changed to ${newStatus}`,
          style: Toast.Style.Success,
          shouldNotify: true,
        };
    }
  }
}

// Singleton instance
let notificationManager: NotificationManager | null = null;

export function getNotificationManager(): NotificationManager {
  if (!notificationManager) {
    notificationManager = new RaycastNotificationManager();
  }
  return notificationManager;
}

