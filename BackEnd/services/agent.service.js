import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { CampaignModel } from "../models/campaign.model.js";
import { AssetModel } from "../models/asset.model.js";
import { TaskModel } from "../models/task.model.js";
import { VersionModel } from "../models/version.model.js";
import { BriefModel } from "../models/brief.model.js";
import { checkAssetUsageRights } from "./asset-discovery.service.js";
import { Types } from "mongoose";
import { llm } from "./ollama.service.js";

/**
 * Creates secured agent tools bound to verified user and campaign context
 */
export function createProductionAgentTools({ user, campaignId, workspaceId }) {
  // Validate campaignId format
  const campaignObjectId = new Types.ObjectId(campaignId);

  // Tool A: inspectDeliverables
  const inspectDeliverablesTool = tool(
    async ({ campaignId: paramCampaignId }) => {
      // Security: verify requested campaignId matches server-authenticated context
      if (paramCampaignId && paramCampaignId !== campaignId.toString()) {
        throw new Error("Unauthorized: Tool cannot query campaigns outside current session context.");
      }

      const campaign = await CampaignModel.findById(campaignObjectId).lean();
      if (!campaign) {
        throw new Error("Campaign not found");
      }

      // Check current submitted or active version
      const activeVersion = await VersionModel.findOne({
        campaign: campaignObjectId,
      })
        .sort({ versionNumber: -1 })
        .lean();

      // Check active brief
      const activeBrief = await BriefModel.findOne({
        campaign: campaignObjectId,
        status: "ACTIVE",
      }).lean();

      const deliverables = campaign.deliverables || [];
      const completed = deliverables.filter((d) => d.isCompleted);
      const pending = deliverables.filter((d) => !d.isCompleted);

      // Check for required sponsor text elements
      const requiredSponsorTexts = deliverables
        .map((d) => d.sponsorTextRequired)
        .filter(Boolean);

      let sponsorTextFindings = [];
      if (requiredSponsorTexts.length > 0) {
        for (const reqText of requiredSponsorTexts) {
          const isPresentInScript = activeVersion?.scriptContent
            ? activeVersion.scriptContent.toLowerCase().includes(reqText.toLowerCase())
            : false;

          sponsorTextFindings.push({
            requiredText: reqText,
            isIncludedInActiveVersion: isPresentInScript,
            status: isPresentInScript ? "COMPLIANT" : "MISSING_FROM_SCRIPT",
          });
        }
      }

      return {
        campaignName: campaign.name,
        clientName: campaign.clientName,
        totalDeliverables: deliverables.length,
        completedDeliverables: completed.map((d) => d.title),
        missingDeliverables: pending.map((d) => ({
          title: d.title,
          format: d.format,
          requirements: d.requirements,
        })),
        sponsorTextRequirements: sponsorTextFindings,
        activeVersionStatus: activeVersion
          ? {
              versionNumber: `v${activeVersion.versionNumber}`,
              submissionStatus: activeVersion.submissionStatus,
              isApproved: activeVersion.submissionStatus === "APPROVED",
            }
          : "No version submitted yet",
        activeBriefRevision: activeBrief ? `v${activeBrief.revisionNumber}` : "None",
      };
    },
    {
      name: "inspectDeliverables",
      description:
        "Inspect deliverables, completed vs missing items, sponsor text requirements, and approval status for a campaign.",
      schema: z.object({
        campaignId: z
          .string()
          .describe("The verified campaign ID to inspect deliverables for"),
      }),
    }
  );

  // Tool B: checkAssetRights
  const checkAssetRightsTool = tool(
    async ({ assetIds, publicationDate, channel }) => {
      const pubDate = publicationDate ? new Date(publicationDate) : new Date();

      // Query only assets belonging to this verified campaign
      let query = { campaign: campaignObjectId };
      if (assetIds && assetIds.length > 0) {
        query._id = { $in: assetIds.map((id) => new Types.ObjectId(id)) };
      }

      const assets = await AssetModel.find(query).lean();

      const results = assets.map((asset) => {
        const assessment = checkAssetUsageRights(asset, pubDate, channel);
        return {
          assetId: asset._id,
          title: asset.title,
          assetType: asset.assetType,
          owner: assessment.owner,
          isUsable: assessment.isUsable,
          status: assessment.status,
          licenseStartDate: assessment.licenseStartDate,
          licenseEndDate: assessment.licenseEndDate,
          allowedChannels: assessment.allowedChannels,
          restrictions: assessment.restrictions,
          issues: assessment.issues,
        };
      });

      const usableCount = results.filter((r) => r.isUsable).length;
      const unusableCount = results.filter((r) => !r.isUsable).length;

      return {
        evaluatedForDate: pubDate.toISOString().split("T")[0],
        evaluatedForChannel: channel || "All permitted",
        totalAssetsEvaluated: results.length,
        usableCount,
        unusableCount,
        assets: results,
      };
    },
    {
      name: "checkAssetRights",
      description:
        "Verify ownership, license validity, expiry dates, and usage restrictions for assets at a proposed publication date.",
      schema: z.object({
        assetIds: z
          .array(z.string())
          .optional()
          .describe("Optional specific asset IDs to evaluate; if omitted, checks all campaign assets"),
        publicationDate: z
          .string()
          .optional()
          .describe("Proposed target delivery or publication date in YYYY-MM-DD format"),
        channel: z
          .string()
          .optional()
          .describe("Target distribution channel, e.g. YouTube, Podcast, Instagram"),
      }),
    }
  );

  // Tool C: readProductionSchedule
  const readProductionScheduleTool = tool(
    async ({ targetDeadline }) => {
      const deadline = targetDeadline ? new Date(targetDeadline) : null;

      const tasks = await TaskModel.find({
        campaign: campaignObjectId,
      })
        .populate("assignedTo", "name email")
        .sort({ dueDate: 1 })
        .lean();

      const overdueTasks = [];
      const pendingTasks = [];
      const completedTasks = [];
      const scheduleConflicts = [];

      const now = new Date();

      for (const t of tasks) {
        if (t.status === "DONE") {
          completedTasks.push({ title: t.title, dueDate: t.dueDate });
        } else {
          const item = {
            id: t._id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assignedTo: t.assignedTo?.name || "Unassigned",
            dueDate: t.dueDate,
          };
          pendingTasks.push(item);

          if (t.dueDate < now) {
            overdueTasks.push(item);
          }

          if (deadline && t.dueDate > deadline) {
            scheduleConflicts.push({
              taskTitle: t.title,
              taskDueDate: t.dueDate,
              conflict: `Task due date is after requested delivery deadline (${deadline.toISOString().split("T")[0]}).`,
            });
          }
        }
      }

      return {
        campaignId,
        targetDeadline: deadline ? deadline.toISOString().split("T")[0] : "Not specified",
        totalTasks: tasks.length,
        completedCount: completedTasks.length,
        pendingCount: pendingTasks.length,
        overdueTasks,
        pendingTasks,
        scheduleConflicts,
      };
    },
    {
      name: "readProductionSchedule",
      description:
        "Examine team task assignments, pending tasks, deadlines, dependencies, and conflicts against a target deadline.",
      schema: z.object({
        targetDeadline: z
          .string()
          .optional()
          .describe("Proposed deadline date in YYYY-MM-DD format to check for scheduling conflicts"),
      }),
    }
  );

  return [inspectDeliverablesTool, checkAssetRightsTool, readProductionScheduleTool];
}

