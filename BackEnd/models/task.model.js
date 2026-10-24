import { Schema, model, Types } from "mongoose";

const taskSchema = new Schema(
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
      required: [true, "Task title is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    assignedTo: {
      type: Types.ObjectId,
      ref: "user",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["TODO", "IN_PROGRESS", "REVIEW", "DONE"],
      default: "TODO",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
      index: true,
    },
    dependencies: [
      {
        type: Types.ObjectId,
        ref: "task",
      },
    ],
    completionDetails: {
      completedAt: { type: Date, default: null },
      completedBy: { type: Types.ObjectId, ref: "user", default: null },
      notes: { type: String, default: "" },
    },
    createdBy: {
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

taskSchema.index({ campaign: 1, dueDate: 1 });
taskSchema.index({ campaign: 1, status: 1 });

export const TaskModel = model("task", taskSchema);
