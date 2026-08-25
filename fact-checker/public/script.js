const claimEl = document.getElementById('claim');
const sourceUrlEl = document.getElementById('sourceUrl');

const btn = document.getElementById('checkBtn');
const btnLabel = btn.querySelector('.btn-label');
const resultEl = document.getElementById('result');

const VERDICT_LABELS = {
  true: 'Verified true',
  false: 'False',
  misleading: 'Misleading',
  unverified: 'Unverified',
};

const MYTH_LOG_KEY = 'stampItMythLog';

let latestResult = null;

async function checkClaim() {
  const claimText = claimEl.value.trim();
  const sourceUrl = sourceUrlEl.value.trim();

  if (!claimText) {
    claimEl.focus();
    return;
  }

  btn.disabled = true;
  btnLabel.textContent = 'Checking…';

  resultEl.hidden = false;
  resultEl.className = 'result is-loading';
  resultEl.textContent =
    'Searching the web for where this actually comes from…';

  try {
    const res = await fetch('/api/factcheck', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        claimText,
        sourceUrl,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || 'Something went wrong.'
      );
    }

    latestResult = {
      ...data,
      claimText,
      sourceUrl,
    };

    renderResult(latestResult);
  } catch (err) {
    latestResult = null;

    resultEl.className = 'result is-error';
    resultEl.textContent =
      err.message ||
      'Something went wrong. Try again.';
  } finally {
    btn.disabled = false;
    btnLabel.textContent = 'Stamp it';
  }
}

function renderResult(data) {
  const verdict = [
    'true',
    'false',
    'misleading',
    'unverified',
  ].includes(data.verdict)
    ? data.verdict
    : 'unverified';

  resultEl.className = 'result';
  resultEl.innerHTML = '';

  // -----------------------------
  // Stamp
  // -----------------------------

  const stamp = document.createElement('div');

  stamp.className = `stamp stamp--${verdict}`;
  stamp.textContent = VERDICT_LABELS[verdict];

  resultEl.appendChild(stamp);

  // -----------------------------
  // Claim headline
  // -----------------------------

  if (data.headline) {
    const headline = document.createElement('p');

    headline.className = 'claim-headline';
    headline.textContent = `"${data.headline}"`;

    resultEl.appendChild(headline);
  }

  // -----------------------------
  // Explanation
  // -----------------------------

  if (data.explanation) {
    const explanation =
      document.createElement('p');

    explanation.className = 'explanation';
    explanation.textContent = data.explanation;

    resultEl.appendChild(explanation);
  }

  // -----------------------------
  // Correction
  // -----------------------------

  if (data.correction) {
    const box =
      document.createElement('div');

    box.className = 'correction';

    const label =
      document.createElement('span');

    label.className = 'label';
    label.textContent =
      "What's actually true";

    const text =
      document.createElement('p');

    text.style.margin = '0';
    text.textContent = data.correction;

    box.appendChild(label);
    box.appendChild(text);

    resultEl.appendChild(box);
  }

  // -----------------------------
  // Why?
  // -----------------------------

  if (data.why) {
    const box =
      document.createElement('div');

    box.className = 'insight';

    const label =
      document.createElement('span');

    label.className = 'label';
    label.textContent =
      'Why has this happened?';

    const text =
      document.createElement('p');

    text.textContent = data.why;

    box.appendChild(label);
    box.appendChild(text);

    resultEl.appendChild(box);
  }

  // -----------------------------
  // What does this mean for me?
  // -----------------------------

  if (data.impact) {
    const box =
      document.createElement('div');

    box.className = 'insight';

    const label =
      document.createElement('span');

    label.className = 'label';
    label.textContent =
      'What does this mean for me?';

    const text =
      document.createElement('p');

    text.textContent = data.impact;

    box.appendChild(label);
    box.appendChild(text);

    resultEl.appendChild(box);
  }

  // -----------------------------
  // Sources
  // -----------------------------

  if (
    Array.isArray(data.sources) &&
    data.sources.length
  ) {
    const wrap =
      document.createElement('div');

    wrap.className = 'sources';

    const label =
      document.createElement('span');

    label.className = 'label';
    label.textContent = 'Sources';

    const ul =
      document.createElement('ul');

    data.sources
      .slice(0, 2)
      .forEach((src) => {
        const li =
          document.createElement('li');

        const a =
          document.createElement('a');

        a.href = src.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';

        a.textContent =
          src.title || src.url;

        li.appendChild(a);
        ul.appendChild(li);
      });

    wrap.appendChild(label);
    wrap.appendChild(ul);

    resultEl.appendChild(wrap);
  }

  // -----------------------------
  // Save to Myth Log
  // -----------------------------

  const saveButton =
    document.createElement('button');

  saveButton.type = 'button';
  saveButton.className = 'save-log-btn';
  saveButton.textContent = 'Save to Myth Log';

  saveButton.addEventListener(
    'click',
    () => saveToMythLog(data)
  );

  resultEl.appendChild(saveButton);
}

// ---------------------------------
// Myth vs Fact Log
// ---------------------------------

