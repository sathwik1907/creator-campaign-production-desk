import { Schema, model, Types } from "mongoose";

const sourceSectionSchema = new Schema(
  {
    sectionTitle: {
      type: String,
      default: "General",
      trim: true,
    },
    page: {
      type: Number,
      default: 1,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: true }
);

const briefSchema = new Schema(
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
      required: [true, "Brief title is required"],
      trim: true,
    },
    revisionNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    extractedText: {
      type: String,
      required: [true, "Extracted text is required"],
    },
    approvedNotes: {
      type: String,
      default: "",
    },
    sourceSections: {
      type: [sourceSectionSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUPERSEDED"],
      default: "ACTIVE",
      index: true,
    },
    uploadedBy: {
      type: Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  }
);

briefSchema.index({ campaign: 1, revisionNumber: 1 }, { unique: true });

export const BriefModel = model("brief", briefSchema);
