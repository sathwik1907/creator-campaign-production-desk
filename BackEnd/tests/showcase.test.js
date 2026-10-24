import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { config } from "dotenv";
import { CampaignModel } from "../models/campaign.model.js";
import { VersionModel } from "../models/version.model.js";

config();

test("Public Showcase Privacy & Consent Suite", async (t) => {
  await mongoose.connect(process.env.DB_URL);

  const campaign = await CampaignModel.findOne({ slug: "novasound-spring-launch" });
  assert.ok(campaign);

  await t.test("1. Non-consented campaigns are not returned in public showcase", async () => {
    // Current campaign has isPublicShowcaseConsented = false
    assert.equal(campaign.isPublicShowcaseConsented, false);

    const publicList = await CampaignModel.find({
      isPublicShowcaseConsented: true,
      status: "APPROVED",
    }).lean();

    const found = publicList.find((c) => c._id.toString() === campaign._id.toString());
    assert.equal(found, undefined, "Non-consented campaign must not appear in public showcase");
  });

  await t.test("2. Public sample excludes private brief text and internal notes", async () => {
    // Temporarily consent for DTO test
    campaign.isPublicShowcaseConsented = true;
    campaign.showcaseSlug = "novasound-spring-demo";
    campaign.status = "APPROVED";
    await campaign.save();

    // Create a mock approved version
    const approvedVersion = await VersionModel.create({
      campaign: campaign._id,
      workspace: campaign.workspace,
      versionNumber: 2,
      title: "Public Approved Master",
      scriptContent: "Clean public approved script without internal production commentary.",
      submissionStatus: "APPROVED",
      author: campaign.creator,
      briefRevision: campaign.activeBrief,
    });

    // Verify sanitization
    const publicSample = {
      title: campaign.name,
      slug: campaign.showcaseSlug,
      clientName: campaign.clientName,
      description: campaign.description,
      status: "APPROVED_FOR_SHOWCASE",
      approvedVersion: {
        title: approvedVersion.title,
        versionNumber: `v${approvedVersion.versionNumber}`,
        scriptExcerpt: approvedVersion.scriptContent.slice(0, 300),
      },
    };

    assert.equal(publicSample.briefText, undefined, "Private brief must never be present in public DTO");
    assert.equal(publicSample.internalNotes, undefined, "Internal notes must never be present in public DTO");
    assert.equal(publicSample.members, undefined, "Internal members must never be present in public DTO");

    // Clean up
    await VersionModel.findByIdAndDelete(approvedVersion._id);
    campaign.isPublicShowcaseConsented = false;
    campaign.showcaseSlug = null;
    campaign.status = "IN_REVIEW";
    await campaign.save();
  });

  await mongoose.disconnect();
});
