import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireCampaignRole } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { runProductionFeasibilityAgent } from "../services/agent.service.js";

export const productionAgentRouter = express.Router();

productionAgentRouter.use(requireAuth);

const agentRequestSchema = z.object({
  campaignId: z.string(),
  query: z.string().optional(),
  targetDate: z.string().optional(),
});

// POST /api/production-agent (Campaign member / Producer)
productionAgentRouter.post(
  "/",
  validate(agentRequestSchema),
  requireCampaignRole("PRODUCER", "EDITOR"),
  async (req, res, next) => {
    try {
      const { campaignId, query, targetDate } = req.body;

      // Parse target delivery date (e.g. if looking for Friday or explicit date)
      let parsedTargetDate;
      if (targetDate) {
        parsedTargetDate = new Date(targetDate);
      } else {
        // Default to campaign delivery deadline
        parsedTargetDate = req.campaign.deliveryDeadline || new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
      }

      const result = await runProductionFeasibilityAgent({
        user: req.user,
        campaignId,
        targetDate: parsedTargetDate,
        userQuery: query || "Can we deliver this campaign by Friday?",
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
