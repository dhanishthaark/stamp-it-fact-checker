const claimEl = document.getElementById('claim');
const btn = document.getElementById('checkBtn');
const btnLabel = btn.querySelector('.btn-label');
const resultEl = document.getElementById('result');

const VERDICT_LABELS = {
  true: 'Verified true',
  false: 'False',
  misleading: 'Misleading',
  unverified: 'Unverified',
};

async function checkClaim() {
  const claimText = claimEl.value.trim();
  if (!claimText) {
    claimEl.focus();
    return;
  }

  btn.disabled = true;
  btnLabel.textContent = 'Checking…';
  resultEl.hidden = false;
  resultEl.className = 'result is-loading';
  resultEl.textContent = 'Searching the web for where this actually comes from…';

  try {
    const res = await fetch('/api/factcheck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimText }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong.');
    }

    renderResult(data);
  } catch (err) {
    resultEl.className = 'result is-error';
    resultEl.textContent = err.message || 'Something went wrong. Try again.';
  } finally {
    btn.disabled = false;
    btnLabel.textContent = 'Stamp it';
  }
}

function renderResult(data) {
  const verdict = ['true', 'false', 'misleading', 'unverified'].includes(data.verdict)
    ? data.verdict
    : 'unverified';

  resultEl.className = 'result';
  resultEl.innerHTML = '';

  const stamp = document.createElement('div');
  stamp.className = `stamp stamp--${verdict}`;
  stamp.textContent = VERDICT_LABELS[verdict];
  resultEl.appendChild(stamp);

  if (data.headline) {
    const headline = document.createElement('p');
    headline.className = 'claim-headline';
    headline.textContent = `"${data.headline}"`;
    resultEl.appendChild(headline);
  }

  const explanation = document.createElement('p');
  explanation.className = 'explanation';
  explanation.textContent = data.explanation || '';
  resultEl.appendChild(explanation);

  if (data.correction) {
    const box = document.createElement('div');
    box.className = 'correction';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = "What's actually true";
    const text = document.createElement('p');
    text.style.margin = '0';
    text.textContent = data.correction;
    box.appendChild(label);
    box.appendChild(text);
    resultEl.appendChild(box);
  }

  if (Array.isArray(data.sources) && data.sources.length) {
    const wrap = document.createElement('div');
    wrap.className = 'sources';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'Sources';
    const ul = document.createElement('ul');
    data.sources.slice(0, 2).forEach((src) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = src.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = src.title || src.url;
      li.appendChild(a);
      ul.appendChild(li);
    });
    wrap.appendChild(label);
    wrap.appendChild(ul);
    resultEl.appendChild(wrap);
  }
}

btn.addEventListener('click', checkClaim);
claimEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) checkClaim();
});
