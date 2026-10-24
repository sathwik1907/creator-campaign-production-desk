import { ConversationModel } from "../models/conversation.model.js";
import { searchBriefChunks } from "./rag.service.js";
import { searchAssetsSemantic } from "./asset-discovery.service.js";
import { Types } from "mongoose";
import { llm as chatClient } from "./ollama.service.js";

/**
 * Handle campaign-scoped conversational chat
 */
export async function sendCampaignChatMessage({
  campaignId,
  workspaceId,
  userId,
  conversationId,
  message,
}) {
  const campaignObjectId = new Types.ObjectId(campaignId);
  const trimmedMessage = message.trim();

  let conversation;
  if (conversationId && Types.ObjectId.isValid(conversationId)) {
    conversation = await ConversationModel.findOne({
      _id: conversationId,
      campaignId: campaignObjectId,
      userId: new Types.ObjectId(userId),
    });
  }

  if (!conversation) {
    conversation = await ConversationModel.create({
      campaignId: campaignObjectId,
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      title: trimmedMessage.slice(0, 40) + "...",
      messages: [],
    });
  }

  // 1. Retrieve brief context scoped to this campaign
  const briefChunks = await searchBriefChunks({
    campaignId: campaignObjectId,
    query: trimmedMessage,
    limit: 3,
  });

  // 2. Check if the query is asking about assets
  let assetFindings = [];
  const assetKeywords = ["asset", "music", "audio", "video", "clip", "footage", "logo", "photo", "image", "shot"];
  if (assetKeywords.some((k) => trimmedMessage.toLowerCase().includes(k))) {
    assetFindings = await searchAssetsSemantic({
      campaignId: campaignObjectId,
      query: trimmedMessage,
      limit: 3,
    });
  }

  // Assemble context
  const contextParts = [];
  if (briefChunks.length > 0) {
    contextParts.push(
      "RELEVANT BRIEF SECTIONS:\n" +
        briefChunks
          .map((c) => `[${c.briefTitle} v${c.briefRevision} - ${c.sectionTitle}]: ${c.chunkText}`)
          .join("\n\n")
    );
  }

  if (assetFindings.length > 0) {
    contextParts.push(
      "RELEVANT ASSETS IN CAMPAIGN:\n" +
        assetFindings
          .map(
            (a) =>
              `- ${a.title} (${a.assetType}) | Status: ${a.rightsAssessment.status} | Allowed: ${a.rightsAssessment.allowedChannels.join(", ")} | Restrictions: ${a.rightsAssessment.restrictions}`
          )
          .join("\n")
    );
  }

  const systemPrompt = `You are the Campaign Chat assistant for Creator Campaign Production Desk.
You are assisting members of this specific production campaign.

CONTEXT FOR THIS CAMPAIGN:
${contextParts.join("\n\n") || "No specific brief or asset context matched this query."}

RULES:
1. Answer strictly within the scope of this campaign.
2. Ground all answers in the provided context whenever available.
3. If brief or asset details are missing, honestly tell the user what is missing.
4. Keep answers concise, actionable, and professional.`;

  // Build message history
  const historyMessages = (conversation.messages || []).slice(-8).map((m) => [
    m.role === "assistant" ? "ai" : "human",
    m.content,
  ]);

  let aiContent = "";
  try {
    const response = await chatClient.invoke([
      ["system", systemPrompt],
      ...historyMessages,
      ["human", trimmedMessage],
    ]);
    aiContent = response.content.trim();
  } catch (err) {
    aiContent = `I am currently operating in offline mode. Based on campaign records: ${contextParts.join("\n\n") || "No relevant data found for your query."}`;
  }

  const citations = briefChunks.map((c) => ({
    briefTitle: c.briefTitle,
    revision: c.briefRevision,
    sectionTitle: c.sectionTitle,
    page: c.pageNumber,
    excerpt: c.chunkText.slice(0, 160) + "...",
  }));

  // Append user message & assistant response
  conversation.messages.push({
    role: "user",
    content: trimmedMessage,
    timestamp: new Date(),
  });

  conversation.messages.push({
    role: "assistant",
    content: aiContent,
    citations,
    timestamp: new Date(),
  });

  await conversation.save();

  return {
    conversationId: conversation._id,
    answer: aiContent,
    citations,
    assets: assetFindings,
    messages: conversation.messages,
  };
}
