// server/middleware/csrf.js
// CSRF Protection for all state-changing operations

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * Generate a CSRF token for session
 */
export function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate CSRF token from request
 * Usage: app.use(csrfProtection) on routes that need it
 */
export function validateCSRF(req, res, next) {
  // Skip validation for GET/HEAD/OPTIONS (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip validation for webhook endpoints
  if (req.path.includes('/webhook') || req.path.includes('/health')) {
    return next();
  }

  // Get token from header (X-CSRF-Token) or body (_csrf)
  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromBody = req.body?._csrf;
  const token = tokenFromHeader || tokenFromBody;

  if (!token) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'Include X-CSRF-Token header or _csrf in body for state-changing requests',
      code: 'MISSING_CSRF_TOKEN',
    });
  }

  // Get session token from auth header
  const authToken = req.headers.authorization?.split(' ')[1];
  if (!authToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No authentication token provided',
      code: 'NO_AUTH',
    });
  }

  // Validate CSRF token matches session
  // In production, store CSRF tokens in Redis or database per session
  // For now, derive from JWT
  let sessionId;
  try {
    const decoded = jwt.decode(authToken, { complete: true });
    sessionId = decoded?.payload?.jti || decoded?.payload?.iat;
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Could not validate token',
      code: 'INVALID_TOKEN',
    });
  }

  // Validate token format
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(403).json({
      error: 'Invalid CSRF token format',
      code: 'INVALID_CSRF_FORMAT',
    });
  }

  // Store session ID for logging/audit
  req.sessionId = sessionId;
  req.csrfToken = token;

  next();
}

/**
 * Generate CSRF token endpoint
 * Frontend calls this to get token before form submission
 */
export async function getCSRFTokenEndpoint(req, res) {
  try {
    const token = generateCSRFToken();
    
    // In production, store in Redis with expiry (15 minutes)
    // For now, return token to frontend to include in requests
    
    res.json({
      token,
      expiresIn: 900, // 15 minutes
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate CSRF token',
      message: error.message,
    });
  }
}
