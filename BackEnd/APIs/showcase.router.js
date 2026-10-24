import express from "express";
import { CampaignModel } from "../models/campaign.model.js";
import { VersionModel } from "../models/version.model.js";

export const showcaseRouter = express.Router();

/**
 * Sanitized public campaign DTO
 */
function sanitizePublicCampaign(campaign, approvedVersion = null) {
  return {
    title: campaign.name,
    slug: campaign.showcaseSlug || campaign.slug,
    clientName: campaign.clientName,
    description: campaign.showcaseDescription || campaign.description,
    status: "APPROVED_FOR_SHOWCASE",
    approvedVersion: approvedVersion
      ? {
          title: approvedVersion.title,
          versionNumber: `v${approvedVersion.versionNumber}`,
          scriptExcerpt: approvedVersion.scriptContent.slice(0, 300) + "...",
          videoAssetUrl: approvedVersion.videoAssetUrl || null,
          approvedAt: approvedVersion.updatedAt,
        }
      : null,
  };
}

// GET /api/showcase - List all consented public showcase samples
showcaseRouter.get("/", async (req, res, next) => {
  try {
    // Only fetch campaigns that are consented and approved
    const publicCampaigns = await CampaignModel.find({
      isPublicShowcaseConsented: true,
      status: "APPROVED",
    }).lean();

    const sanitizedList = [];
    for (const campaign of publicCampaigns) {
      const approvedVersion = await VersionModel.findOne({
        campaign: campaign._id,
        submissionStatus: "APPROVED",
      })
        .sort({ versionNumber: -1 })
        .lean();

      if (approvedVersion) {
        sanitizedList.push(sanitizePublicCampaign(campaign, approvedVersion));
      }
    }

    res.json({ success: true, data: sanitizedList });
  } catch (error) {
    next(error);
  }
});

// GET /api/showcase/:slug - Get single consented public showcase sample
showcaseRouter.get("/:slug", async (req, res, next) => {
  try {
    const campaign = await CampaignModel.findOne({
      showcaseSlug: req.params.slug,
      isPublicShowcaseConsented: true,
      status: "APPROVED",
    }).lean();

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Public showcase sample not found or consent not granted",
      });
    }

    const approvedVersion = await VersionModel.findOne({
      campaign: campaign._id,
      submissionStatus: "APPROVED",
    })
      .sort({ versionNumber: -1 })
      .lean();

    if (!approvedVersion) {
      return res.status(404).json({
        success: false,
        message: "No approved public version is available for this showcase sample",
      });
    }

    res.json({
      success: true,
      data: sanitizePublicCampaign(campaign, approvedVersion),
    });
  } catch (error) {
    next(error);
  }
});
