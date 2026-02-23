export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Mock costs data — in production, call OpenClaw gateway
  const mockCosts = [
    {
      key: 'agent:main:main',
      displayName: 'Main Session',
      model: 'anthropic/claude-haiku-4-5-20251001',
      inputTokens: 5000,
      outputTokens: 2000,
      inputCost: 0.004,
      outputCost: 0.008,
      totalCost: 0.012,
    },
    {
      key: 'agent:web-design',
      displayName: 'Web Design Expert',
      model: 'openai/gpt-5-mini',
      inputTokens: 10000,
      outputTokens: 5000,
      inputCost: 0.0015,
      outputCost: 0.003,
      totalCost: 0.0045,
    },
    {
      key: 'agent:cost-monitor',
      displayName: 'Cost Monitor',
      model: 'anthropic/claude-haiku-4-5-20251001',
      inputTokens: 3000,
      outputTokens: 1000,
      inputCost: 0.0024,
      outputCost: 0.004,
      totalCost: 0.0064,
    },
  ];

  res.status(200).json(mockCosts.sort((a, b) => b.totalCost - a.totalCost));
}
