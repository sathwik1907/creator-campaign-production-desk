import { Schema, model, Types } from "mongoose";

const workspaceSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Workspace name is required"],
      trim: true,
      minLength: [2, "Workspace name must be at least 2 characters"],
      maxLength: [100, "Workspace name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: [true, "Workspace slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    ownerId: {
      type: Types.ObjectId,
      ref: "user",
      required: [true, "Owner ID is required"],
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    members: [
      {
        user: {
          type: Types.ObjectId,
          ref: "user",
          required: true,
        },
        role: {
          type: String,
          enum: ["PRODUCER", "EDITOR", "REVIEWER"],
          default: "EDITOR",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  }
);

workspaceSchema.index({ "members.user": 1 });

export const WorkspaceModel = model("workspace", workspaceSchema);
