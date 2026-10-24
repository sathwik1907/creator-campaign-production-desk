import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { config } from "dotenv";
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../models/user.model.js";
import { runProductionFeasibilityAgent } from "../services/agent.service.js";
import { answerBriefQuestion } from "../services/rag.service.js";

config();

test("Production Agent & Brief RAG Suite", async (t) => {
  await mongoose.connect(process.env.DB_URL);

  const campaign = await CampaignModel.findOne({ slug: "novasound-spring-launch" });
  const producer = await UserModel.findOne({ email: "producer@demo.com" });

  assert.ok(campaign);
  assert.ok(producer);

  await t.test("1. Brief RAG retrieves accurate context or returns standard fallback", async () => {
    // Query for mandatory sponsor claims
    const ragResult = await answerBriefQuestion({
      campaignId: campaign._id,
      query: "What is the mandatory discount code and battery life claim?",
    });

    assert.ok(ragResult.answer, "RAG answer should be produced");
    assert.ok(Array.isArray(ragResult.citations));

    // Non-existent info test
    const missingInfoResult = await answerBriefQuestion({
      campaignId: campaign._id,
      query: "What is the sponsor's policy on interstellar space travel and warp drive warranty?",
    });

    assert.match(
      missingInfoResult.answer,
      /The uploaded brief does not contain enough information|clarify/i,
      "Must return graceful fallback message when information is missing"
    );
  });

  await t.test("2. Feasibility Agent detects expired music license and missing sponsor text", async () => {
    const assessment = await runProductionFeasibilityAgent({
      user: producer,
      campaignId: campaign._id,
      userQuery: "Can we deliver this campaign by Friday?",
    });

    assert.equal(assessment.feasible, false, "Campaign cannot be delivered on time due to blockers");
    assert.equal(assessment.verdict, "DELIVERY_AT_RISK");

    // Check detected blockers
    const hasSponsorTextBlocker = assessment.blockers.some(
      (b) => b.category === "SPONSOR_COMPLIANCE"
    );
    assert.ok(hasSponsorTextBlocker, "Agent MUST detect missing sponsor text requirement");

    const hasExpiredAssetBlocker = assessment.blockers.some(
      (b) => b.category === "ASSET_RIGHTS"
    );
    assert.ok(hasExpiredAssetBlocker, "Agent MUST detect expired asset license");

    // Check tool execution tracking
    assert.equal(assessment.toolExecutions.length, 3, "Agent must execute all 3 secured tools");
    assert.ok(
      assessment.toolExecutions.every((t) => t.status === "SUCCESS"),
      "All tool executions should be verified and successful"
    );

    // Check producer confirmation requirement
    assert.equal(
      assessment.requiresProducerConfirmation,
      true,
      "AI proposed tasks MUST require explicit producer confirmation before applying"
    );
    assert.ok(assessment.proposedTasks.length > 0, "Agent must propose corrective tasks");
  });

  await mongoose.disconnect();
});
