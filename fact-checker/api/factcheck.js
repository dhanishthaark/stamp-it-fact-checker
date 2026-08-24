// api/factcheck.js
// Vercel serverless function for Stamp It.
// Tavily = live web search
// Gemini = verdict + plain-English explanation
// API keys stay server-side in Vercel Environment Variables.

const SYSTEM_PROMPT = `
You are Stamp It, a concise financial fact-checker inside a finance-learning app for young people aged 15-25.

The user gives you:
1. A financial claim they saw online.
2. Optionally, a URL to the TikTok, Instagram post, article, or other content where they saw it.

You will also receive search results from Tavily.

Assess the claim ONLY using the evidence provided by the search results.

Return ONLY one valid JSON object with exactly this structure:

{
  "verdict": "true" | "false" | "misleading" | "unverified",
  "headline": "short restatement of the claim, under 12 words",
  "explanation": "ONE short sentence, maximum 20 words, explaining what is actually happening",
  "correction": "if false or misleading, ONE short sentence explaining what is actually true; otherwise empty string",
  "why": "ONE short sentence explaining why this situation is happening or what caused the claim to be true, false, or misleading",
  "impact": "ONE short sentence explaining what this means for a young person aged 15-25",
  "sources": [
    {"title": "source title", "url": "source URL"}
  ]
}

Rules:
- Be extremely concise.
- Write for someone aged 15-25.
- Use plain English and avoid financial jargon.
- Never invent facts, sources or URLs.
- Prefer primary and reliable sources when available.
- If the search evidence is insufficient, use "unverified".
- Do not make a confident claim when the evidence is unclear.
- Include no more than 2 sources.
- The "why" and "impact" sections must be useful, but must not add facts that are not supported by the evidence.
- Do not give personalised financial advice.
- Return JSON only. No markdown and no explanation outside the JSON.
`;

module.exports = async (req, res) => {
  // Allow the frontend and teammates to call the API.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  const { claimText, sourceUrl } = req.body || {};

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
      error:
        "That's a lot of text. Paste the key claim in a sentence or two.",
    });
  }

  // The URL is optional.
  if (
    sourceUrl &&
    typeof sourceUrl !== 'string'
  ) {
    return res.status(400).json({
      error: 'Please enter a valid source link.',
    });
  }

  if (!process.env.GEMINI_API_KEY || !process.env.TAVILY_API_KEY) {
    return res.status(500).json({
      error: 'Fact-checker API keys are not configured yet.',
    });
  }

  try {
    // --------------------------------------------------
    // 1. Search the live web using Tavily
    // --------------------------------------------------

    const searchQuery = sourceUrl
      ? `${claimText.trim()} source: ${sourceUrl.trim()}`
      : claimText.trim();

    const searchResponse = await fetch(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: searchQuery,
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
        explanation:
          'I could not find enough reliable evidence to verify this claim.',
        correction: '',
        why:
          'There was not enough reliable evidence to establish what is happening.',
        impact:
          'Treat the claim cautiously until stronger evidence is available.',
        sources: [],
      });
    }

    // --------------------------------------------------
    // 2. Give Gemini the claim + optional URL + evidence
    // --------------------------------------------------

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

    const sourceContext = sourceUrl
      ? `
USER-PROVIDED SOURCE URL:
${sourceUrl.trim()}
`
      : `
NO SOURCE URL WAS PROVIDED.
`;

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
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

${sourceContext}

SEARCH EVIDENCE:
${evidence}`,
                },
              ],
            },
          ],

          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', geminiData);

      return res.status(502).json({
        error:
          'The fact-checking service could not analyse this claim.',
      });
    }

    // --------------------------------------------------
    // 3. Read Gemini's JSON response
    // --------------------------------------------------

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
        why: '',
        impact: '',
        sources: [],
      };
    }

    // --------------------------------------------------
    // 4. Safety checks on Gemini's output
    // --------------------------------------------------

    const allowedVerdicts = [
      'true',
      'false',
      'misleading',
      'unverified',
    ];

    if (!allowedVerdicts.includes(result.verdict)) {
      result.verdict = 'unverified';
    }

    result.headline =
      typeof result.headline === 'string'
        ? result.headline
        : claimText.slice(0, 80);

    result.explanation =
      typeof result.explanation === 'string'
        ? result.explanation
        : '';

    result.correction =
      typeof result.correction === 'string'
        ? result.correction
        : '';

    result.why =
      typeof result.why === 'string'
        ? result.why
        : '';

    result.impact =
      typeof result.impact === 'string'
        ? result.impact
        : '';

    // --------------------------------------------------
    // 5. Only allow sources actually returned by Tavily
    // --------------------------------------------------

    const validUrls = new Set(
      results
        .map((result) => result.url)
        .filter(Boolean)
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
      error:
        'Something went wrong reaching the fact-checker. Try again.',
    });
  }
};
