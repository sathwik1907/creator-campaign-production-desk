import express from "express";
import { z } from "zod";
import { CampaignModel } from "../models/campaign.model.js";
import { CampaignMembershipModel } from "../models/campaign-membership.model.js";
import { WorkspaceModel } from "../models/workspace.model.js";
import { AuditEventModel } from "../models/audit-event.model.js";
import { InvitationModel } from "../models/invitation.model.js";
import { UserModel } from "../models/user.model.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireCampaignRole } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { logAuditEvent } from "../services/audit.service.js";
import { generateTokenAndHash } from "../services/auth.service.js";
import { Types } from "mongoose";

export const campaignRouter = express.Router();

campaignRouter.use(requireAuth);

const createCampaignSchema = z.object({
  name: z.string().min(2).max(100),
  clientName: z.string().min(1),
  workspaceId: z.string(),
  deliveryDeadline: z.string(),
  description: z.string().optional(),
  deliverables: z
    .array(
      z.object({
        title: z.string(),
        format: z.string().optional(),
        requirements: z.string().optional(),
        sponsorTextRequired: z.string().optional(),
      })
    )
    .optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["PRODUCER", "EDITOR", "REVIEWER"]),
});

const consentShowcaseSchema = z.object({
  isConsented: z.boolean(),
  showcaseDescription: z.string().optional(),
});

// GET /api/campaigns - List campaigns accessible by current user
campaignRouter.get("/", async (req, res, next) => {
  try {
    // 1. Direct creator campaigns
    const createdCampaigns = await CampaignModel.find({
      creator: req.user._id,
    }).lean();

    // 2. Memberships
    const memberships = await CampaignMembershipModel.find({
      user: req.user._id,
      invitationStatus: "ACCEPTED",
    }).lean();

    const memberCampaignIds = memberships.map((m) => m.campaign);
    const memberCampaigns = await CampaignModel.find({
      _id: { $in: memberCampaignIds },
    }).lean();

    // Merge and deduplicate
    const campaignMap = new Map();
    for (const c of [...createdCampaigns, ...memberCampaigns]) {
      campaignMap.set(c._id.toString(), c);
    }

    const campaigns = Array.from(campaignMap.values()).map((c) => {
      const isCreator = c.creator.toString() === req.user._id.toString();
      const m = memberships.find((mem) => mem.campaign.toString() === c._id.toString());
      return {
        ...c,
        userRole: isCreator ? "PRODUCER" : m?.role || "VIEWER",
      };
    });

    res.json({ success: true, data: campaigns });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns - Creator / Producer creates campaign
campaignRouter.post("/", validate(createCampaignSchema), async (req, res, next) => {
  try {
    const { name, clientName, workspaceId, deliveryDeadline, description, deliverables } = req.body;

    if (!Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ success: false, message: "Invalid workspace ID" });
    }

    const workspace = await WorkspaceModel.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found" });
    }

    // Verify creator belongs to workspace
    const isMember =
      workspace.ownerId.toString() === req.user._id.toString() ||
      workspace.members.some((m) => m.user.toString() === req.user._id.toString());

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to create campaigns in this workspace",
      });
    }

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;

    const campaign = await CampaignModel.create({
      name,
      slug,
      clientName,
      description: description || "",
      workspace: workspace._id,
      creator: req.user._id,
      deliveryDeadline: new Date(deliveryDeadline),
      deliverables: (deliverables || []).map((d) => ({
        title: d.title,
        format: d.format || "Video (16:9)",
        requirements: d.requirements || "",
        sponsorTextRequired: d.sponsorTextRequired || "",
        isCompleted: false,
      })),
      status: "PLANNING",
    });

    // Auto-create PRODUCER membership for creator
    await CampaignMembershipModel.create({
      campaign: campaign._id,
      user: req.user._id,
      workspace: workspace._id,
      role: "PRODUCER",
      invitationStatus: "ACCEPTED",
    });

    await logAuditEvent({
      actor: req.user._id,
      action: "CAMPAIGN_CREATED",
      resourceType: "Campaign",
      resourceId: campaign._id,
      campaign: campaign._id,
      workspace: workspace._id,
      details: { name, clientName },
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
});

