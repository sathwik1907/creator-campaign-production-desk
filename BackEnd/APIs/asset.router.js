import express from "express";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { AssetModel } from "../models/asset.model.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireCampaignRole } from "../middlewares/rbac.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  generateAssetEmbedding,
  searchAssetsSemantic,
  checkAssetUsageRights,
} from "../services/asset-discovery.service.js";
import { logAuditEvent } from "../services/audit.service.js";
import { Types } from "mongoose";

export const assetRouter = express.Router({ mergeParams: true });

assetRouter.use(requireAuth);

const assetSearchSchema = z.object({
  query: z.string().min(1),
  assetType: z.string().optional(),
  targetDate: z.string().optional(),
  channel: z.string().optional(),
});

// GET /api/campaigns/:id/assets - List all campaign assets with rights evaluation
assetRouter.get(
  "/",
  requireCampaignRole("PRODUCER", "EDITOR", "REVIEWER"),
  async (req, res, next) => {
    try {
      const { type } = req.query;
      const filter = { campaign: req.params.id };
      if (type) filter.assetType = type;

      const assets = await AssetModel.find(filter)
        .populate("uploadedBy", "name email")
        .sort({ createdAt: -1 })
        .lean();

      const evaluatedAssets = assets.map((asset) => ({
        ...asset,
        rightsAssessment: checkAssetUsageRights(asset, new Date()),
      }));

      res.json({ success: true, data: evaluatedAssets });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/campaigns/:id/assets/search - Semantic discovery with rights check
assetRouter.get(
  "/search",
  requireCampaignRole("PRODUCER", "EDITOR", "REVIEWER"),
  async (req, res, next) => {
    try {
      const { query, assetType, targetDate, channel } = req.query;

      if (!query) {
        return res.status(400).json({ success: false, message: "Search query is required" });
      }

      const results = await searchAssetsSemantic({
        campaignId: req.params.id,
        query,
        assetType: assetType || null,
        targetDate: targetDate ? new Date(targetDate) : new Date(),
        targetChannel: channel || null,
      });

      res.json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/campaigns/:id/assets - Upload asset (PRODUCER or EDITOR)
assetRouter.post(
  "/",
  requireCampaignRole("PRODUCER", "EDITOR"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const campaign = req.campaign;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, message: "File upload is required" });
      }

      const {
        title,
        assetType,
        caption,
        tags,
        owner,
        licenseStartDate,
        licenseEndDate,
        allowedChannels,
        restrictions,
        requiredAttribution,
      } = req.body;

      if (!title || !assetType) {
        return res.status(400).json({
          success: false,
          message: "Title and assetType are required",
        });
      }

      const parsedTags = Array.isArray(tags)
        ? tags
        : typeof tags === "string"
        ? tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      const parsedChannels = Array.isArray(allowedChannels)
        ? allowedChannels
        : typeof allowedChannels === "string"
        ? allowedChannels.split(",").map((c) => c.trim()).filter(Boolean)
        : ["YouTube", "Podcast", "Social Media"];

      const isLicenseExpired = licenseEndDate ? new Date(licenseEndDate) < new Date() : false;

      const assetDoc = await AssetModel.create({
        campaign: campaign._id,
        workspace: campaign.workspace,
        title,
        originalFilename: file.originalname,
        storageKey: file.filename,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        assetType,
        caption: caption || "",
        tags: parsedTags,
        usageRights: {
          owner: owner || "Client",
          licenseStartDate: licenseStartDate ? new Date(licenseStartDate) : new Date(),
          licenseEndDate: licenseEndDate ? new Date(licenseEndDate) : null,
          allowedChannels: parsedChannels,
          restrictions: restrictions || "None specified",
          requiredAttribution: requiredAttribution || "",
          isExpired: isLicenseExpired,
        },
        approvalStatus: "APPROVED",
        uploadedBy: req.user._id,
      });

      // Generate embedding for semantic discovery
      try {
        const embedding = await generateAssetEmbedding(assetDoc);
        assetDoc.embedding = embedding;
        await assetDoc.save();
      } catch (embErr) {
        console.warn("Could not generate vector embedding for asset:", embErr.message);
      }

      await logAuditEvent({
        actor: req.user._id,
        action: "ASSET_UPLOADED",
        resourceType: "Asset",
        resourceId: assetDoc._id,
        campaign: campaign._id,
        workspace: campaign.workspace,
        details: { title, assetType, filename: file.originalname },
      });

      res.status(201).json({ success: true, data: assetDoc });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/campaigns/:id/assets/:assetId - Get single asset details
assetRouter.get(
  "/:assetId",
  requireCampaignRole("PRODUCER", "EDITOR", "REVIEWER"),
  async (req, res, next) => {
    try {
      const asset = await AssetModel.findOne({
        _id: req.params.assetId,
        campaign: req.params.id,
      }).populate("uploadedBy", "name email");

      if (!asset) {
        return res.status(404).json({ success: false, message: "Asset not found" });
      }

      const rightsAssessment = checkAssetUsageRights(asset, new Date());
      res.json({ success: true, data: { ...asset.toObject(), rightsAssessment } });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/campaigns/:id/assets/:assetId - Update asset metadata / usage rights (PRODUCER or EDITOR)
assetRouter.patch(
  "/:assetId",
  requireCampaignRole("PRODUCER", "EDITOR"),
  async (req, res, next) => {
    try {
      const asset = await AssetModel.findOne({
        _id: req.params.assetId,
        campaign: req.params.id,
      });

      if (!asset) {
        return res.status(404).json({ success: false, message: "Asset not found" });
      }

      const { title, caption, tags, usageRights, approvalStatus } = req.body;

      if (title !== undefined) asset.title = title;
      if (caption !== undefined) asset.caption = caption;
      if (tags !== undefined) asset.tags = tags;
      if (approvalStatus !== undefined) asset.approvalStatus = approvalStatus;

      if (usageRights) {
        asset.usageRights = {
          ...asset.usageRights.toObject(),
          ...usageRights,
          ...(usageRights.licenseEndDate && {
            isExpired: new Date(usageRights.licenseEndDate) < new Date(),
          }),
        };
      }

      await asset.save();

      // Refresh embedding
      try {
        const embedding = await generateAssetEmbedding(asset);
        asset.embedding = embedding;
        await asset.save();
      } catch (err) {}

      await logAuditEvent({
        actor: req.user._id,
        action: "ASSET_UPDATED",
        resourceType: "Asset",
        resourceId: asset._id,
        campaign: asset.campaign,
        workspace: asset.workspace,
      });

      res.json({ success: true, data: asset });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/campaigns/:id/assets/:assetId/download - Protected download with campaign check
assetRouter.get(
  "/:assetId/download",
  requireCampaignRole("PRODUCER", "EDITOR", "REVIEWER"),
  async (req, res, next) => {
    try {
      const asset = await AssetModel.findOne({
        _id: req.params.assetId,
        campaign: req.params.id,
      });

      if (!asset) {
        return res.status(404).json({ success: false, message: "Asset not found" });
      }

      const filePath = path.resolve(asset.filePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: "File missing on disk" });
      }

      res.setHeader("Content-Disposition", `attachment; filename="${asset.originalFilename}"`);
      res.setHeader("Content-Type", asset.mimeType);
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      next(error);
    }
  }
);