function getMythLog() {
  try {
    return JSON.parse(
      localStorage.getItem(MYTH_LOG_KEY)
    ) || [];
  } catch {
    return [];
  }
}

function saveMythLog(log) {
  localStorage.setItem(
    MYTH_LOG_KEY,
    JSON.stringify(log)
  );
}

function saveToMythLog(data) {
  const log = getMythLog();

  const entry = {
    id: Date.now(),
    date: new Date().toLocaleDateString(
      'en-GB',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }
    ),
    claim:
      data.claimText ||
      data.headline ||
      'Untitled claim',
    sourceUrl: data.sourceUrl || '',
    verdict: data.verdict || 'unverified',
    explanation: data.explanation || '',
    correction: data.correction || '',
    why: data.why || '',
    impact: data.impact || '',
    sources: Array.isArray(data.sources)
      ? data.sources.slice(0, 2)
      : [],
  };

  log.unshift(entry);
  saveMythLog(log);

  renderMythLog();

  const saveButton =
    resultEl.querySelector('.save-log-btn');

  if (saveButton) {
    saveButton.textContent =
      'Saved to Myth Log ✓';

    saveButton.disabled = true;
  }
}

function renderMythLog() {
  let logSection =
    document.getElementById('mythLog');

  if (!logSection) {
    logSection =
      document.createElement('section');

    logSection.id = 'mythLog';
    logSection.className = 'myth-log';

    resultEl.insertAdjacentElement(
      'afterend',
      logSection
    );
  }

  const log = getMythLog();

  logSection.innerHTML = '';

  const heading =
    document.createElement('div');

  heading.className = 'myth-log-header';

  const title =
    document.createElement('h2');

  title.textContent = 'Myth vs Fact Log';

  const subtitle =
    document.createElement('p');

  subtitle.textContent =
    'Your saved fact-checks, all in one place.';

  heading.appendChild(title);
  heading.appendChild(subtitle);

  logSection.appendChild(heading);

  if (!log.length) {
    const empty =
      document.createElement('p');

    empty.className = 'myth-log-empty';

    empty.textContent =
      'Your saved checks will appear here.';

    logSection.appendChild(empty);

    return;
  }

  log.forEach((entry) => {
    const card =
      document.createElement('article');

    card.className =
      'myth-log-card';

    // Date
    const date =
      document.createElement('span');

    date.className =
      'myth-log-date';

    date.textContent =
      entry.date;

    card.appendChild(date);

    // Verdict
    const verdict =
      document.createElement('div');

    const verdictKey = [
      'true',
      'false',
      'misleading',
      'unverified',
    ].includes(entry.verdict)
      ? entry.verdict
      : 'unverified';

    verdict.className =
      `myth-log-verdict stamp--${verdictKey}`;

    verdict.textContent =
      VERDICT_LABELS[verdictKey];

    card.appendChild(verdict);

    // Claim
    const claim =
      document.createElement('h3');

    claim.textContent =
      entry.claim;

    card.appendChild(claim);

    // Explanation
    if (entry.explanation) {
      const explanation =
        document.createElement('p');

      explanation.textContent =
        entry.explanation;

      card.appendChild(explanation);
    }

    // Correction
    if (entry.correction) {
      const correction =
        document.createElement('p');

      correction.className =
        'myth-log-correction';

      correction.textContent =
        entry.correction;

      card.appendChild(correction);
    }

    // Original source link
    if (entry.sourceUrl) {
      const link =
        document.createElement('a');

      link.href =
        entry.sourceUrl;

      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      link.textContent =
        'View original content ↗';

      card.appendChild(link);
    }

    // Sources
    if (
      Array.isArray(entry.sources) &&
      entry.sources.length
    ) {
      const sources =
        document.createElement('div');

      sources.className =
        'myth-log-sources';

      const label =
        document.createElement('span');

      label.textContent =
        'Sources';

      sources.appendChild(label);

      entry.sources
        .slice(0, 2)
        .forEach((src) => {
          const link =
            document.createElement('a');

          link.href = src.url;
          link.target = '_blank';
          link.rel =
            'noopener noreferrer';

          link.textContent =
            src.title || src.url;

          sources.appendChild(link);
        });

      card.appendChild(sources);
    }

    logSection.appendChild(card);
  });
}

// ---------------------------------
// Button
// ---------------------------------

btn.addEventListener(
  'click',
  checkClaim
);

// ---------------------------------
// Cmd/Ctrl + Enter
// ---------------------------------

claimEl.addEventListener(
  'keydown',
  (e) => {
    if (
      e.key === 'Enter' &&
      (e.metaKey || e.ctrlKey)
    ) {
      checkClaim();
    }
  }
);

// ---------------------------------
// URL field Cmd/Ctrl + Enter
// ---------------------------------

sourceUrlEl.addEventListener(
  'keydown',
  (e) => {
    if (
      e.key === 'Enter' &&
      (e.metaKey || e.ctrlKey)
    ) {
      checkClaim();
    }
  }
);

// ---------------------------------
// Load saved Myth Log
// ---------------------------------

renderMythLog();
