// ==========================================================
// SecureBank Analytics — Frontend logic
// Talks to the EXISTING /predict endpoint. Payload keys and
// response shape are unchanged: 
//   POST { credit_score, geography, gender, age, tenure, balance,
//          num_products, has_cr_card, is_active, estimated_salary }
//   ->  { ok, probability, will_churn, risk_level, message }
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {

  // ---------- Element refs ----------
  const creditScore = document.getElementById('credit_score');
  const geography = document.getElementById('geography');
  const gender = document.getElementById('gender');
  const age = document.getElementById('age');
  const tenure = document.getElementById('tenure');
  const balance = document.getElementById('balance');
  const numProducts = document.getElementById('num_products');
  const estimatedSalary = document.getElementById('estimated_salary');

  const form = document.getElementById('churn-form');
  const predictBtn = document.getElementById('predict-btn');
  const progressTrack = document.getElementById('progress-track');
  const progressFill = document.getElementById('progress-fill');
  const resultArea = document.getElementById('result-area');

  let hasCrCard = 1;
  let isActive = 1;

  // ---------- Toggle buttons (Yes/No pairs) ----------
  document.querySelectorAll('.toggle-pair').forEach(pair => {
    const target = pair.dataset.target;
    pair.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        pair.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = parseInt(btn.dataset.value, 10);
        if (target === 'has_cr_card') hasCrCard = val;
        if (target === 'is_active') isActive = val;
        updateSnapshot();
      });
    });
  });

  // ---------- Live range output labels ----------
  const bindRange = (input, outputId) => {
    const out = document.getElementById(outputId);
    input.addEventListener('input', () => {
      out.textContent = input.value;
      updateSliderFill(input);
      updateSnapshot();
    });
    updateSliderFill(input);
  };

  function updateSliderFill(input) {
    const min = parseFloat(input.min), max = parseFloat(input.max), val = parseFloat(input.value);
    const pct = ((val - min) / (max - min)) * 100;
    input.style.background = `linear-gradient(90deg, var(--primary) 0%, var(--cyan) ${pct}%, #dbe6fb ${pct}%)`;
  }

  bindRange(creditScore, 'credit-score-out');
  bindRange(age, 'age-out');
  bindRange(tenure, 'tenure-out');
  bindRange(numProducts, 'products-out');

  [geography, gender, balance, estimatedSalary].forEach(el => {
    el.addEventListener('input', updateSnapshot);
    el.addEventListener('change', updateSnapshot);
  });

  // ---------- Formatters ----------
  const money = (n) => {
    const num = parseFloat(n);
    return '$' + (isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  function updateSnapshot() {
    document.getElementById('snap-credit').textContent = creditScore.value;
    document.getElementById('snap-geo').textContent = geography.value;
    document.getElementById('snap-gender').textContent = gender.value;
    document.getElementById('snap-age').textContent = `${age.value} yrs`;
    document.getElementById('snap-tenure').textContent = `${tenure.value} yrs`;
    document.getElementById('snap-balance').textContent = money(balance.value);
    document.getElementById('snap-products').textContent = numProducts.value;
    document.getElementById('snap-cc').textContent = hasCrCard === 1 ? 'Yes' : 'No';
    document.getElementById('snap-active').textContent = isActive === 1 ? 'Yes' : 'No';
    document.getElementById('snap-salary').textContent = money(estimatedSalary.value);
  }

  // ---------- Retention recommendations (frontend-only, derived from risk_level) ----------
  const RECOMMENDATIONS = {
    high: [
      'Assign a relationship manager for a personal check-in call within 48 hours',
      'Offer a loyalty incentive — fee waiver, cashback, or rate upgrade',
      'Send a satisfaction survey to uncover the root cause of dissatisfaction',
      'Highlight underused products/benefits already included in their plan',
    ],
    medium: [
      'Send a personalized "we value you" email with a relevant offer',
      'Nudge toward a second product to increase engagement and stickiness',
      'Monitor activity closely over the next billing cycle',
    ],
    low: [
      'Continue standard relationship management — no urgent action needed',
      'Consider a cross-sell offer to deepen the relationship further',
      'Include in loyalty/rewards communications as a stable, engaged customer',
    ],
  };

  // ---------- Circular probability gauge (SVG) ----------
  function buildGaugeSVG(pct, colorVar) {
    const size = 148, stroke = 14, r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const offset = c - (pct / 100) * c;
    return `
      <svg class="gauge-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(13,42,94,0.08)" stroke-width="${stroke}"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${colorVar}" stroke-width="${stroke}"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}"
          transform="rotate(-90 ${size/2} ${size/2})" class="gauge-circle" data-target-offset="${offset}"/>
        <text x="50%" y="47%" text-anchor="middle" font-family="Poppins, sans-serif" font-size="26" font-weight="700" fill="#101a30">${pct}%</text>
        <text x="50%" y="63%" text-anchor="middle" font-family="Poppins, sans-serif" font-size="10.5" fill="#5b6b8c">CHURN PROB.</text>
      </svg>`;
  }

  // ---------- Predict ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await runPrediction();
  });

  async function runPrediction() {
    setLoading(true);

    const payload = {
      credit_score: parseFloat(creditScore.value),
      geography: geography.value,
      gender: gender.value,
      age: parseFloat(age.value),
      tenure: parseFloat(tenure.value),
      balance: parseFloat(balance.value) || 0,
      num_products: parseFloat(numProducts.value),
      has_cr_card: hasCrCard,
      is_active: isActive,
      estimated_salary: parseFloat(estimatedSalary.value) || 0,
    };

    try {
      const res = await fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Read the body ONCE, regardless of status — this is what fixes the
      // "predict does nothing" bug: some setups return a non-200 with a
      // valid JSON error body, which a strict `if (!res.ok) throw` would
      // swallow before the result was ever rendered.
      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error('Server returned an unexpected (non-JSON) response.');
      }

      renderResult(data);

    } catch (err) {
      resultArea.innerHTML = `
        <div class="error-box">
          <i class="bi bi-wifi-off"></i>
          <div>Couldn't reach the prediction server. ${err.message}</div>
        </div>`;
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    if (isLoading) {
      predictBtn.disabled = true;
      predictBtn.classList.add('loading');
      progressTrack.classList.add('active');
      progressFill.style.width = '0%';
      // indeterminate-feeling progress animation
      requestAnimationFrame(() => { progressFill.style.width = '78%'; });
    } else {
      progressFill.style.width = '100%';
      setTimeout(() => {
        progressTrack.classList.remove('active');
        progressFill.style.width = '0%';
      }, 350);
      predictBtn.disabled = false;
      predictBtn.classList.remove('loading');
    }
  }

  function renderResult(data) {
    if (!data || typeof data !== 'object') {
      resultArea.innerHTML = `<div class="error-box"><i class="bi bi-exclamation-triangle"></i><div>Received an empty response from the server.</div></div>`;
      return;
    }

    if (!data.ok) {
      const msg = data.message || 'The model could not produce a prediction.';
      resultArea.innerHTML = `<div class="warning-box"><i class="bi bi-exclamation-triangle-fill"></i><div>${escapeHtml(msg)}</div></div>`;
      return;
    }

    const pct = Number(data.probability);
    const risky = !!data.will_churn;
    const riskLevel = ['low', 'medium', 'high'].includes(data.risk_level) ? data.risk_level : (risky ? 'high' : 'low');

    const stateClass = risky ? 'risk' : 'safe';
    const color = risky ? 'var(--danger)' : 'var(--success)';
    const icon = risky ? 'bi-exclamation-octagon-fill' : 'bi-patch-check-fill';
    const title = risky ? 'High Churn Risk Detected' : 'Customer Likely to Stay';
    const desc = risky
      ? 'This customer shows strong churn signals based on their profile and activity. Early intervention can significantly improve retention odds.'
      : 'This customer shows healthy engagement and low churn probability. Standard relationship management is recommended.';
    const badgeLabel = riskLevel === 'high' ? 'HIGH RISK' : riskLevel === 'medium' ? 'MEDIUM RISK' : 'LOW RISK';

    const recs = RECOMMENDATIONS[riskLevel] || RECOMMENDATIONS.low;
    const recItems = recs.map(r => `<li><i class="bi bi-check-circle-fill"></i><span>${escapeHtml(r)}</span></li>`).join('');

    resultArea.innerHTML = `
      <div class="result-wrap">
        <div class="status-card ${stateClass}">
          <div class="gauge-row">
            ${buildGaugeSVG(pct, color)}
            <div class="result-headline">
              <span class="result-badge ${stateClass}"><i class="bi ${icon}"></i> ${badgeLabel}</span>
              <h3 class="result-title">${title}</h3>
              <p class="result-desc">${desc}</p>
            </div>
          </div>
        </div>
        <div class="recommend-box">
          <h4><i class="bi bi-lightbulb-fill"></i> Recommended Retention Actions</h4>
          <ul>${recItems}</ul>
        </div>
      </div>
    `;

    // animate the gauge stroke after paint
    requestAnimationFrame(() => {
      const circle = resultArea.querySelector('.gauge-circle');
      if (circle) {
        circle.style.transition = 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)';
        requestAnimationFrame(() => {
          circle.style.strokeDashoffset = circle.dataset.targetOffset;
        });
      }
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // initial paint
  updateSnapshot();
});
