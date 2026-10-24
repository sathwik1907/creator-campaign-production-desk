import bcrypt from "bcryptjs";
import crypto from "crypto";

const SALT_ROUNDS = 12;

/**
 * Hash a plain text password using bcrypt
 */
export async function hashPassword(plainTextPassword) {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

/**
 * Compare plain text password against hashed password
 */
export async function comparePassword(plainTextPassword, hashedPassword) {
  return bcrypt.compare(plainTextPassword, hashedPassword);
}

/**
 * Generate a cryptographically random token and its SHA-256 hash.
 * The raw token is sent to the user (e.g. email or dev response).
 * The hashed token is stored in the database.
 */
export function generateTokenAndHash() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  return { rawToken, tokenHash };
}

/**
 * Hash a raw token with SHA-256 for database lookup
 */
export function hashToken(rawToken) {
  return crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
}
