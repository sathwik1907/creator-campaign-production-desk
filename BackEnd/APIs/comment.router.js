import express from "express";
import { z } from "zod";
import { CommentModel } from "../models/comment.model.js";
import { VersionModel } from "../models/version.model.js";
import { CampaignMembershipModel } from "../models/campaign-membership.model.js";
import { CampaignModel } from "../models/campaign.model.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { logAuditEvent } from "../services/audit.service.js";

export const commentRouter = express.Router();

commentRouter.use(requireAuth);

const addCommentSchema = z.object({
  text: z.string().min(1),
  sectionRef: z.string().optional(),
  timecode: z.string().optional(),
});

// GET /api/versions/:id/comments
commentRouter.get("/versions/:id/comments", async (req, res, next) => {
  try {
    const version = await VersionModel.findById(req.params.id);
    if (!version) {
      return res.status(404).json({ success: false, message: "Version not found" });
    }

    // Verify campaign membership
    const isCreator = await CampaignModel.findOne({
      _id: version.campaign,
      creator: req.user._id,
    });
    const membership = await CampaignMembershipModel.findOne({
      campaign: version.campaign,
      user: req.user._id,
      invitationStatus: "ACCEPTED",
    });

    if (!isCreator && !membership) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const comments = await CommentModel.find({ version: version._id })
      .populate("author", "name email")
      .sort({ createdAt: 1 })
      .lean();

    res.json({ success: true, data: comments });
  } catch (error) {
    next(error);
  }
});

// POST /api/versions/:id/comments
commentRouter.post(
  "/versions/:id/comments",
  validate(addCommentSchema),
  async (req, res, next) => {
    try {
      const version = await VersionModel.findById(req.params.id);
      if (!version) {
        return res.status(404).json({ success: false, message: "Version not found" });
      }

      // Verify campaign membership
      const isCreator = await CampaignModel.findOne({
        _id: version.campaign,
        creator: req.user._id,
      });
      const membership = await CampaignMembershipModel.findOne({
        campaign: version.campaign,
        user: req.user._id,
        invitationStatus: "ACCEPTED",
      });

      if (!isCreator && !membership) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const { text, sectionRef, timecode } = req.body;

      const comment = await CommentModel.create({
        campaign: version.campaign,
        version: version._id,
        author: req.user._id,
        text,
        sectionRef: sectionRef || "",
        timecode: timecode || "",
      });

      const populatedComment = await CommentModel.findById(comment._id).populate(
        "author",
        "name email"
      );

      await logAuditEvent({
        actor: req.user._id,
        action: "COMMENT_ADDED",
        resourceType: "Comment",
        resourceId: comment._id,
        campaign: version.campaign,
        workspace: version.workspace,
      });

      res.status(201).json({ success: true, data: populatedComment });
    } catch (error) {
      next(error);
    }
  }
);
