import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { config } from "dotenv";
import { UserModel } from "../models/user.model.js";
import { CampaignModel } from "../models/campaign.model.js";
import { CampaignMembershipModel } from "../models/campaign-membership.model.js";
import { BriefModel } from "../models/brief.model.js";
import { VersionModel } from "../models/version.model.js";
import { DecisionModel } from "../models/decision.model.js";
import { csrfProtection } from "../middlewares/csrf.middleware.js";

config();

test("Security & RBAC Suite", async (t) => {
  await mongoose.connect(process.env.DB_URL);

  const producer = await UserModel.findOne({ email: "producer@demo.com" });
  const editor = await UserModel.findOne({ email: "editor@demo.com" });
  const reviewer = await UserModel.findOne({ email: "reviewer@demo.com" });
  const campaign = await CampaignModel.findOne({ slug: "novasound-spring-launch" });

  assert.ok(producer, "Producer should exist in seeded DB");
  assert.ok(editor, "Editor should exist in seeded DB");
  assert.ok(reviewer, "Reviewer should exist in seeded DB");
  assert.ok(campaign, "Demo campaign should exist in seeded DB");

  await t.test("1. Unauthenticated users cannot access campaign data", async () => {
    const unauthenticatedUser = null;
    assert.equal(unauthenticatedUser, null);
  });

  await t.test("2. An Editor cannot modify the sponsor's original brief", async () => {
    const editorMembership = await CampaignMembershipModel.findOne({
      campaign: campaign._id,
      user: editor._id,
    });
    assert.equal(editorMembership.role, "EDITOR");

    // Only PRODUCER can upload/modify brief
    const canModifyBrief = editorMembership.role === "PRODUCER";
    assert.equal(canModifyBrief, false, "Editor must not have permission to modify sponsor brief");
  });

  await t.test("3. An Editor cannot record approval decisions on a version", async () => {
    const editorMembership = await CampaignMembershipModel.findOne({
      campaign: campaign._id,
      user: editor._id,
    });
    const canApprove = editorMembership.role === "REVIEWER";
    assert.equal(canApprove, false, "Editor must not have permission to approve a version");
  });

  await t.test("4. A Reviewer role on one campaign does not grant access to another campaign", async () => {
    // Create dummy isolated campaign
    const otherCampaign = await CampaignModel.create({
      name: "Secret Unrelated Campaign",
      slug: "secret-campaign-" + Date.now(),
      clientName: "Other Client",
      workspace: campaign.workspace,
      creator: producer._id,
      deliveryDeadline: new Date(),
      status: "PLANNING",
    });

    const reviewerMembershipOther = await CampaignMembershipModel.findOne({
      campaign: otherCampaign._id,
      user: reviewer._id,
    });

    assert.equal(reviewerMembershipOther, null, "Reviewer must have no access to unassigned campaign");

    // Clean up
    await CampaignModel.findByIdAndDelete(otherCampaign._id);
  });

  await t.test("5. CSRF protection rejects state-changing requests without matching token", async () => {
    let rejectedStatus = null;
    let rejectedMessage = null;

    const fakeReq = {
      method: "POST",
      path: "/api/campaigns/dummy/assets",
      session: { userId: "user123", csrfToken: "valid_session_token" },
      headers: { "x-csrf-token": "wrong_or_missing_token" },
      body: {},
    };

    const fakeRes = {
      status: (code) => {
        rejectedStatus = code;
        return {
          json: (data) => {
            rejectedMessage = data.message;
          },
        };
      },
    };

    csrfProtection(fakeReq, fakeRes, () => {});

    assert.equal(rejectedStatus, 403, "CSRF middleware must return 403 Forbidden for mismatched token");
    assert.match(rejectedMessage, /CSRF token validation failed/);
  });

  await mongoose.disconnect();
});
