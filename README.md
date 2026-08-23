# Stamp It — finfluencer fact-checker

Prototype of the fact-checker feature: paste a claim, caption, or transcript
line from a TikTok/Instagram video, and it searches the web, then stamps it
**true / false / misleading / unverified** with a plain-English explanation
and — if it's wrong — what the real story likely was.

## How it's built

- `public/` — the page (plain HTML/CSS/JS, no build step)
- `api/factcheck.js` — a small backend function. It's the only place your
  Anthropic API key lives, so it's never exposed in the browser. It calls
  Claude with the web search tool turned on, and returns a clean verdict.

You need the backend because calling the Anthropic API straight from the
browser would put your API key in the page's JavaScript, where anyone could
copy it.

## 1. Get an API key

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up
   or log in.
2. Create an API key under **Settings → API Keys**.
3. In **Settings → Privacy/Features**, make sure the **web search** tool is
   enabled for your organization — it's off by default for new accounts.

Usage is pay-per-token (plus a small per-search fee for web search), not
literally free — but for hackathon-scale testing among 5-6 people it should
stay well within a few dollars. Check current pricing on the console before
the event so there are no surprises.

## 2. Test it locally (optional but recommended)

```bash
npm install -g vercel
cp .env.example .env   # then paste your real key into .env
vercel dev
```

Open the local URL it prints, paste a claim, and hit **Stamp it**.

## 3. Deploy for free so the whole team can use it

1. Push this folder to a new GitHub repo (public or private, either works).
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, and click
   **Add New → Project**, then import the repo.
3. Before deploying, add an **Environment Variable**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your key from step 1
4. Click **Deploy**. Vercel's free (Hobby) tier covers this comfortably.
5. You'll get a URL like `stamp-it.vercel.app` — send that to the team group
   chat. Anyone can open it on their phone or laptop; nobody needs a key or
   needs to run anything locally.

## Current scope / what to say if asked in the demo

Right now it fact-checks **pasted text** (a claim, caption, or transcript
line) — that's the part that's actually running end-to-end with live web
search. The original idea was linking a TikTok/Insta video directly and
having AI read the frames and transcript automatically; that needs a video
download + transcription step on top of this, which is a solid "next
version" line for the pitch rather than something to build overnight.
