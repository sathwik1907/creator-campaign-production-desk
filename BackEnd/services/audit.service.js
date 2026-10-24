import { AuditEventModel } from "../models/audit-event.model.js";

/**
 * Records an immutable audit event for security and campaign operations.
 */
export async function logAuditEvent({
  actor,
  action,
  resourceType,
  resourceId = null,
  campaign = null,
  workspace = null,
  details = {},
}) {
  try {
    const event = await AuditEventModel.create({
      actor,
      action,
      resourceType,
      resourceId,
      campaign,
      workspace,
      details,
      timestamp: new Date(),
    });
    return event;
  } catch (error) {
    // Audit logging should not crash the primary flow, but record error to console
    console.error("Failed to record audit event:", error.message);
    return null;
  }
}
