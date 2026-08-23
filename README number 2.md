# ClaimCheck — Fact-checker prototype

Paste a claim from a TikTok / Insta / headline. It searches the live web for it,
then tells you in plain English whether it checks out.

100% free to run — no paid API, no credit card required for the tiers used here.

- **Brain:** Google Gemini API (free tier)
- **Eyes (web search):** Tavily API (free tier, 1,000 searches/month)
- **Hosting (optional, for a public link):** Render.com (free tier)

---

## 1. Get your two free API keys

**Gemini key**
1. Go to https://aistudio.google.com
2. Sign in with any Google account
3. Click "Get API key" → "Create API key"
4. Copy it somewhere safe

**Tavily key**
1. Go to https://tavily.com
2. Sign up (free plan)
3. Your API key is shown on your dashboard — copy it

Neither of these should ask for a credit card on the free plan.

## 2. Set up the project

1. Make sure you have Node.js v18+ installed (`node -v` in a terminal — if it's missing, install from https://nodejs.org)
2. Open a terminal in this `claimcheck-backend` folder
3. Copy `.env.example` to a new file called `.env`
4. Paste your two keys into `.env`:
   ```
   GEMINI_API_KEY=your-real-key-here
   TAVILY_API_KEY=your-real-key-here
   ```
5. Install dependencies:
   ```
   npm install
   ```
6. Start the server:
   ```
   npm start
   ```
7. Open http://localhost:3000 in your browser and test it with one of the example chips.

At this point it only works on your machine. Follow step 3 to get a link the whole team can open.

## 3. Get a public link everyone on the team can use (free)

1. Push this folder to a **new GitHub repo** (make it private if you don't want it public — that's fine and still free).
   - **Important:** don't commit your `.env` file. The included `.gitignore` already excludes it, so as long as you don't force-add it, your keys stay off GitHub.
2. Go to https://render.com and sign up (free, no card needed for this tier).
3. Click **New → Web Service**, connect your GitHub account, and pick this repo.
4. Fill in:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
5. Under **Environment**, add the same two variables from your `.env`:
   - `GEMINI_API_KEY`
   - `TAVILY_API_KEY`
6. Click **Create Web Service**. Render will build it and give you a URL like `https://claimcheck-yourname.onrender.com`.
7. Send that URL to the team — anyone can open it from any device, no setup needed on their end.

**Note:** the free Render tier "sleeps" after ~15 minutes of no traffic. The first request after that takes a few extra seconds to wake up — after that it's normal speed. Worth opening the link a minute before you actually demo it on Friday.

## Free tier limits (should be more than enough for a hackathon)

- Gemini free tier: several hundred requests/day
- Tavily free tier: 1,000 searches/month
- Render free tier: enough compute hours for a project like this running on and off all week

If you somehow blow through these mid-demo, the fix is just to wait a few minutes or generate a second free key — nothing to pay.
