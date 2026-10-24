import { Schema, model, Types } from "mongoose";

const invitationSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    campaign: {
      type: Types.ObjectId,
      ref: "campaign",
      required: true,
      index: true,
    },
    workspace: {
      type: Types.ObjectId,
      ref: "workspace",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["PRODUCER", "EDITOR", "REVIEWER"],
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    invitedBy: {
      type: Types.ObjectId,
      ref: "user",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"],
      default: "PENDING",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  }
);

invitationSchema.index({ email: 1, campaign: 1 });

export const InvitationModel = model("invitation", invitationSchema);
