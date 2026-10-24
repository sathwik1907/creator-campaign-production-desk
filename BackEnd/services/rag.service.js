import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChunkModel } from "../models/chunk.model.js";
import { BriefModel } from "../models/brief.model.js";
import { Types } from "mongoose";
import { llm as chatClient, embeddings as embeddingClient } from "./ollama.service.js";

/**
 * Generate embedding vector for query or text
 */
export async function generateEmbeddingVector(text) {
  if (!text || typeof text !== "string" || text.trim() === "") {
    throw new Error("A non-empty string is required to generate embedding");
  }
  return embeddingClient.embedQuery(text.trim());
}

/**
 * Split brief content into structured chunks with section detection
 */
export async function chunkBriefText(extractedText, sourceSections = []) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 600,
    chunkOverlap: 100,
  });

  const chunks = [];

  // If structured sections were parsed, chunk each section separately
  if (sourceSections && sourceSections.length > 0) {
    for (const section of sourceSections) {
      const sectionChunks = await splitter.splitText(section.content);
      for (const [idx, chunkText] of sectionChunks.entries()) {
        chunks.push({
          chunkText: chunkText.trim(),
          sectionTitle: section.sectionTitle || "Main Content",
          pageNumber: section.page || 1,
          sectionIndex: idx,
        });
      }
    }
  } else {
    // Split the raw extracted text
    const rawChunks = await splitter.splitText(extractedText);
    for (const [idx, chunkText] of rawChunks.entries()) {
      chunks.push({
        chunkText: chunkText.trim(),
        sectionTitle: "Brief Document",
        pageNumber: 1,
        sectionIndex: idx,
      });
    }
  }

  return chunks;
}

/**
 * Helper to compute cosine similarity between two vectors
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
 * Ingest chunks and embeddings for a brief document
 */
export async function ingestBriefDocument({
  campaignId,
  workspaceId,
  briefId,
  revisionNumber,
  extractedText,
  sourceSections = [],
}) {
  const parsedChunks = await chunkBriefText(extractedText, sourceSections);

  const chunkDocuments = [];
  for (const [index, item] of parsedChunks.entries()) {
    const embedding = await generateEmbeddingVector(item.chunkText);
    chunkDocuments.push({
      campaignId: new Types.ObjectId(campaignId),
      workspaceId: new Types.ObjectId(workspaceId),
      briefId: new Types.ObjectId(briefId),
      revisionNumber,
      sectionTitle: item.sectionTitle,
      pageNumber: item.pageNumber,
      chunkText: item.chunkText,
      chunkIndex: index,
      embedding,
      metadata: {
        ingestedAt: new Date(),
      },
    });
  }

  const createdChunks = await ChunkModel.insertMany(chunkDocuments);
  return createdChunks;
}

/**
 * Retrieve relevant chunks scoped strictly to the authorized campaign.
 * Tries Atlas $vectorSearch first; falls back to in-memory cosine similarity if index is pending.
 */
