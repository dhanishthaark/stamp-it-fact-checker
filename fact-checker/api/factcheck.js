// api/factcheck.js
// Serverless function (runs on Vercel's free tier). This is the ONLY place
// your Anthropic API key is used — it lives in an environment variable on
// the server, so it's never sent to anyone's browser.

const SYSTEM_PROMPT = `You are the fact-checker inside a finance news app built for 18-25 year olds who often see financial claims first on TikTok or Instagram from finfluencers, before anywhere else.

A user will paste a claim, caption, or short transcript line from a video they saw. Search the web to check whether it holds up, then reply with ONLY a single JSON object — no markdown code fences, no text before or after it. Use exactly this shape:

{
  "verdict": "true" | "false" | "misleading" | "unverified",
  "headline": "a short restatement of the claim, under 12 words",
  "explanation": "ONE short sentence, max ~20 words, on what's actually going on - plain language, no jargon, no extra numbers or backstory unless that single fact is the whole point",
  "correction": "if verdict is false or misleading: ONE short sentence on what's actually true, or how the real story got twisted. Empty string otherwise.",
  "sources": [ up to 2 objects like {"title": "...", "url": "..."} from sources you actually found ]
}

Rules:
- This is for a 15-25 year old scrolling on their phone. Be as short as physically possible while staying accurate - a gut-check, not a report.
- Keep it punchy and conversational, like texting a friend, not a textbook.
- If you can't find enough to verify confidently, use "unverified" and say so honestly rather than guessing.
- Never invent sources or URLs. Only include ones you actually found while searching.`;

module.exports = async (req, res) => {
  // Allow the frontend (and teammates testing from anywhere) to call this.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { claimText } = req.body || {};
  if (!claimText || typeof claimText !== 'string' || !claimText.trim()) {
    return res.status(400).json({ error: 'Paste a claim, caption, or transcript line first.' });
  }
  if (claimText.length > 4000) {
    return res.status(400).json({ error: 'That\'s a lot of text — paste the key claim in a sentence or two.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'Server is missing ANTHROPIC_API_KEY. Add it in your Vercel project\'s Environment Variables, then redeploy.',
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: claimText.trim() }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json({
        error: data?.error?.message || 'The fact-checking service returned an error.',
      });
    }

    const textBlocks = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const cleaned = textBlocks.replace(/```json|```/g, '').trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Could not parse model output as JSON:', textBlocks);
      result = {
        verdict: 'unverified',
        headline: claimText.slice(0, 80),
        explanation: textBlocks || "Couldn't get a clean answer that time — try rephrasing the claim, or try again.",
        correction: '',
        sources: [],
      };
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Fact-check request failed:', err);
    return res.status(500).json({ error: 'Something went wrong reaching the fact-checker. Try again.' });
  }
};
