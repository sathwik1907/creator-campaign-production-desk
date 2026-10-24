import { UserModel } from "../models/user.model.js";

export async function requireAuth(req, res, next) {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to access this resource",
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      // Invalidate invalid session
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        message: "User account not found. Please log in again.",
      });
    }

    if (user.status === "SUSPENDED") {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended.",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email address before continuing.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
