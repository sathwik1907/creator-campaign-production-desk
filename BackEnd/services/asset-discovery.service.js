import { AssetModel } from "../models/asset.model.js";
import { generateEmbeddingVector } from "./rag.service.js";
import { Types } from "mongoose";

/**
 * Computes cosine similarity between two numeric vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generates an embedding for an asset based on its metadata
 */
export async function generateAssetEmbedding(asset) {
  const textToEmbed = [
    asset.title,
    asset.caption || "",
    (asset.tags || []).join(" "),
    asset.assetType,
    asset.usageRights?.owner || "",
    asset.usageRights?.restrictions || "",
  ]
    .filter(Boolean)
    .join(" ");

  return generateEmbeddingVector(textToEmbed);
}

/**
 * Validates whether an asset is usable for a specified publication date and channel.
 */
export function checkAssetUsageRights(asset, targetDate = new Date(), targetChannel = null) {
  const pubDate = new Date(targetDate);
  const rights = asset.usageRights || {};

  const issues = [];
  let isUsable = true;

  // 1. Explicit expired flag
  if (rights.isExpired) {
    isUsable = false;
    issues.push("Asset license is explicitly marked as expired.");
  }

  // 2. License start date check
  if (rights.licenseStartDate && pubDate < new Date(rights.licenseStartDate)) {
    isUsable = false;
    issues.push(`License is not yet active. Active from ${new Date(rights.licenseStartDate).toISOString().split("T")[0]}.`);
  }

  // 3. License end date check
  if (rights.licenseEndDate && pubDate > new Date(rights.licenseEndDate)) {
    isUsable = false;
    issues.push(`License expired on ${new Date(rights.licenseEndDate).toISOString().split("T")[0]}.`);
  }

  // 4. Channel permission check
  if (targetChannel && rights.allowedChannels && rights.allowedChannels.length > 0) {
    const isChannelPermitted = rights.allowedChannels.some((ch) =>
      ch.toLowerCase().includes(targetChannel.toLowerCase())
    );
    if (!isChannelPermitted) {
      isUsable = false;
      issues.push(`Channel '${targetChannel}' is not permitted. Permitted channels: ${rights.allowedChannels.join(", ")}.`);
    }
  }

  // 5. Asset approval status
  if (asset.approvalStatus === "REJECTED") {
    isUsable = false;
    issues.push("Asset has been rejected by brand reviewer.");
  }

  return {
    isUsable,
    status: isUsable ? "USABLE" : "EXPIRED_OR_RESTRICTED",
    licenseStartDate: rights.licenseStartDate,
    licenseEndDate: rights.licenseEndDate,
    allowedChannels: rights.allowedChannels || [],
    restrictions: rights.restrictions || "None",
    requiredAttribution: rights.requiredAttribution || "",
    owner: rights.owner || "Client",
    issues,
  };
}

/**
 * Semantically search assets within the authorized campaign
 */
export async function searchAssetsSemantic({
  campaignId,
  query,
  assetType = null,
  targetDate = new Date(),
  targetChannel = null,
  limit = 10,
}) {
  const campaignObjectId = new Types.ObjectId(campaignId);
  const queryVector = await generateEmbeddingVector(query);

  const filter = { campaign: campaignObjectId };
  if (assetType) filter.assetType = assetType;

  // Retrieve assets for this campaign
  const assets = await AssetModel.find(filter).lean();

  const scoredAssets = assets.map((asset) => {
    let score = 0;
    if (asset.embedding && asset.embedding.length > 0) {
      score = cosineSimilarity(queryVector, asset.embedding);
    } else {
      // Keyword fallback match score
      const text = `${asset.title} ${asset.caption} ${(asset.tags || []).join(" ")}`.toLowerCase();
      const q = query.toLowerCase();
      score = text.includes(q) ? 0.7 : 0.2;
    }

    const rightsAssessment = checkAssetUsageRights(asset, targetDate, targetChannel);

    return {
      _id: asset._id,
      campaignId: asset.campaign,
      title: asset.title,
      originalFilename: asset.originalFilename,
      assetType: asset.assetType,
      caption: asset.caption,
      tags: asset.tags,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType,
      approvalStatus: asset.approvalStatus,
      similarityScore: score,
      rightsAssessment,
    };
  });

  scoredAssets.sort((a, b) => b.similarityScore - a.similarityScore);
  return scoredAssets.slice(0, limit);
}
