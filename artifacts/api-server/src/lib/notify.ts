/**
 * Smart notification helper — call from any route to create a notification.
 * Non-fatal: errors are logged but never thrown.
 */
import { db } from "@workspace/db";
import { smartNotificationsTable } from "@workspace/db";

export type NotificationPriority = "critical" | "important" | "informational" | "suggestion";

export interface NotificationInput {
  userType: "customer" | "business";
  recipientEmail?: string;
  restaurantId?: number;
  type: string;
  priority?: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    await db.insert(smartNotificationsTable).values({
      userType: input.userType,
      recipientEmail: input.recipientEmail ?? null,
      restaurantId: input.restaurantId ?? null,
      type: input.type,
      priority: input.priority ?? "informational",
      title: input.title,
      message: input.message,
      isRead: false,
      link: input.link ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (e) {
    console.error("[notify] Failed to create notification:", e);
  }
}
