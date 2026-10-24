import express from "express";
import { z } from "zod";
import { VersionModel } from "../models/version.model.js";
import { CampaignModel } from "../models/campaign.model.js";
import { DecisionModel } from "../models/decision.model.js";
import { BriefModel } from "../models/brief.model.js";
import { CampaignMembershipModel } from "../models/campaign-membership.model.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireCampaignRole } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { logAuditEvent } from "../services/audit.service.js";
import { Types } from "mongoose";

export const versionRouter = express.Router();

versionRouter.use(requireAuth);

const createVersionSchema = z.object({
  title: z.string().min(2),
  scriptContent: z.string().min(10),
  videoAssetUrl: z.string().optional(),
  changelog: z.string().optional(),
  briefRevisionId: z.string().optional(),
  assetReferences: z.array(z.string()).optional(),
  submitForReview: z.boolean().optional(),
});

const decisionSchema = z.object({
  status: z.enum(["APPROVED", "REVISION_REQUESTED", "REJECTED"]),
  feedbackNotes: z.string().optional(),
});

// GET /api/campaigns/:id/versions - List all versions for a campaign
versionRouter.get(
  "/campaigns/:id/versions",
  requireCampaignRole("PRODUCER", "EDITOR", "REVIEWER"),
  async (req, res, next) => {
    try {
      const versions = await VersionModel.find({ campaign: req.params.id })
        .populate("author", "name email")
        .populate("briefRevision", "title revisionNumber")
        .populate("decisions")
        .sort({ versionNumber: -1 })
        .lean();

      res.json({ success: true, data: versions });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/campaigns/:id/versions - Submit script/video version (PRODUCER or EDITOR)
versionRouter.post(
  "/campaigns/:id/versions",
  requireCampaignRole("PRODUCER", "EDITOR"),
  validate(createVersionSchema),
  async (req, res, next) => {
    try {
      const campaign = req.campaign;
      const {
        title,
        scriptContent,
        videoAssetUrl,
        changelog,
        briefRevisionId,
        assetReferences,
        submitForReview,
      } = req.body;

      // Find latest version to determine next versionNumber
      const latestVersion = await VersionModel.findOne({ campaign: campaign._id })
        .sort({ versionNumber: -1 })
        .lean();

      const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

      // Ensure valid active brief revision
      let briefRef = briefRevisionId;
      if (!briefRef) {
        const activeBrief = await BriefModel.findOne({ campaign: campaign._id, status: "ACTIVE" });
        if (!activeBrief) {
          return res.status(400).json({
            success: false,
            message: "Cannot create a version without an active brief for this campaign",
          });
        }
        briefRef = activeBrief._id;
      }

      const initialStatus = submitForReview ? "SUBMITTED" : "DRAFT";

      const newVersion = await VersionModel.create({
        campaign: campaign._id,
        workspace: campaign.workspace,
        versionNumber: nextVersionNumber,
        title,
        scriptContent,
        videoAssetUrl: videoAssetUrl || "",
        changelog: changelog || `Version ${nextVersionNumber}`,
        submissionStatus: initialStatus,
        author: req.user._id,
        briefRevision: briefRef,
        assetReferences: (assetReferences || []).map((id) => new Types.ObjectId(id)),
        decisions: [],
        submittedAt: submitForReview ? new Date() : null,
      });

      // Update active version on campaign
      await CampaignModel.findByIdAndUpdate(campaign._id, {
        activeVersion: newVersion._id,
        status: submitForReview ? "IN_REVIEW" : campaign.status,
      });

      await logAuditEvent({
        actor: req.user._id,
        action: submitForReview ? "VERSION_SUBMITTED" : "VERSION_DRAFT_CREATED",
        resourceType: "Version",
        resourceId: newVersion._id,
        campaign: campaign._id,
        workspace: campaign.workspace,
        details: { versionNumber: nextVersionNumber, submissionStatus: initialStatus },
      });

      res.status(201).json({ success: true, data: newVersion });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/versions/compare - Side-by-side comparison of two versions
versionRouter.get("/compare", async (req, res, next) => {
  try {
    const { v1, v2 } = req.query;

    if (!v1 || !v2 || !Types.ObjectId.isValid(v1) || !Types.ObjectId.isValid(v2)) {
      return res.status(400).json({
        success: false,
        message: "Two valid version IDs (v1 and v2) are required for comparison",
      });
    }

    const version1 = await VersionModel.findById(v1)
      .populate("author", "name email")
      .populate("briefRevision", "title revisionNumber")
      .populate("decisions");

    const version2 = await VersionModel.findById(v2)
      .populate("author", "name email")
      .populate("briefRevision", "title revisionNumber")
      .populate("decisions");

    if (!version1 || !version2) {
      return res.status(404).json({ success: false, message: "One or both versions not found" });
    }

    if (version1.campaign.toString() !== version2.campaign.toString()) {
      return res.status(400).json({
        success: false,
        message: "Versions must belong to the same campaign to be compared",
      });
    }

    // Check user membership in campaign
    const membership = await CampaignMembershipModel.findOne({
      campaign: version1.campaign,
      user: req.user._id,
      invitationStatus: "ACCEPTED",
    });

    const isCreator = await CampaignModel.findOne({
      _id: version1.campaign,
      creator: req.user._id,
    });

    if (!membership && !isCreator) {
      return res.status(403).json({ success: false, message: "Forbidden: Not a campaign member" });
    }

    res.json({
      success: true,
      data: {
        version1,
        version2,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/versions/:id - Get single version details
versionRouter.get("/:id", async (req, res, next) => {
  try {
    const version = await VersionModel.findById(req.params.id)
      .populate("author", "name email")
      .populate("briefRevision", "title revisionNumber")
      .populate("assetReferences")
      .populate({
        path: "decisions",
        populate: { path: "reviewer", select: "name email" },
      });

    if (!version) {
      return res.status(404).json({ success: false, message: "Version not found" });
    }

    // Verify campaign access
    const membership = await CampaignMembershipModel.findOne({
      campaign: version.campaign,
      user: req.user._id,
      invitationStatus: "ACCEPTED",
    });

    const isCreator = await CampaignModel.findOne({
      _id: version.campaign,
      creator: req.user._id,
    });

    if (!membership && !isCreator) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    res.json({ success: true, data: version });
  } catch (error) {
    next(error);
  }
});

// POST /api/versions/:id/decision - Brand Reviewer decision (Brand Reviewer only)
versionRouter.post(
  "/:id/decision",
  validate(decisionSchema),
  async (req, res, next) => {
    try {
      const { status, feedbackNotes } = req.body;
      const versionId = req.params.id;

      const version = await VersionModel.findById(versionId);
      if (!version) {
        return res.status(404).json({ success: false, message: "Version not found" });
      }

      // Check reviewer permission: user must be assigned REVIEWER on this specific campaign
      const membership = await CampaignMembershipModel.findOne({
        campaign: version.campaign,
        user: req.user._id,
        invitationStatus: "ACCEPTED",
      });

      if (!membership || membership.role !== "REVIEWER") {
        return res.status(403).json({
          success: false,
          message: "Only assigned Brand Reviewers can record approval or revision decisions",
        });
      }

      // Can only review versions that have been submitted
      if (!["SUBMITTED", "IN_REVIEW"].includes(version.submissionStatus)) {
        return res.status(409).json({
          success: false,
          message: "Only submitted or in-review versions can receive a new decision",
        });
      }

      // Create immutable Decision record
      const decision = await DecisionModel.create({
        campaign: version.campaign,
        version: version._id,
        reviewer: req.user._id,
        status,
        feedbackNotes: feedbackNotes || "",
        decisionDate: new Date(),
      });

      // Update version status
      version.submissionStatus = status;
      version.decisions.push(decision._id);
      await version.save();

      // Update campaign status accordingly
      if (status === "APPROVED") {
        await CampaignModel.findByIdAndUpdate(version.campaign, { status: "APPROVED" });
      } else if (status === "REVISION_REQUESTED" || status === "REJECTED") {
        await CampaignModel.findByIdAndUpdate(version.campaign, { status: "IN_PRODUCTION" });
      }

      await logAuditEvent({
        actor: req.user._id,
        action: `DECISION_${status}`,
        resourceType: "Version",
        resourceId: version._id,
        campaign: version.campaign,
        workspace: version.workspace,
        details: { status, feedbackNotes },
      });

      res.status(201).json({
        success: true,
        message: `Decision '${status}' recorded successfully`,
        data: {
          decision,
          versionStatus: version.submissionStatus,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
