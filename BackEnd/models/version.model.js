import { Schema, model, Types } from "mongoose";

const versionSchema = new Schema(
  {
    campaign: {
      type: Types.ObjectId,
      ref: "campaign",
      required: [true, "Campaign reference is required"],
      index: true,
    },
    workspace: {
      type: Types.ObjectId,
      ref: "workspace",
      required: [true, "Workspace reference is required"],
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    title: {
      type: String,
      required: [true, "Version title is required"],
      trim: true,
    },
    scriptContent: {
      type: String,
      required: [true, "Script content is required"],
    },
    videoAssetUrl: {
      type: String,
      default: "",
    },
    changelog: {
      type: String,
      default: "Initial draft",
    },
    submissionStatus: {
      type: String,
      enum: [
        "DRAFT",
        "SUBMITTED",
        "IN_REVIEW",
        "APPROVED",
        "REVISION_REQUESTED",
        "REJECTED",
      ],
      default: "DRAFT",
      index: true,
    },
    author: {
      type: Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    briefRevision: {
      type: Types.ObjectId,
      ref: "brief",
      required: true,
    },
    assetReferences: [
      {
        type: Types.ObjectId,
        ref: "asset",
      },
    ],
    decisions: [
      {
        type: Types.ObjectId,
        ref: "decision",
      },
    ],
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  }
);

versionSchema.index({ campaign: 1, versionNumber: 1 }, { unique: true });

export const VersionModel = model("version", versionSchema);
