import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { config } from "dotenv";
import { AssetModel } from "../models/asset.model.js";
import { CampaignModel } from "../models/campaign.model.js";
import { checkAssetUsageRights, searchAssetsSemantic } from "../services/asset-discovery.service.js";

config();

test("Asset Rights & Semantic Discovery Suite", async (t) => {
  await mongoose.connect(process.env.DB_URL);

  const campaign = await CampaignModel.findOne({ slug: "novasound-spring-launch" });
  assert.ok(campaign);

  const videoAsset = await AssetModel.findOne({
    campaign: campaign._id,
    title: /4K Product B-Roll/,
  });
  const expiredMusicAsset = await AssetModel.findOne({
    campaign: campaign._id,
    title: /Electro Synthwave Intro/,
  });

  assert.ok(videoAsset, "Video asset should exist");
  assert.ok(expiredMusicAsset, "Expired music asset should exist");

  await t.test("1. Active video asset is marked USABLE", () => {
    const rights = checkAssetUsageRights(videoAsset, new Date(), "YouTube");
    assert.equal(rights.isUsable, true);
    assert.equal(rights.status, "USABLE");
    assert.equal(rights.issues.length, 0);
  });

  await t.test("2. Expired music asset is strictly marked EXPIRED_OR_RESTRICTED", () => {
    const rights = checkAssetUsageRights(expiredMusicAsset, new Date(), "YouTube");
    assert.equal(rights.isUsable, false, "Expired asset must not be marked usable");
    assert.equal(rights.status, "EXPIRED_OR_RESTRICTED");
    assert.ok(rights.issues.length > 0, "Must report licensing expiry issue");
  });

  await t.test("3. Semantic search surfaces both assets but flags expired asset as unusable", async () => {
    const searchResults = await searchAssetsSemantic({
      campaignId: campaign._id,
      query: "energetic music intro soundtrack",
      targetDate: new Date(),
    });

    assert.ok(searchResults.length > 0);
    const musicMatch = searchResults.find((a) => a.title.includes("Synthwave"));
    assert.ok(musicMatch, "Should find the music asset");
    assert.equal(
      musicMatch.rightsAssessment.isUsable,
      false,
      "Semantic similarity match must not grant permission to reuse expired asset"
    );
  });

  await mongoose.disconnect();
});
