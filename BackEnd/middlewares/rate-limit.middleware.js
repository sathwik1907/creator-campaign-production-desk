const attemptsMap = new Map();

/**
 * Basic memory rate limiter for sensitive endpoints
 * @param {number} maxAttempts Maximum allowed attempts in window
 * @param {number} windowMs Window duration in milliseconds (default: 15 mins)
 */
export function rateLimiter({ maxAttempts = 5, windowMs = 15 * 60 * 1000 } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || "unknown_ip";
    const key = `${req.path}_${ip}`;
    const now = Date.now();

    const record = attemptsMap.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      attemptsMap.set(key, record);
      return next();
    }

    record.count += 1;
    attemptsMap.set(key, record);

    if (record.count > maxAttempts) {
      const waitMinutes = Math.ceil((record.resetTime - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Please try again after ${waitMinutes} minute(s).`,
      });
    }

    next();
  };
}