/**
 * Execute feasibility analysis for campaign delivery ("Can we deliver this campaign by Friday?")
 */
export async function runProductionFeasibilityAgent({
  user,
  campaignId,
  targetDate,
  userQuery = "Can we deliver this campaign by Friday?",
}) {
  const tools = createProductionAgentTools({
    user,
    campaignId,
    workspaceId: user.workspaceId,
  });

  const toolExecutions = [];

  // 1. Tool A: inspectDeliverables
  let deliverablesResult;
  try {
    deliverablesResult = await tools[0].invoke({ campaignId: campaignId.toString() });
    toolExecutions.push({
      toolName: "inspectDeliverables",
      status: "SUCCESS",
      input: { campaignId: campaignId.toString() },
      output: deliverablesResult,
    });
  } catch (err) {
    toolExecutions.push({
      toolName: "inspectDeliverables",
      status: "FAILED",
      error: err.message,
    });
  }

  // 2. Tool B: checkAssetRights for target delivery date
  let assetRightsResult;
  try {
    assetRightsResult = await tools[1].invoke({
      publicationDate: targetDate ? targetDate.toISOString().split("T")[0] : undefined,
    });
    toolExecutions.push({
      toolName: "checkAssetRights",
      status: "SUCCESS",
      input: { publicationDate: targetDate?.toISOString().split("T")[0] },
      output: assetRightsResult,
    });
  } catch (err) {
    toolExecutions.push({
      toolName: "checkAssetRights",
      status: "FAILED",
      error: err.message,
    });
  }

  // 3. Tool C: readProductionSchedule
  let scheduleResult;
  try {
    scheduleResult = await tools[2].invoke({
      targetDeadline: targetDate ? targetDate.toISOString().split("T")[0] : undefined,
    });
    toolExecutions.push({
      toolName: "readProductionSchedule",
      status: "SUCCESS",
      input: { targetDeadline: targetDate?.toISOString().split("T")[0] },
      output: scheduleResult,
    });
  } catch (err) {
    toolExecutions.push({
      toolName: "readProductionSchedule",
      status: "FAILED",
      error: err.message,
    });
  }

  // Determine specific critical issues
  const blockers = [];
  const warnings = [];

  // Check sponsor text missing
  const missingSponsorTexts = (deliverablesResult?.sponsorTextRequirements || []).filter(
    (st) => st.status === "MISSING_FROM_SCRIPT"
  );
  if (missingSponsorTexts.length > 0) {
    blockers.push({
      category: "SPONSOR_COMPLIANCE",
      title: "Missing Required Sponsor Text",
      detail: `Required sponsor text "${missingSponsorTexts.map((m) => m.requiredText).join(", ")}" is missing from the active script/version.`,
    });
  }

  // Check expired asset rights (especially music/audio/video)
  const expiredAssets = (assetRightsResult?.assets || []).filter((a) => !a.isUsable);
  if (expiredAssets.length > 0) {
    for (const ea of expiredAssets) {
      blockers.push({
        category: "ASSET_RIGHTS",
        title: `Asset Rights Expired / Restricted: ${ea.title} (${ea.assetType})`,
        detail: ea.issues.join(" ") || "License expired or restricted for target date.",
        assetId: ea.assetId,
      });
    }
  }

  // Check schedule conflicts
  if (scheduleResult?.scheduleConflicts?.length > 0) {
    for (const sc of scheduleResult.scheduleConflicts) {
      warnings.push({
        category: "SCHEDULE_CONFLICT",
        title: sc.taskTitle,
        detail: sc.conflict,
      });
    }
  }

  // Check pending brand approval
  if (deliverablesResult?.activeVersionStatus?.isApproved === false) {
    warnings.push({
      category: "APPROVAL_PENDING",
      title: "Brand Reviewer Approval Pending",
      detail: `Current version ${deliverablesResult.activeVersionStatus.versionNumber} is in status '${deliverablesResult.activeVersionStatus.submissionStatus}' and has not been approved by the brand reviewer.`,
    });
  }

  const isDeliverableOnTime = blockers.length === 0 && warnings.length === 0;

  // Propose corrective tasks
  const proposedTasks = [];
  if (missingSponsorTexts.length > 0) {
    proposedTasks.push({
      title: "Integrate required sponsor text into script and re-render",
      description: `Add "${missingSponsorTexts[0].requiredText}" to the script and submit a new revision.`,
      priority: "URGENT",
      suggestedDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    });
  }

  if (expiredAssets.length > 0) {
    proposedTasks.push({
      title: `Replace expired asset "${expiredAssets[0].title}" with licensed alternative`,
      description: `The asset license expired. Find or license an active replacement asset before finalizing production.`,
      priority: "URGENT",
      suggestedDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    });
  }

  proposedTasks.push({
    title: "Request brand reviewer sign-off on updated version",
    description: "Submit corrected version to the Brand Reviewer for formal decision.",
    priority: "HIGH",
    suggestedDueDate: targetDate ? targetDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
  });

  // Synthesize LLM assessment
  const synthesisPrompt = `You are the Senior AI Production Agent for Creator Campaign Production Desk.
Analyze the following tool inspection results for a campaign delivery query: "${userQuery}".

TOOL EXECUTION DATA:
1. Deliverables Inspection:
${JSON.stringify(deliverablesResult, null, 2)}

2. Asset Rights Assessment:
${JSON.stringify(assetRightsResult, null, 2)}

3. Production Schedule & Deadlines:
${JSON.stringify(scheduleResult, null, 2)}

DETECTED CRITICAL BLOCKERS:
${JSON.stringify(blockers, null, 2)}

DETECTED WARNINGS / RISKS:
${JSON.stringify(warnings, null, 2)}

RULES:
1. Answer clearly whether the campaign can be delivered on time (e.g. by Friday).
2. Explicitly highlight any expired asset licenses (especially music licenses) and missing sponsor text.
3. Explicitly state that AI CANNOT approve content or override client decisions.
4. Detail the recommended corrective task sequence.
5. Remind the producer to review and confirm the proposed task changes before they are applied.`;

  let aiAnswer = "";
  try {
    const aiResponse = await llm.invoke([
      ["system", "You are an expert production assistant. Be direct, authoritative, structured, and factual."],
      ["human", synthesisPrompt],
    ]);
    aiAnswer = aiResponse.content.trim();
  } catch (err) {
    // Factual fallback if LLM offline
    aiAnswer = `### Feasibility Assessment: ${isDeliverableOnTime ? "ON TRACK" : "AT RISK / CANNOT DELIVER WITHOUT FIXES"}

Based on inspection of the campaign deliverables, asset licenses, and schedule:
${blockers.map((b) => `- **[BLOCKER] ${b.title}**: ${b.detail}`).join("\n")}
${warnings.map((w) => `- **[RISK] ${w.title}**: ${w.detail}`).join("\n")}

**Corrective Actions Required:**
1. Replace any expired music or media assets with licensed alternatives.
2. Update the script to include all mandatory sponsor claims and discount codes.
3. Submit a new version for explicit Brand Reviewer sign-off.`;
  }

  return {
    feasible: isDeliverableOnTime,
    verdict: isDeliverableOnTime ? "DELIVERY_ON_TRACK" : "DELIVERY_AT_RISK",
    blockers,
    warnings,
    aiAnswer,
    toolExecutions,
    proposedTasks,
    requiresProducerConfirmation: true,
  };
}
