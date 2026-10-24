import { Schema, model, Types } from "mongoose";

const chunkSchema = new Schema(
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
    briefId: {
      type: Types.ObjectId,
      ref: "brief",
      required: true,
      index: true,
    },
    revisionNumber: {
      type: Number,
      default: 1,
      index: true,
    },
    sectionTitle: {
      type: String,
      default: "General",
      trim: true,
    },
    pageNumber: {
      type: Number,
      default: 1,
    },
    chunkText: {
      type: String,
      required: [true, "Chunk text is required"],
      trim: true,
    },
    chunkIndex: {
      type: Number,
      required: [true, "Chunk index is required"],
    },
    embedding: {
      type: [Number],
      required: [true, "Embedding is required"],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  }
);

chunkSchema.index({ campaignId: 1, briefId: 1 });
chunkSchema.index({ campaignId: 1, revisionNumber: 1 });

export const ChunkModel = model("chunk", chunkSchema);
