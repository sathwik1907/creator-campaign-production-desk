import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";

const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

export const llm = new ChatOllama({
  model: process.env.OLLAMA_CHAT_MODEL || "qwen3:4b",
  baseUrl,
  temperature: 0,
  maxRetries: 2,
});

export const embeddings = new OllamaEmbeddings({
  model: process.env.OLLAMA_EMBEDDING_MODEL || "qwen3-embedding:4b",
  baseUrl,
});

export const OLLAMA_CONFIG = {
  baseUrl,
  chatModel: process.env.OLLAMA_CHAT_MODEL || "qwen3:4b",
  embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || "qwen3-embedding:4b",
  embeddingDimensions: 2560,
};
