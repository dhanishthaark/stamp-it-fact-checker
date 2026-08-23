// api/factcheck.js
// Vercel serverless function for Stamp It.
// Uses Tavily for live web search + Google Gemini for the explanation/verdict.
// API keys stay server-side in Vercel Environment Variables.

const SYSTEM_PROMPT = `
You are Stamp It, a concise financial fact-checker inside a finance-learning app for young people aged 15-25.

The user gives you a financial claim they saw online, such as a TikTok, Instagram post, headline, or finfluencer statement.

You will receive the user's claim AND search results from Tavily.

Assess the claim ONLY using the evidence provided by the search results.

Return ONLY one valid JSON object with exactly this structure:

{
  "verdict": "true" | "false" | "misleading" | "unverified",
  "headline": "short restatement of the claim, under 12 words",
  "explanation": "ONE short sentence, maximum 20 words, explaining what is actually happening",
  "correction": "if false or misleading, ONE short sentence explaining what is actually true; otherwise empty string",
  "sources": [
    {"title": "source title", "url": "source URL"}
  ]
}

Rules:
- Be extremely concise.
- Write for someone aged 15-25.
- Use plain English and avoid financial jargon.
- Never invent facts, sources or URLs.
- Prefer primary/reliable sources when available.
- If the search evidence is insufficient, use "unverified".
- Do not make a confident claim when the evidence is unclear.
- Include no more than 2 sources.
- Return JSON only. No markdown and no explanation outside the JSON.
`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { claimText } = req.body || {};

  if (
    !claimText ||
    typeof claimText !== 'string' ||
    !claimText.trim()
  ) {
    return res.status(400).json({
      error: 'Paste a claim, caption, or transcript line first.',
    });
  }

  if (claimText.length > 4000) {
    return res.status(400).json({
      error: "That's a lot of text. Paste the key claim in a sentence or two.",
    });
  }

  if (!process.env.GEMINI_API_KEY || !process.env.TAVILY_API_KEY) {
    return res.status(500).json({
      error: 'Fact-checker API keys are not configured yet.',
    });
  }

  try {
    // 1. Search the live web using Tavily
    const searchResponse = await fetch(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: claimText.trim(),
          search_depth: 'advanced',
          max_results: 5,
          include_answer: false,
        }),
      }
    );

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      console.error('Tavily API error:', searchData);
      return res.status(502).json({
        error: 'Could not search the web right now.',
      });
    }

    const results = Array.isArray(searchData.results)
      ? searchData.results
      : [];

    if (!results.length) {
      return res.status(200).json({
        verdict: 'unverified',
        headline: claimText.slice(0, 80),
        explanation: 'I could not find enough reliable evidence to verify this claim.',
        correction: '',
        sources: [],
      });
    }

    // 2. Give Gemini the claim + evidence found by Tavily
    const evidence = results
      .slice(0, 5)
      .map(
        (result, index) =>
          `SOURCE ${index + 1}
Title: ${result.title || ''}
URL: ${result.url || ''}
Content: ${result.content || ''}`
      )
      .join('\n\n');

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: SYSTEM_PROMPT,
              },
            ],
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `CLAIM:
${claimText.trim()}

SEARCH EVIDENCE:
${evidence}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', geminiData);
      return res.status(502).json({
        error: 'The fact-checking service could not analyse this claim.',
      });
    }

    const text =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('') || '';

    let result;

    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      console.error('Could not parse Gemini output:', text);

      result = {
        verdict: 'unverified',
        headline: claimText.slice(0, 80),
        explanation:
          'I could not get a reliable result this time. Try checking the claim again.',
        correction: '',
        sources: [],
      };
    }

    // Only allow sources that actually came from Tavily.
    const validUrls = new Set(
      results.map((result) => result.url).filter(Boolean)
    );

    result.sources = Array.isArray(result.sources)
      ? result.sources
          .filter(
            (source) =>
              source &&
              source.url &&
              validUrls.has(source.url)
          )
          .slice(0, 2)
      : [];

    return res.status(200).json(result);
  } catch (err) {
    console.error('Fact-check request failed:', err);

    return res.status(500).json({
      error: 'Something went wrong reaching the fact-checker. Try again.',
    });
  }
};
