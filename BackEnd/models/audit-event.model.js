import { Schema, model, Types } from "mongoose";

const auditEventSchema = new Schema(
  {
    actor: {
      type: Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
    },
    resourceId: {
      type: Types.ObjectId,
      default: null,
    },
    campaign: {
      type: Types.ObjectId,
      ref: "campaign",
      default: null,
      index: true,
    },
    workspace: {
      type: Types.ObjectId,
      ref: "workspace",
      default: null,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    strict: "throw",
  }
);

auditEventSchema.index({ campaign: 1, timestamp: -1 });

export const AuditEventModel = model("audit_event", auditEventSchema);
