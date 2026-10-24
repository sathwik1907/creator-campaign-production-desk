import { Schema, model, Types } from "mongoose";

const decisionSchema = new Schema(
  {
    campaign: {
      type: Types.ObjectId,
      ref: "campaign",
      required: [true, "Campaign reference is required"],
      index: true,
    },
    version: {
      type: Types.ObjectId,
      ref: "version",
      required: [true, "Version reference is required"],
      index: true,
    },
    reviewer: {
      type: Types.ObjectId,
      ref: "user",
      required: [true, "Reviewer reference is required"],
      index: true,
    },
    status: {
      type: String,
      enum: ["APPROVED", "REVISION_REQUESTED", "REJECTED"],
      required: [true, "Decision status is required"],
      index: true,
    },
    feedbackNotes: {
      type: String,
      default: "",
      trim: true,
    },
    decisionDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  }
);

decisionSchema.index({ campaign: 1, version: 1, decisionDate: -1 });

export const DecisionModel = model("decision", decisionSchema);
