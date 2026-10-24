import { Types } from "mongoose";
import { CampaignMembershipModel } from "../models/campaign-membership.model.js";
import { CampaignModel } from "../models/campaign.model.js";
import { WorkspaceModel } from "../models/workspace.model.js";

/**
 * Enforces campaign-scoped role permissions.
 * Allowed roles can be: 'PRODUCER', 'EDITOR', 'REVIEWER'.
 */
export function requireCampaignRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const campaignId =
        req.params.id ||
        req.params.campaignId ||
        req.body?.campaignId ||
        req.query?.campaignId;

      if (!campaignId) {
        return res.status(400).json({
          success: false,
          message: "Campaign ID is required to verify permissions",
        });
      }

      if (!Types.ObjectId.isValid(campaignId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid campaign ID format",
        });
      }

      const campaign = await CampaignModel.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: "Campaign not found",
        });
      }

      // 1. Check if user is the direct creator of the campaign
      if (campaign.creator.toString() === req.user._id.toString()) {
        req.campaign = campaign;
        req.campaignRole = "PRODUCER";
        return next();
      }

      // 2. Check if user is the Workspace Owner
      const workspace = await WorkspaceModel.findById(campaign.workspace);
      if (workspace && workspace.ownerId.toString() === req.user._id.toString()) {
        req.campaign = campaign;
        req.campaignRole = "PRODUCER";
        return next();
      }

      // 3. Check campaign-specific membership
      const membership = await CampaignMembershipModel.findOne({
        campaign: campaignId,
        user: req.user._id,
        invitationStatus: "ACCEPTED",
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "You are not a member of this campaign",
        });
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
        return res.status(403).json({
          success: false,
          message: `Your role (${membership.role}) is not authorized to perform this action`,
        });
      }

      req.campaign = campaign;
      req.campaignRole = membership.role;
      req.membership = membership;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Checks workspace ownership or membership
 */
export function requireWorkspaceAccess() {
  return async (req, res, next) => {
    try {
      const workspaceId =
        req.params.workspaceId || req.body?.workspaceId || req.query?.workspaceId;

      if (!workspaceId || !Types.ObjectId.isValid(workspaceId)) {
        return res.status(400).json({
          success: false,
          message: "Valid workspace ID is required",
        });
      }

      const workspace = await WorkspaceModel.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: "Workspace not found",
        });
      }

      const isOwner = workspace.ownerId.toString() === req.user._id.toString();
      const isMember = workspace.members.some(
        (m) => m.user.toString() === req.user._id.toString()
      );

      if (!isOwner && !isMember) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this workspace",
        });
      }

      req.workspace = workspace;
      next();
    } catch (error) {
      next(error);
    }
  };
}
