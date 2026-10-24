import { Schema, model, Types } from "mongoose";

const usageRightsSchema = new Schema(
  {
    owner: {
      type: String,
      default: "Client",
      trim: true,
    },
    licenseStartDate: {
      type: Date,
      default: Date.now,
    },
    licenseEndDate: {
      type: Date,
      default: null,
    },
    allowedChannels: {
      type: [String],
      default: ["YouTube", "Podcast", "Social Media"],
    },
    restrictions: {
      type: String,
      default: "None specified",
    },
    requiredAttribution: {
      type: String,
      default: "",
    },
    isExpired: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { _id: false }
);

const assetSchema = new Schema(
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
    title: {
      type: String,
      required: [true, "Asset title is required"],
      trim: true,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    assetType: {
      type: String,
      enum: ["VIDEO", "AUDIO", "IMAGE", "SCRIPT", "DOCUMENT"],
      required: [true, "Asset type is required"],
      index: true,
    },
    caption: {
      type: String,
      default: "",
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    usageRights: {
      type: usageRightsSchema,
      default: () => ({}),
    },
    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "APPROVED",
      index: true,
    },
    uploadedBy: {
      type: Types.ObjectId,
      ref: "user",
      required: true,
    },
    embedding: {
      type: [Number],
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  }
);

assetSchema.index({ campaign: 1, assetType: 1 });
assetSchema.index({ campaign: 1, "usageRights.licenseEndDate": 1 });

export const AssetModel = model("asset", assetSchema);
