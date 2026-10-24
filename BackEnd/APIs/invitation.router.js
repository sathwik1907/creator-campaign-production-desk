import express from "express";
import { InvitationModel } from "../models/invitation.model.js";
import { CampaignMembershipModel } from "../models/campaign-membership.model.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { hashToken } from "../services/auth.service.js";
import { logAuditEvent } from "../services/audit.service.js";

export const invitationRouter = express.Router();

invitationRouter.use(requireAuth);

// GET /api/invitations - List pending invitations for logged-in user
invitationRouter.get("/", async (req, res, next) => {
  try {
    const invitations = await InvitationModel.find({
      email: req.user.email.toLowerCase(),
      status: "PENDING",
      expiresAt: { $gt: new Date() },
    })
      .populate("campaign", "name slug clientName")
      .populate("workspace", "name slug")
      .populate("invitedBy", "name email")
      .lean();

    res.json({ success: true, data: invitations });
  } catch (error) {
    next(error);
  }
});

// POST /api/invitations/:token/accept - Accept invitation
invitationRouter.post("/:token/accept", async (req, res, next) => {
  try {
    const rawToken = req.params.token;
    const tokenHash = hashToken(rawToken);

    const invitation = await InvitationModel.findOne({
      tokenHash,
      status: "PENDING",
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired invitation token",
      });
    }

    if (invitation.email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: "This invitation was sent to a different email address",
      });
    }

    // Update invitation status
    invitation.status = "ACCEPTED";
    await invitation.save();

    // Create or update campaign membership
    const membership = await CampaignMembershipModel.findOneAndUpdate(
      { campaign: invitation.campaign, user: req.user._id },
      {
        workspace: invitation.workspace,
        role: invitation.role,
        invitationStatus: "ACCEPTED",
        invitedBy: invitation.invitedBy,
      },
      { upsert: true, new: true }
    );

    await logAuditEvent({
      actor: req.user._id,
      action: "CAMPAIGN_INVITATION_ACCEPTED",
      resourceType: "CampaignMembership",
      resourceId: membership._id,
      campaign: invitation.campaign,
      workspace: invitation.workspace,
      details: { role: invitation.role },
    });

    res.json({
      success: true,
      message: `Invitation accepted. You now have '${invitation.role}' access to the campaign.`,
      data: membership,
    });
  } catch (error) {
    next(error);
  }
});
