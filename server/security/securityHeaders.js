/**
 * Production Security Headers & CORS Middleware for DrawRealm
 */

const config = require("../config");

function securityHeadersMiddleware(req, res, next) {
  // Prevent MIME-sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking by restricting framing to same origin
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Enable XSS filter in browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // CORS handling
  const origin = req.headers.origin;
  if (config.CORS_ORIGIN === "*") {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else if (config.CORS_ORIGIN && origin) {
    const allowed = config.CORS_ORIGIN.split(",").map(s => s.trim());
    if (allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
}

module.exports = securityHeadersMiddleware;
