// Auth middleware for Vercel functions
const PASSWORD = process.env.KANBAN_PASSWORD || 'changeme123';

export function checkAuth(req, res) {
  const token = req.cookies?.auth_token || req.headers['x-auth-token'];
  if (token !== PASSWORD) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function json(res, status, data) {
  res.status(status).json(data);
}
