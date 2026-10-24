import crypto from "crypto";

/**
 * Ensures CSRF protection for cookie-authenticated mutating requests.
 */
export function csrfProtection(req, res, next) {
  // Safe HTTP methods bypass CSRF check
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Exempt public auth endpoints that establish sessions or verify tokens
  const exemptPaths = [
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/verify-email",
    "/api/auth/resend-verification",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
  ];

  if (exemptPaths.includes(req.path)) {
    return next();
  }

  // Only check CSRF if user is authenticated via session
  if (!req.session?.userId) {
    return next();
  }

  const clientToken =
    req.headers["x-csrf-token"] ||
    req.headers["x-xsrf-token"] ||
    req.body?._csrf;

  const sessionToken = req.session.csrfToken;

  if (!sessionToken || !clientToken || clientToken !== sessionToken) {
    return res.status(403).json({
      success: false,
      message: "CSRF token validation failed or missing. Please refresh.",
    });
  }

  next();
}

/**
 * Generates and returns or refreshes the CSRF token in the user's session
 */
export function getOrCreateCsrfToken(req) {
  if (!req.session) return null;
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}
