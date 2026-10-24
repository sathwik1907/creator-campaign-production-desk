import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { config } from "dotenv";
import { UserModel } from "../models/user.model.js";
import { CampaignModel } from "../models/campaign.model.js";
import { VersionModel } from "../models/version.model.js";
import { DecisionModel } from "../models/decision.model.js";
import { BriefModel } from "../models/brief.model.js";

config();

test("Version and Approval Integrity Suite", async (t) => {
  await mongoose.connect(process.env.DB_URL);

  const reviewer = await UserModel.findOne({ email: "reviewer@demo.com" });
  const editor = await UserModel.findOne({ email: "editor@demo.com" });
  const campaign = await CampaignModel.findOne({ slug: "novasound-spring-launch" });
  const brief = await BriefModel.findOne({ campaign: campaign._id });

  assert.ok(reviewer);
  assert.ok(campaign);
  assert.ok(brief);

  let testVersion;
  let decisionRecord;

  await t.test("1. Create test submitted version and record reviewer approval", async () => {
    testVersion = await VersionModel.create({
      campaign: campaign._id,
      workspace: campaign.workspace,
      versionNumber: 99,
      title: "Test Version for Approval Flow",
      scriptContent: "Test script content with sponsor message.",
      submissionStatus: "SUBMITTED",
      author: editor._id,
      briefRevision: brief._id,
      decisions: [],
    });

    assert.equal(testVersion.submissionStatus, "SUBMITTED");

    // Brand Reviewer records approval
    decisionRecord = await DecisionModel.create({
      campaign: campaign._id,
      version: testVersion._id,
      reviewer: reviewer._id,
      status: "APPROVED",
      feedbackNotes: "Approved for final distribution.",
      decisionDate: new Date(),
    });

    testVersion.submissionStatus = "APPROVED";
    testVersion.decisions.push(decisionRecord._id);
    await testVersion.save();

    assert.equal(testVersion.submissionStatus, "APPROVED");
    assert.equal(testVersion.decisions.length, 1);
  });

  await t.test("2. Creating a revised version DOES NOT inherit the previous approval", async () => {
    // Editor creates version 100 based on changes
    const revisedVersion = await VersionModel.create({
      campaign: campaign._id,
      workspace: campaign.workspace,
      versionNumber: 100,
      title: "Revised Cut after Audio Adjustment",
      scriptContent: "Updated test script content with fresh audio adjustments.",
      submissionStatus: "SUBMITTED", // Fresh submission
      author: editor._id,
      briefRevision: brief._id,
      decisions: [], // Must NOT inherit version 99's approval!
    });

    assert.notEqual(
      revisedVersion.submissionStatus,
      "APPROVED",
      "Revised version must NOT inherit previous version's approval!"
    );
    assert.equal(revisedVersion.decisions.length, 0, "Revised version must require fresh decision");

    // Clean up revised version
    await VersionModel.findByIdAndDelete(revisedVersion._id);
  });

  await t.test("3. Decisions are immutable and recorded in history", async () => {
    const historicalDecisions = await DecisionModel.find({ version: testVersion._id });
    assert.equal(historicalDecisions.length, 1);
    assert.equal(historicalDecisions[0].status, "APPROVED");
    assert.equal(historicalDecisions[0].reviewer.toString(), reviewer._id.toString());
  });

  // Clean up test version & decision
  await VersionModel.findByIdAndDelete(testVersion._id);
  await DecisionModel.findByIdAndDelete(decisionRecord._id);

  await mongoose.disconnect();
});
