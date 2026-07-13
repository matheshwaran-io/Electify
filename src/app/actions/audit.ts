"use server";

import db from "@/lib/db";
import { getSession } from "@/lib/auth";

export interface ActionResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Fetch all system audit logs (Super Admin Only)
 */
export async function getAuditLogs(): Promise<ActionResponse> {
  try {
    const session = await getSession();

    if (!session || session.role !== "SUPER_ADMIN") {
      return { success: false, error: "Unauthorized access. Super Admin credentials required." };
    }

    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200, // Limit to recent 200 logs
    });

    const serializedLogs = logs.map(log => ({
      id: log.id,
      action: log.action,
      userId: log.userId,
      userEmail: log.userEmail,
      ipAddress: log.ipAddress,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString()
    }));

    return { success: true, data: serializedLogs };
  } catch (error) {
    console.error("Get audit logs error:", error);
    return { success: false, error: "Failed to fetch audit log entries." };
  }
}
