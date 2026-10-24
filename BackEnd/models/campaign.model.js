import { Schema, model, Types } from "mongoose";

const deliverableSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    format: {
      type: String,
      default: "Video (16:9)",
      trim: true,
    },
    requirements: {
      type: String,
      default: "",
    },
    sponsorTextRequired: {
      type: String,
      default: "",
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    missingDetails: {
      type: [String],
      default: [],
    },
  },
  { _id: true }
);

const campaignSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Campaign name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Campaign slug is required"],
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    clientName: {
      type: String,
      required: [true, "Client or sponsor name is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "PLANNING",
        "IN_PRODUCTION",
        "IN_REVIEW",
        "APPROVED",
        "COMPLETED",
        "ARCHIVED",
      ],
      default: "PLANNING",
      index: true,
    },
    workspace: {
      type: Types.ObjectId,
      ref: "workspace",
      required: [true, "Workspace reference is required"],
      index: true,
    },
    creator: {
      type: Types.ObjectId,
      ref: "user",
      required: [true, "Creator reference is required"],
      index: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    deliveryDeadline: {
      type: Date,
      required: [true, "Delivery deadline is required"],
      index: true,
    },
    deliverables: {
      type: [deliverableSchema],
      default: [],
    },
    activeBrief: {
      type: Types.ObjectId,
      ref: "brief",
      default: null,
    },
    activeVersion: {
      type: Types.ObjectId,
      ref: "version",
      default: null,
    },
    isPublicShowcaseConsented: {
      type: Boolean,
      default: false,
      index: true,
    },
    showcaseSlug: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    showcaseDescription: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  }
);

campaignSchema.index({ workspace: 1, slug: 1 }, { unique: true });
campaignSchema.index({ workspace: 1, status: 1 });

export const CampaignModel = model("campaign", campaignSchema);
