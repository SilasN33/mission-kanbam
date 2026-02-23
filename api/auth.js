export default function handler(req, res) {
  if (req.method === 'POST') {
    const { password } = req.body;
    const correctPassword = process.env.KANBAN_PASSWORD || 'changeme123';
    
    if (password === correctPassword) {
      res.setHeader('Set-Cookie', `auth_token=${password}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);
      return res.status(200).json({ ok: true, message: 'Logged in' });
    }
    return res.status(401).json({ error: 'Invalid password' });
  }

  if (req.method === 'POST' && req.url.includes('logout')) {
    res.setHeader('Set-Cookie', 'auth_token=; Path=/; Max-Age=0');
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
