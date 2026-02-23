export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gatewayUrl = process.env.VITE_OPENCLAW_GATEWAY_URL || process.env.OPENCLAW_GATEWAY_URL;
  
  if (!gatewayUrl) {
    // Fallback to mock if no gateway URL configured
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
    ];
    return res.status(200).json(mockCosts);
  }

  // Fetch real costs from OpenClaw gateway via ngrok
  try {
    // Remove wss:// and replace with https:// for HTTP calls
    const httpUrl = gatewayUrl.replace(/^wss?:\/\//, 'https://');
    
    const response = await fetch(`${httpUrl}/gateway/sessions.list`, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Gateway returned ${response.status}`);
    }

    const data = await response.json();
    const sessions = data?.sessions || data?.result?.sessions || [];

    const PRICING = {
      'openai/gpt-5-mini': { in: 0.15 / 1000000, out: 0.60 / 1000000 },
      'openai/gpt-4o': { in: 5 / 1000000, out: 15 / 1000000 },
      'openai/gpt-4o-mini': { in: 0.15 / 1000000, out: 0.60 / 1000000 },
      'anthropic/claude-sonnet-4-6': { in: 3 / 1000000, out: 15 / 1000000 },
      'anthropic/claude-3-5-haiku': { in: 0.80 / 1000000, out: 4 / 1000000 },
      'google/gemini-2.0-flash': { in: 0.075 / 1000000, out: 0.30 / 1000000 },
    };

    const costs = sessions.map(s => {
      const model = s.model || 'unknown';
      const pricing = PRICING[model] || { in: 0, out: 0 };
      const inTokens = s.inputTokens || 0;
      const outTokens = s.outputTokens || 0;
      const inCost = inTokens * pricing.in;
      const outCost = outTokens * pricing.out;
      const totalCost = inCost + outCost;

      return {
        key: s.key || s.id,
        displayName: s.label || s.displayName || s.key || s.id,
        model,
        inputTokens: inTokens,
        outputTokens: outTokens,
        inputCost: parseFloat(inCost.toFixed(6)),
        outputCost: parseFloat(outCost.toFixed(6)),
        totalCost: parseFloat(totalCost.toFixed(6)),
      };
    }).sort((a, b) => b.totalCost - a.totalCost);

    return res.status(200).json(costs);
  } catch (error) {
    console.error('Error fetching costs from gateway:', error);
    return res.status(500).json({ error: 'Failed to fetch gateway data', details: error.message });
  }
}
