import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import mongoose from "mongoose";
const { connect, connection } = mongoose;
import { config } from "dotenv";

// Import API Routers
import { authRouter } from "./APIs/auth.router.js";
import { workspaceRouter } from "./APIs/workspace.router.js";
import { campaignRouter } from "./APIs/campaign.router.js";
import { briefRouter } from "./APIs/brief.router.js";
import { assetRouter } from "./APIs/asset.router.js";
import { versionRouter } from "./APIs/version.router.js";
import { taskRouter } from "./APIs/task.router.js";
import { commentRouter } from "./APIs/comment.router.js";
import { campaignChatRouter } from "./APIs/campaign-chat.router.js";
import { productionAgentRouter } from "./APIs/production-agent.router.js";
import { showcaseRouter } from "./APIs/showcase.router.js";
import { invitationRouter } from "./APIs/invitation.router.js";

// Import Middlewares
import { csrfProtection } from "./middlewares/csrf.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";

config();

const app = express();
const port = process.env.PORT || 4000;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const dbUrl = process.env.DB_URL;
const sessionSecret = process.env.SESSION_SECRET || "dev_secret_creator_desk_2026";
if (process.env.NODE_ENV === "production") {
  if (!dbUrl) throw new Error("DB_URL must be set in production");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random value of at least 32 characters in production");
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM are required in production for account verification and password reset");
  }
}
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);

// 1. CORS Configuration
app.use(
  cors({
    origin: [frontendUrl, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-csrf-token", "x-xsrf-token", "Authorization"],
  })
);

// 2. Request Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// 3. Persistent Server-Side Sessions with MongoDB Store
if (dbUrl) {
  app.use(
    session({
      name: "creator_desk_sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: dbUrl,
        collectionName: "sessions",
        ttl: 14 * 24 * 60 * 60, // 14 days
      }),
      cookie: {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: process.env.COOKIE_SAME_SITE || "lax",
        maxAge: 14 * 24 * 60 * 60 * 1000,
      },
    })
  );
} else {
  // In-memory fallback if DB_URL not yet passed (e.g. initial setup)
  app.use(
    session({
      name: "creator_desk_sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 14 * 24 * 60 * 60 * 1000,
      },
    })
  );
}

// 4. CSRF Protection Middleware
app.use(csrfProtection);

// 5. Health Check Endpoint
app.get("/api/health", async (req, res) => {
  const dbStatus = connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED";

  let ollamaStatus = "DISCONNECTED";
  let availableModels = [];
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const response = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      const data = await response.json();
      ollamaStatus = "CONNECTED";
      availableModels = (data.models || []).map((m) => m.name);
    }
  } catch (e) {
    ollamaStatus = "UNAVAILABLE";
  }

  res.status(dbStatus === "CONNECTED" ? 200 : 503).json({
    status: dbStatus === "CONNECTED" ? "OK" : "DEGRADED",
    service: "Creator Campaign Production Desk API",
    timestamp: new Date().toISOString(),
    database: { status: dbStatus },
    ai: {
      status: ollamaStatus,
      chatModel: process.env.OLLAMA_CHAT_MODEL || "qwen3:4b",
      embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text:latest",
      availableModels,
    },
  });
});

// 6. Mount REST API Routers
app.use("/api/auth", authRouter);
app.use("/api/workspaces", workspaceRouter);
app.use("/api/campaigns", campaignRouter);
app.use("/api/campaigns/:id/briefs", briefRouter);
app.use("/api/campaigns/:id/assets", assetRouter);
app.use("/api/tasks", taskRouter);
app.use("/api", taskRouter); // handles /api/campaigns/:id/tasks and /api/tasks/:id
app.use("/api/versions", versionRouter);
app.use("/api", versionRouter); // handles /api/campaigns/:id/versions and /api/versions/:id/decision
app.use("/api", commentRouter); // handles /api/versions/:id/comments
app.use("/api/campaign-chat", campaignChatRouter);
app.use("/api/production-agent", productionAgentRouter);
app.use("/api/showcase", showcaseRouter);
app.use("/api/invitations", invitationRouter);

// 7. Centralized Error Handling Middleware
app.use(errorHandler);

// Database Connection & Server Initialization
export async function startServer() {
  try {
    if (dbUrl) {
      await connect(dbUrl);
      console.log("MongoDB connection success");
    } else {
      console.warn("DB_URL not defined; server running without database connection");
    }

    const server = app.listen(port, () => {
      console.log(`Creator Campaign Production Desk server listening on port ${port}...`);
    });
    return server;
  } catch (err) {
    console.error("Error in DB connection:", err.message);
    throw err;
  }
}

// Auto-start server when run directly
if (process.env.NODE_ENV !== "test") {
  startServer();
}

export default app;
