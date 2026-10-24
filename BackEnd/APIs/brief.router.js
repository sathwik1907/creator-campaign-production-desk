import express from "express";
import { z } from "zod";
import fs from "fs";
import { BriefModel } from "../models/brief.model.js";
import { CampaignModel } from "../models/campaign.model.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireCampaignRole } from "../middlewares/rbac.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { extractTextFromFile } from "../services/read-text-clean.service.js";
import { ingestBriefDocument, answerBriefQuestion } from "../services/rag.service.js";
import { logAuditEvent } from "../services/audit.service.js";
import { Types } from "mongoose";

export const briefRouter = express.Router({ mergeParams: true });

briefRouter.use(requireAuth);

const askBriefSchema = z.object({
  query: z.string().min(2),
  revisionNumber: z.number().optional(),
});

// GET /api/campaigns/:id/briefs - Revision history (All campaign members)
briefRouter.get(
  "/",
  requireCampaignRole("PRODUCER", "EDITOR", "REVIEWER"),
  async (req, res, next) => {
    try {
      const briefs = await BriefModel.find({
        campaign: req.params.id,
      })
        .populate("uploadedBy", "name email")
        .sort({ revisionNumber: -1 })
        .lean();

      res.json({ success: true, data: briefs });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/campaigns/:id/briefs/:briefId - View specific brief
briefRouter.get(
  "/:briefId",
  requireCampaignRole("PRODUCER", "EDITOR", "REVIEWER"),
  async (req, res, next) => {
    try {
      const brief = await BriefModel.findOne({
        _id: req.params.briefId,
        campaign: req.params.id,
      }).populate("uploadedBy", "name email");

      if (!brief) {
        return res.status(404).json({ success: false, message: "Brief not found" });
      }

      res.json({ success: true, data: brief });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/campaigns/:id/briefs - Upload sponsor brief (PRODUCER only)
// Note: Editors and Reviewers cannot upload/modify sponsor brief!
briefRouter.post(
  "/",
  requireCampaignRole("PRODUCER"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const campaign = req.campaign;
      const uploadedFile = req.file;

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          message: "A brief document file (PDF or TXT) is required",
        });
      }

      const fileBuffer = fs.readFileSync(uploadedFile.path);
      const extractedText = await extractTextFromFile(fileBuffer, uploadedFile.mimetype);

      // Determine next revision number
      const latestBrief = await BriefModel.findOne({ campaign: campaign._id })
        .sort({ revisionNumber: -1 })
        .lean();

      const nextRevision = latestBrief ? latestBrief.revisionNumber + 1 : 1;

      // Mark previous brief as SUPERSEDED
      if (latestBrief) {
        await BriefModel.findByIdAndUpdate(latestBrief._id, { status: "SUPERSEDED" });
      }

      const title = req.body.title || uploadedFile.originalname.replace(/\.[^/.]+$/, "");
      const approvedNotes = req.body.approvedNotes || "";

      // Parse simple sections based on headings (e.g., # or Section headers)
      const lines = extractedText.split("\n");
      const sections = [];
      let currentSection = { sectionTitle: "Overview & Objectives", page: 1, content: "" };

      for (const line of lines) {
        if (/^(#{1,3}|section|\d+\.)/i.test(line.trim()) && line.length < 80) {
          if (currentSection.content.trim()) {
            sections.push(currentSection);
          }
          currentSection = {
            sectionTitle: line.replace(/^[#\d.\s]+/, "").trim() || "Requirements",
            page: 1,
            content: line + "\n",
          };
        } else {
          currentSection.content += line + "\n";
        }
      }
      if (currentSection.content.trim()) {
        sections.push(currentSection);
      }

      const briefDocument = await BriefModel.create({
        campaign: campaign._id,
        workspace: campaign.workspace,
        title,
        revisionNumber: nextRevision,
        originalFilename: uploadedFile.originalname,
        storageKey: uploadedFile.filename,
        mimeType: uploadedFile.mimetype,
        fileSize: uploadedFile.size,
        extractedText,
        approvedNotes,
        sourceSections: sections,
        status: "ACTIVE",
        uploadedBy: req.user._id,
      });

      // Ingest into chunks and generate embeddings
      await ingestBriefDocument({
        campaignId: campaign._id,
        workspaceId: campaign.workspace,
        briefId: briefDocument._id,
        revisionNumber: nextRevision,
        extractedText,
        sourceSections: sections,
      });

      // Update active brief reference on campaign
      await CampaignModel.findByIdAndUpdate(campaign._id, {
        activeBrief: briefDocument._id,
      });

      await logAuditEvent({
        actor: req.user._id,
        action: "BRIEF_UPLOADED",
        resourceType: "Brief",
        resourceId: briefDocument._id,
        campaign: campaign._id,
        workspace: campaign.workspace,
        details: { revisionNumber: nextRevision, filename: uploadedFile.originalname },
      });

      res.status(201).json({
        success: true,
        message: `Brief revision v${nextRevision} uploaded and indexed successfully`,
        data: briefDocument,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/campaigns/:id/briefs/ask - Ask questions about the brief (RAG with citations)
briefRouter.post(
  "/ask",
  requireCampaignRole("PRODUCER", "EDITOR", "REVIEWER"),
  validate(askBriefSchema),
  async (req, res, next) => {
    try {
      const { query, revisionNumber } = req.body;

      const result = await answerBriefQuestion({
        campaignId: req.params.id,
        query,
        revisionNumber,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);
