import jwt from 'jsonwebtoken';

/**
 * Express middleware: verifies Bearer token and sets req.user = { id, email, name }
 */
export function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ ok: false, error: 'missing_token' });

    const token = m[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name || '',
    };
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'invalid_token' });
  }
}