// GET /api/campaigns/:id - Get campaign details with role
campaignRouter.get("/:id", requireCampaignRole(), async (req, res, next) => {
  try {
    const campaign = await CampaignModel.findById(req.params.id)
      .populate("creator", "name email")
      .populate("workspace", "name slug")
      .populate("activeBrief", "title revisionNumber originalFilename createdAt")
      .populate("activeVersion", "title versionNumber submissionStatus createdAt");

    const memberships = await CampaignMembershipModel.find({
      campaign: campaign._id,
      invitationStatus: "ACCEPTED",
    }).populate("user", "name email");

    res.json({
      success: true,
      data: {
        campaign,
        members: memberships.map((m) => ({
          user: m.user,
          role: m.role,
        })),
        currentUserRole: req.campaignRole,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/campaigns/:id - Update campaign (PRODUCER only)
campaignRouter.patch("/:id", requireCampaignRole("PRODUCER"), async (req, res, next) => {
  try {
    const allowedUpdates = [
      "name",
      "description",
      "clientName",
      "status",
      "deliveryDeadline",
      "deliverables",
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        if (key === "deliveryDeadline") {
          updates[key] = new Date(req.body[key]);
        } else {
          updates[key] = req.body[key];
        }
      }
    }

    const campaign = await CampaignModel.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });

    await logAuditEvent({
      actor: req.user._id,
      action: "CAMPAIGN_UPDATED",
      resourceType: "Campaign",
      resourceId: campaign._id,
      campaign: campaign._id,
      workspace: campaign.workspace,
      details: updates,
    });

    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns/:id/invitations - Invite member to campaign (PRODUCER only)
campaignRouter.post(
  "/:id/invitations",
  requireCampaignRole("PRODUCER"),
  validate(inviteMemberSchema),
  async (req, res, next) => {
    try {
      const { email, role } = req.body;
      const campaign = req.campaign;

      // Look up target user if they exist
      const existingUser = await UserModel.findOne({ email: email.toLowerCase() });

      const { rawToken, tokenHash } = generateTokenAndHash();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitation = await InvitationModel.create({
        email: email.toLowerCase(),
        campaign: campaign._id,
        workspace: campaign.workspace,
        role,
        tokenHash,
        invitedBy: req.user._id,
        expiresAt,
        status: "PENDING",
      });

      // If user exists, create pending membership or update
      if (existingUser) {
        await CampaignMembershipModel.findOneAndUpdate(
          { campaign: campaign._id, user: existingUser._id },
          {
            workspace: campaign.workspace,
            role,
            invitationStatus: "PENDING",
            invitedBy: req.user._id,
          },
          { upsert: true, new: true }
        );
      }

      await logAuditEvent({
        actor: req.user._id,
        action: "CAMPAIGN_INVITATION_SENT",
        resourceType: "Invitation",
        resourceId: invitation._id,
        campaign: campaign._id,
        workspace: campaign.workspace,
        details: { invitedEmail: email, role },
      });

      res.status(201).json({
        success: true,
        message: `Invitation sent to ${email} as ${role}`,
        data: {
          invitationId: invitation._id,
          email,
          role,
          invitationToken: rawToken, // Convenient for test and dev acceptance
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/campaigns/:id/activity - Timeline activity (Campaign member)
campaignRouter.get(
  "/:id/activity",
  requireCampaignRole("PRODUCER", "EDITOR", "REVIEWER"),
  async (req, res, next) => {
    try {
      const activities = await AuditEventModel.find({
        campaign: req.params.id,
      })
        .populate("actor", "name email")
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

      res.json({ success: true, data: activities });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/campaigns/:id/consent-showcase - Consent to public showcase (PRODUCER only)
campaignRouter.post(
  "/:id/consent-showcase",
  requireCampaignRole("PRODUCER"),
  validate(consentShowcaseSchema),
  async (req, res, next) => {
    try {
      const { isConsented, showcaseDescription } = req.body;
      const campaign = req.campaign;

      campaign.isPublicShowcaseConsented = isConsented;
      if (isConsented) {
        campaign.showcaseSlug = campaign.slug;
        campaign.showcaseDescription = showcaseDescription || campaign.description;
      } else {
        campaign.showcaseSlug = null;
      }

      await campaign.save();

      await logAuditEvent({
        actor: req.user._id,
        action: isConsented ? "SHOWCASE_CONSENT_GRANTED" : "SHOWCASE_CONSENT_REVOKED",
        resourceType: "Campaign",
        resourceId: campaign._id,
        campaign: campaign._id,
        workspace: campaign.workspace,
      });

      res.json({
        success: true,
        message: isConsented
          ? "Campaign consented for public showcase"
          : "Campaign public showcase consent revoked",
        data: {
          isPublicShowcaseConsented: campaign.isPublicShowcaseConsented,
          showcaseSlug: campaign.showcaseSlug,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
