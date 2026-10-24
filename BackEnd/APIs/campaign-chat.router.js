import express from "express";
import { z } from "zod";
import { ConversationModel } from "../models/conversation.model.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireCampaignRole } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { sendCampaignChatMessage } from "../services/chat.service.js";

export const campaignChatRouter = express.Router();

campaignChatRouter.use(requireAuth);

const chatMessageSchema = z.object({
  campaignId: z.string(),
  conversationId: z.string().optional(),
  message: z.string().min(1).max(2000),
});

// POST /api/campaign-chat (Campaign member)
campaignChatRouter.post(
  "/",
  validate(chatMessageSchema),
  requireCampaignRole("PRODUCER", "EDITOR", "REVIEWER"),
  async (req, res, next) => {
    try {
      const { campaignId, conversationId, message } = req.body;

      const result = await sendCampaignChatMessage({
        campaignId,
        workspaceId: req.campaign.workspace,
        userId: req.user._id,
        conversationId,
        message,
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

// GET /api/campaign-chat/:campaignId/history
campaignChatRouter.get(
  "/:id/history",
  requireCampaignRole("PRODUCER", "EDITOR", "REVIEWER"),
  async (req, res, next) => {
    try {
      const conversations = await ConversationModel.find({
        campaignId: req.params.id,
        userId: req.user._id,
      })
        .populate("userId", "name email")
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean();

      res.json({ success: true, data: conversations });
    } catch (error) {
      next(error);
    }
  }
);
