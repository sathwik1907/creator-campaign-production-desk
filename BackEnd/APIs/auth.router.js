import express from "express";
import { z } from "zod";
import { UserModel } from "../models/user.model.js";
import { WorkspaceModel } from "../models/workspace.model.js";
import {
  hashPassword,
  comparePassword,
  generateTokenAndHash,
  hashToken,
} from "../services/auth.service.js";
import { logAuditEvent } from "../services/audit.service.js";
import { validate } from "../middlewares/validation.middleware.js";
import { rateLimiter } from "../middlewares/rate-limit.middleware.js";
import { getOrCreateCsrfToken } from "../middlewares/csrf.middleware.js";
import { sendAccountEmail, accountLink } from "../services/email.service.js";

export const authRouter = express.Router();

// Validation Schemas
const signupSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

// GET /api/auth/csrf-token
authRouter.get("/csrf-token", (req, res) => {
  const token = getOrCreateCsrfToken(req);
  res.json({ success: true, csrfToken: token });
});

// POST /api/auth/signup
authRouter.post("/signup", rateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 }), validate(signupSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await UserModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email address already exists",
      });
    }

    const hashedPassword = await hashPassword(password);
    const { rawToken, tokenHash } = generateTokenAndHash();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await UserModel.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      isVerified: false,
      verificationTokenHash: tokenHash,
      verificationTokenExpires: tokenExpires,
      status: "PENDING_VERIFICATION",
    });

    // Auto-create default personal workspace for user
    const workspaceSlug = `${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;
    await WorkspaceModel.create({
      name: `${name}'s Workspace`,
      slug: workspaceSlug,
      ownerId: user._id,
      members: [{ user: user._id, role: "PRODUCER" }],
    });

    await logAuditEvent({
      actor: user._id,
      action: "AUTH_SIGNUP",
      resourceType: "User",
      resourceId: user._id,
      details: { email: user.email },
    });

    let emailDeliveryProblem = false;
    try {
      await sendAccountEmail({
        to: user.email,
        subject: "Verify your Creator Desk account",
        text: `Welcome to Creator Desk. Verify your email using this link: ${accountLink("verify_token", rawToken)}\n\nThis link expires in 24 hours.`,
      });
    } catch (error) {
      // Keep the created account recoverable through /resend-verification.
      console.error("Account verification email failed:", error.message);
      emailDeliveryProblem = true;
    }

    // Development provides single-use tokens; production only sends email.
    res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email before logging in.",
      data: {
        userId: user._id,
        email: user.email,
        verificationRequired: true,
        emailDeliveryProblem,
        ...(process.env.NODE_ENV !== "production" && { devVerificationToken: rawToken }),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/resend-verification (generic response prevents email enumeration)
authRouter.post(
  "/resend-verification",
  rateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 }),
  validate(forgotPasswordSchema),
  async (req, res, next) => {
    try {
      const user = await UserModel.findOne({ email: req.body.email.toLowerCase(), isVerified: false });
      let devVerificationToken;
      if (user) {
        const { rawToken, tokenHash } = generateTokenAndHash();
        user.verificationTokenHash = tokenHash;
        user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();
        try {
          await sendAccountEmail({
            to: user.email,
            subject: "Verify your Creator Desk account",
            text: `Verify your email using this link: ${accountLink("verify_token", rawToken)}\n\nThis link expires in 24 hours.`,
          });
        } catch (error) {
          console.error("Resend verification failed:", error.message);
        }
        if (process.env.NODE_ENV !== "production") devVerificationToken = rawToken;
      }
      res.json({
        success: true,
        message: "If that account requires verification, a new verification link has been requested.",
        ...(devVerificationToken && { data: { devVerificationToken } }),
      });
    } catch (error) { next(error); }
  }
);

