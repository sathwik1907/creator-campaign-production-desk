import { Schema, model, Types } from "mongoose";

const messageSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system", "tool"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    citations: [
      {
        briefTitle: String,
        revision: Number,
        sectionTitle: String,
        page: Number,
        excerpt: String,
      },
    ],
    toolCalls: [
      {
        name: String,
        input: Schema.Types.Mixed,
        output: Schema.Types.Mixed,
        status: String,
      },
    ],
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const conversationSchema = new Schema(
  {
    campaignId: {
      type: Types.ObjectId,
      ref: "campaign",
      required: true,
      index: true,
    },
    workspaceId: {
      type: Types.ObjectId,
      ref: "workspace",
      required: true,
      index: true,
    },
    userId: {
      type: Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "Campaign Chat",
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  }
);

conversationSchema.index({ campaignId: 1, userId: 1, updatedAt: -1 });

export const ConversationModel = model("conversation", conversationSchema);
