import { Schema, model, Types } from "mongoose";

const commentSchema = new Schema(
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
    author: {
      type: Types.ObjectId,
      ref: "user",
      required: [true, "Author reference is required"],
      index: true,
    },
    text: {
      type: String,
      required: [true, "Comment text is required"],
      trim: true,
    },
    sectionRef: {
      type: String,
      default: "",
    },
    timecode: {
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

commentSchema.index({ version: 1, createdAt: 1 });

export const CommentModel = model("comment", commentSchema);