// POST /api/auth/verify-email
authRouter.post("/verify-email", validate(verifyEmailSchema), async (req, res, next) => {
  try {
    const { token } = req.body;
    const tokenHash = hashToken(token);

    const user = await UserModel.findOne({
      verificationTokenHash: tokenHash,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    user.isVerified = true;
    user.status = "ACTIVE";
    user.verificationTokenHash = null;
    user.verificationTokenExpires = null;
    await user.save();

    await logAuditEvent({
      actor: user._id,
      action: "AUTH_EMAIL_VERIFIED",
      resourceType: "User",
      resourceId: user._id,
      details: { email: user.email },
    });

    res.json({
      success: true,
      message: "Email verified successfully. You may now log in.",
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
authRouter.post(
  "/login",
  rateLimiter({ maxAttempts: 10, windowMs: 15 * 60 * 1000 }),
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await UserModel.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      const isMatch = await comparePassword(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      if (!user.isVerified) {
        return res.status(403).json({
          success: false,
          code: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email address before logging in.",
        });
      }

      if (user.status === "SUSPENDED") {
        return res.status(403).json({
          success: false,
          message: "Your account has been suspended.",
        });
      }

      // Rotate the session ID at login to prevent session fixation.
      await new Promise((resolve, reject) => {
        req.session.regenerate((error) => error ? reject(error) : resolve());
      });
      req.session.userId = user._id.toString();
      req.session.email = user.email;
      getOrCreateCsrfToken(req);

      await logAuditEvent({
        actor: user._id,
        action: "AUTH_LOGIN",
        resourceType: "User",
        resourceId: user._id,
        details: { ip: req.ip },
      });

      // Find primary workspace
      const workspace = await WorkspaceModel.findOne({
        $or: [{ ownerId: user._id }, { "members.user": user._id }],
      });

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified,
          },
          workspace: workspace ? { id: workspace._id, name: workspace.name, slug: workspace.slug } : null,
          csrfToken: req.session.csrfToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/logout
authRouter.post("/logout", async (req, res, next) => {
  try {
    if (req.session?.userId) {
      await logAuditEvent({
        actor: req.session.userId,
        action: "AUTH_LOGOUT",
        resourceType: "User",
        resourceId: req.session.userId,
      });
    }

    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie("creator_desk_sid", {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: process.env.COOKIE_SAME_SITE || "lax",
      });
      res.json({ success: true, message: "Logged out successfully" });
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
authRouter.get("/me", async (req, res, next) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await UserModel.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        message: "User session expired or invalid",
      });
    }

    const workspace = await WorkspaceModel.findOne({
      $or: [{ ownerId: user._id }, { "members.user": user._id }],
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
        },
        workspace: workspace ? { id: workspace._id, name: workspace.name, slug: workspace.slug } : null,
        csrfToken: getOrCreateCsrfToken(req),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/forgot-password
authRouter.post(
  "/forgot-password",
  rateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 }),
  validate(forgotPasswordSchema),
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const user = await UserModel.findOne({ email: email.toLowerCase() });

      // Always return success message to prevent user enumeration
      if (!user) {
        return res.json({
          success: true,
          message: "If that email exists, a password reset link has been issued.",
        });
      }

      const { rawToken, tokenHash } = generateTokenAndHash();
      user.resetPasswordTokenHash = tokenHash;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      await logAuditEvent({
        actor: user._id,
        action: "AUTH_PASSWORD_RESET_REQUESTED",
        resourceType: "User",
        resourceId: user._id,
      });

      try {
        await sendAccountEmail({
          to: user.email,
          subject: "Reset your Creator Desk password",
          text: `Reset your password using this link: ${accountLink("reset_token", rawToken)}\n\nThis link expires in 1 hour. If you didn't request a reset, you can ignore this email.`,
        });
      } catch (error) {
        // Keep response identical for existing and nonexistent accounts.
        console.error("Password reset email failed:", error.message);
      }

      res.json({
        success: true,
        message: "If that email exists, a password reset link has been issued.",
        data: {
          ...(process.env.NODE_ENV !== "production" && { devResetToken: rawToken }),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/reset-password
authRouter.post(
  "/reset-password",
  validate(resetPasswordSchema),
  async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;
      const tokenHash = hashToken(token);

      const user = await UserModel.findOne({
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpires: { $gt: new Date() },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired password reset token",
        });
      }

      user.password = await hashPassword(newPassword);
      user.resetPasswordTokenHash = null;
      user.resetPasswordExpires = null;
      await user.save();

      await logAuditEvent({
        actor: user._id,
        action: "AUTH_PASSWORD_RESET_COMPLETED",
        resourceType: "User",
        resourceId: user._id,
      });

      res.json({
        success: true,
        message: "Password reset successful. You may now log in with your new password.",
      });
    } catch (error) {
      next(error);
    }
  }
);
