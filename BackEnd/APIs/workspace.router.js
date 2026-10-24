import express from "express";
import { z } from "zod";
import { WorkspaceModel } from "../models/workspace.model.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";

export const workspaceRouter = express.Router();

workspaceRouter.use(requireAuth);

const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
});

// GET /api/workspaces
workspaceRouter.get("/", async (req, res, next) => {
  try {
    const workspaces = await WorkspaceModel.find({
      $or: [{ ownerId: req.user._id }, { "members.user": req.user._id }],
    }).populate("ownerId", "name email");

    res.json({ success: true, data: workspaces });
  } catch (error) {
    next(error);
  }
});

// POST /api/workspaces
workspaceRouter.post("/", validate(createWorkspaceSchema), async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;

    const workspace = await WorkspaceModel.create({
      name,
      slug,
      description: description || "",
      ownerId: req.user._id,
      members: [{ user: req.user._id, role: "PRODUCER" }],
    });

    res.status(201).json({ success: true, data: workspace });
  } catch (error) {
    next(error);
  }
});

// GET /api/workspaces/:id
workspaceRouter.get("/:id", async (req, res, next) => {
  try {
    const workspace = await WorkspaceModel.findById(req.params.id)
      .populate("ownerId", "name email")
      .populate("members.user", "name email");

    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found" });
    }

    const hasAccess =
      workspace.ownerId._id.toString() === req.user._id.toString() ||
      workspace.members.some((m) => m.user._id.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    res.json({ success: true, data: workspace });
  } catch (error) {
    next(error);
  }
});