export async function searchBriefChunks({
  campaignId,
  query,
  limit = 5,
  revisionNumber = null,
}) {
  const campaignObjectId = new Types.ObjectId(campaignId);
  const queryVector = await generateEmbeddingVector(query);

  let results = [];

  try {
    const filter = { campaignId: campaignObjectId };
    if (revisionNumber) {
      filter.revisionNumber = revisionNumber;
    }

    results = await ChunkModel.aggregate([
      {
        $vectorSearch: {
          index: "rag_vector_index",
          path: "embedding",
          queryVector: queryVector,
          numCandidates: 100,
          limit,
          filter,
        },
      },
      {
        $project: {
          _id: 1,
          campaignId: 1,
          briefId: 1,
          revisionNumber: 1,
          sectionTitle: 1,
          pageNumber: 1,
          chunkText: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);
  } catch (atlasVectorError) {
    // Fallback: fetch campaign chunks and compute cosine similarity
    const queryFilter = { campaignId: campaignObjectId };
    if (revisionNumber) queryFilter.revisionNumber = revisionNumber;

    const allChunks = await ChunkModel.find(queryFilter).lean();
    const scoredChunks = allChunks.map((chunk) => {
      const score = cosineSimilarity(queryVector, chunk.embedding);
      return {
        _id: chunk._id,
        campaignId: chunk.campaignId,
        briefId: chunk.briefId,
        revisionNumber: chunk.revisionNumber,
        sectionTitle: chunk.sectionTitle,
        pageNumber: chunk.pageNumber,
        chunkText: chunk.chunkText,
        score,
      };
    });

    scoredChunks.sort((a, b) => b.score - a.score);
    results = scoredChunks.slice(0, limit);
  }

  // Populate brief details for accurate citations
  const populatedResults = [];
  for (const item of results) {
    const brief = await BriefModel.findById(item.briefId).select("title revisionNumber originalFilename");
    populatedResults.push({
      ...item,
      briefTitle: brief?.title || "Campaign Brief",
      briefRevision: item.revisionNumber || brief?.revisionNumber || 1,
    });
  }

  return populatedResults;
}

/**
 * Generate a cited answer for a user's question about an authorized campaign brief.
 */
export async function answerBriefQuestion({ campaignId, query, revisionNumber = null }) {
  const retrievedChunks = await searchBriefChunks({
    campaignId,
    query,
    limit: 5,
    revisionNumber,
  });

  const relevantChunks = retrievedChunks.filter(
    (c) => c.chunkText && c.score >= 0.4
  );

  if (relevantChunks.length === 0) {
    return {
      answer:
        "The uploaded brief does not contain enough information to answer this question. Please ask the brand reviewer to clarify.",
      citations: [],
      retrievedChunks: [],
    };
  }

  // Check if multiple brief revisions were retrieved and contain conflicting instructions
  const distinctRevisions = [...new Set(relevantChunks.map((c) => c.briefRevision))];
  const hasMultipleRevisions = distinctRevisions.length > 1;

  const contextText = relevantChunks
    .map(
      (chunk, i) =>
        `[Source ${i + 1}] (Brief: "${chunk.briefTitle}", Revision: v${chunk.briefRevision}, Section: "${chunk.sectionTitle}", Page: ${chunk.pageNumber})\n${chunk.chunkText}`
    )
    .join("\n\n");

  const systemPrompt = `You are the Campaign Brief Intelligence assistant for Creator Campaign Production Desk.
Your task is to answer questions about the sponsor's requirements using ONLY the provided brief context.

STRICT RULES:
1. Use only the facts directly stated in the supplied Brief Context.
2. Never invent or hallucinate requirements, claims, dates, discount codes, or permissions.
3. If the context does not contain enough information to fully answer the question, state:
"The uploaded brief does not contain enough information to answer this question. Please ask the brand reviewer to clarify."
4. If there are conflicting instructions across different brief revisions (e.g., Revision v1 vs Revision v2), explicitly identify the conflict and cite both revisions.
5. Provide a clear, professional answer citing the relevant sections.`;

  const userMessage = `BRIEF CONTEXT:
${contextText}

${hasMultipleRevisions ? "NOTE: Multiple brief revisions are present. Compare them carefully for any changes or conflicts.\n" : ""}
USER QUESTION:
${query}`;

  const response = await chatClient.invoke([
    ["system", systemPrompt],
    ["human", userMessage],
  ]);

  const citations = relevantChunks.map((chunk) => ({
    briefTitle: chunk.briefTitle,
    revision: chunk.briefRevision,
    sectionTitle: chunk.sectionTitle,
    page: chunk.pageNumber,
    excerpt: chunk.chunkText.slice(0, 180) + "...",
  }));

  return {
    answer: response.content.trim(),
    citations,
    retrievedChunks: relevantChunks,
  };
}
