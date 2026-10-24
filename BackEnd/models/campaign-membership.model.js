import { Schema, model, Types } from "mongoose";

const campaignMembershipSchema = new Schema(
  {
    campaign: {
      type: Types.ObjectId,
      ref: "campaign",
      required: [true, "Campaign reference is required"],
      index: true,
    },
    user: {
      type: Types.ObjectId,
      ref: "user",
      required: [true, "User reference is required"],
      index: true,
    },
    workspace: {
      type: Types.ObjectId,
      ref: "workspace",
      required: [true, "Workspace reference is required"],
      index: true,
    },
    role: {
      type: String,
      enum: ["PRODUCER", "EDITOR", "REVIEWER"],
      required: [true, "Role is required"],
    },
    invitationStatus: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "ACCEPTED",
    },
    invitedBy: {
      type: Types.ObjectId,
      ref: "user",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  }
);

// Enforce unique user per campaign
campaignMembershipSchema.index({ campaign: 1, user: 1 }, { unique: true });
campaignMembershipSchema.index({ campaign: 1, role: 1 });

export const CampaignMembershipModel = model(
  "campaign_membership",
  campaignMembershipSchema
);
