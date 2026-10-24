import express from "express";
import { z } from "zod";
import { TaskModel } from "../models/task.model.js";
import { CampaignModel } from "../models/campaign.model.js";
import { CampaignMembershipModel } from "../models/campaign-membership.model.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireCampaignRole } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { logAuditEvent } from "../services/audit.service.js";
import { Types } from "mongoose";

export const taskRouter = express.Router();

taskRouter.use(requireAuth);

const createTaskSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string(),
  dependencies: z.array(z.string()).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
});

const batchApplyTasksSchema = z.object({
  proposedTasks: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      suggestedDueDate: z.string().optional(),
    })
  ),
});

// GET /api/campaigns/:id/tasks - List all tasks for a campaign
taskRouter.get(
  "/campaigns/:id/tasks",
  requireCampaignRole("PRODUCER", "EDITOR", "REVIEWER"),
  async (req, res, next) => {
    try {
      const tasks = await TaskModel.find({ campaign: req.params.id })
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email")
        .populate("dependencies", "title status dueDate")
        .sort({ dueDate: 1 })
        .lean();

      res.json({ success: true, data: tasks });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/campaigns/:id/tasks - Create task (PRODUCER only)
taskRouter.post(
  "/campaigns/:id/tasks",
  requireCampaignRole("PRODUCER"),
  validate(createTaskSchema),
  async (req, res, next) => {
    try {
      const campaign = req.campaign;
      const { title, description, assignedTo, priority, dueDate, dependencies } = req.body;

      const task = await TaskModel.create({
        campaign: campaign._id,
        workspace: campaign.workspace,
        title,
        description: description || "",
        assignedTo: assignedTo && Types.ObjectId.isValid(assignedTo) ? assignedTo : null,
        priority: priority || "MEDIUM",
        dueDate: new Date(dueDate),
        dependencies: (dependencies || []).map((id) => new Types.ObjectId(id)),
        status: "TODO",
        createdBy: req.user._id,
      });

      await logAuditEvent({
        actor: req.user._id,
        action: "TASK_CREATED",
        resourceType: "Task",
        resourceId: task._id,
        campaign: campaign._id,
        workspace: campaign.workspace,
        details: { title, priority, dueDate },
      });

      res.status(201).json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/tasks/:id - Update task status / details
// Producer can update all fields; assigned Editor can update status
taskRouter.patch("/:id", validate(updateTaskSchema), async (req, res, next) => {
  try {
    const task = await TaskModel.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    // Check user membership and role in this task's campaign
    const membership = await CampaignMembershipModel.findOne({
      campaign: task.campaign,
      user: req.user._id,
      invitationStatus: "ACCEPTED",
    });

    const isCreator = await CampaignModel.findOne({
      _id: task.campaign,
      creator: req.user._id,
    });

    const isProducer = isCreator || (membership && membership.role === "PRODUCER");
    const isAssignedEditor =
      membership &&
      membership.role === "EDITOR" &&
      task.assignedTo?.toString() === req.user._id.toString();

    if (!isProducer && !isAssignedEditor) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this task",
      });
    }

    const { title, description, status, priority, dueDate, assignedTo, dependencies } = req.body;

    if (isProducer) {
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (priority !== undefined) task.priority = priority;
      if (dueDate !== undefined) task.dueDate = new Date(dueDate);
      if (assignedTo !== undefined) task.assignedTo = assignedTo || null;
      if (dependencies !== undefined) {
        task.dependencies = dependencies.map((id) => new Types.ObjectId(id));
      }
    }

    // Both Producer and assigned Editor can update status
    if (status !== undefined) {
      task.status = status;
      if (status === "DONE") {
        task.completionDetails = {
          completedAt: new Date(),
          completedBy: req.user._id,
        };
      }
    }

    await task.save();

    await logAuditEvent({
      actor: req.user._id,
      action: "TASK_UPDATED",
      resourceType: "Task",
      resourceId: task._id,
      campaign: task.campaign,
      workspace: task.workspace,
      details: { updatedFields: req.body },
    });

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns/:id/tasks/batch-apply-proposed - Producer confirms and applies AI proposed tasks
taskRouter.post(
  "/campaigns/:id/tasks/batch-apply-proposed",
  requireCampaignRole("PRODUCER"),
  validate(batchApplyTasksSchema),
  async (req, res, next) => {
    try {
      const campaign = req.campaign;
      const { proposedTasks } = req.body;

      const createdTasks = [];
      for (const p of proposedTasks) {
        const dueDate = p.suggestedDueDate ? new Date(p.suggestedDueDate) : new Date(Date.now() + 48 * 60 * 60 * 1000);
        const task = await TaskModel.create({
          campaign: campaign._id,
          workspace: campaign.workspace,
          title: p.title,
          description: p.description || "Proposed by AI Production Assistant and confirmed by Producer.",
          priority: p.priority || "HIGH",
          dueDate,
          status: "TODO",
          createdBy: req.user._id,
        });
        createdTasks.push(task);
      }

      await logAuditEvent({
        actor: req.user._id,
        action: "PROPOSED_TASKS_CONFIRMED_AND_APPLIED",
        resourceType: "Task",
        campaign: campaign._id,
        workspace: campaign.workspace,
        details: { count: createdTasks.length, titles: createdTasks.map((t) => t.title) },
      });

      res.status(201).json({
        success: true,
        message: `Successfully created ${createdTasks.length} confirmed production tasks`,
        data: createdTasks,
      });
    } catch (error) {
      next(error);
    }
  }
);
