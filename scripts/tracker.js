// Tracker client script - server-aware (falls back to local JSON/localStorage)
(async function() {
  const plansList = document.getElementById('plans-list');
  const search = document.getElementById('search');
  const sumCalories = document.getElementById('sum-calories');
  const sumProtein = document.getElementById('sum-protein');
  const sumCarbs = document.getElementById('sum-carbs');
  const sumFat = document.getElementById('sum-fat');
  const selectionSummary = document.getElementById('selection-summary');
  const addProgressBtn = document.getElementById('add-progress');
  const progressDate = document.getElementById('progress-date');
  const progressWeight = document.getElementById('progress-weight');
  const exportProgressCsv = document.getElementById('export-progress-csv');
  const resetProgress = document.getElementById('reset-progress');
  const notesEl = document.getElementById('notes');
  const clearSelection = document.getElementById('clear-selection');
  const exportSelected = document.getElementById('export-selected');

  let plans = [];
  let serverAvailable = false;

  async function loadPlans() {
    try {
      const res = await fetch('/api/plans');
      if (res.ok) {
        const payload = await res.json();
        plans = payload.plans || [];
        serverAvailable = true;
        return;
      }
    } catch (e) {
      // server not available, fallback
    }

    try {
      const res2 = await fetch('data/diet-plans.json');
      plans = await res2.json();
    } catch (e) {
      plans = [];
      console.error('Failed to load plans', e);
    }
  }

  function renderPlans(list) {
    plansList.innerHTML = '';
    list.forEach((p, idx) => {
      const id = 'plan-' + idx;
      const header = document.createElement('h2');
      header.className = 'accordion-header';
      header.id = 'heading-' + id;

      const btn = document.createElement('button');
      btn.className = 'accordion-button collapsed';
      btn.type = 'button';
      btn.setAttribute('data-bs-toggle', 'collapse');
      btn.setAttribute('data-bs-target', '#collapse-' + id);
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'collapse-' + id);
      btn.innerHTML = `${p.title || p.name || 'Plan'} <div class="plan-meta ms-2 small">${p.description || ''}</div>`;

      header.appendChild(btn);

      const body = document.createElement('div');
      body.id = 'collapse-' + id;
      body.className = 'accordion-collapse collapse';
      body.setAttribute('aria-labelledby', 'heading-' + id);

      const bodyInner = document.createElement('div');
      bodyInner.className = 'accordion-body';

      const meta = document.createElement('div');
      meta.className = 'mb-2';
      meta.innerHTML = `<div class="d-flex justify-content-between"><div><strong>Type:</strong> ${p.type || 'general'}</div><div class="owner-badge">${p.owner || ''}</div></div>`;
      bodyInner.appendChild(meta);

      if (p.meals && p.meals.length) {
        p.meals.forEach(m => {
          const mEl = document.createElement('div');
          mEl.className = 'mb-2';
          mEl.innerHTML = `<div class="fw-bold">${m.name}</div><div class="small text-muted">${m.items.map(i => i.name).join(', ')}</div>`;
          bodyInner.appendChild(mEl);
        });
      }

      const actions = document.createElement('div');
      actions.className = 'mt-3 d-flex gap-2';
      const selectBtn = document.createElement('button');
      selectBtn.className = 'btn btn-sm btn-success';
      selectBtn.textContent = 'Select';
      selectBtn.addEventListener('click', () => selectPlan(p));
      actions.appendChild(selectBtn);

      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-sm btn-outline-primary';
      addBtn.textContent = 'Add to Progress (estimate)';
      addBtn.addEventListener('click', async () => {
        const today = new Date().toISOString().slice(0, 10);
        const calories = p.estimateCalories || 0;
        await addProgress({ date: today, weight: null, calories });
        alert('Progress entry added (calories only)');
      });
      actions.appendChild(addBtn);

      bodyInner.appendChild(actions);

      body.appendChild(bodyInner);

      const item = document.createElement('div');
      item.className = 'accordion-item mb-2';
      item.appendChild(header);
      item.appendChild(body);

      plansList.appendChild(item);
    });
  }

  function selectPlan(p) {
    selectionSummary.textContent = `${p.title || p.name} selected`;
    const totals = computeTotals(p);
    sumCalories.textContent = totals.calories;
    sumProtein.textContent = totals.protein + 'g';
    sumCarbs.textContent = totals.carbs + 'g';
    sumFat.textContent = totals.fat + 'g';
    localStorage.setItem('ml_last_selection', JSON.stringify(p));
  }

  function computeTotals(p) {
    let protein = 0, carbs = 0, fat = 0, calories = 0;
    if (!p.meals) {
      return { protein, carbs, fat, calories };
    }
    p.meals.forEach(m => {
      m.items && m.items.forEach(it => {
        protein += +(it.protein || 0);
        carbs += +(it.carbs || 0);
        fat += +(it.fat || 0);
        calories += +(it.calories || 0);
      });
    });
    return { protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), calories: Math.round(calories) };
  }

  // search
  function doSearch() {
    const q = (search.value || '').toLowerCase().trim();
    if (!q) {
      return renderPlans(plans);
    }
    const filtered = plans.filter(p => {
      const hay = JSON.stringify(p).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    renderPlans(filtered);
  }
  search.addEventListener('input', doSearch);

  // Progress storage: try server-backed, otherwise localStorage
  async function getProgress() {
    if (serverAvailable) {
      try {
        const res = await fetch('/api/progress');
        if (res.ok) {
          const payload = await res.json();
          return payload.progress || [];
        }
      } catch (e) {
        // fall back to local
      }
    }
    try {
      return JSON.parse(localStorage.getItem('ml_progress') || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveProgressLocal(arr) {
    localStorage.setItem('ml_progress', JSON.stringify(arr));
  }

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[2]) : null;
  }

  async function addProgress(entry) {
    if (serverAvailable) {
      try {
        const csrf = getCookie('csrf_token');
        const res = await fetch('/api/progress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrf || ''
          },
          body: JSON.stringify(entry)
        });
        if (res.ok) {
          return true;
        }
      } catch (e) {
        // fallback to local
      }
    }
    const arr = await getProgress();
    arr.push(entry);
    arr.sort((a, b) => a.date.localeCompare(b.date));
    saveProgressLocal(arr);
    return false;
  }

  addProgressBtn.addEventListener('click', async () => {
    const date = progressDate.value;
    const weight = progressWeight.value ? +progressWeight.value : null;
    if (!date) {
      return alert('Pick a date');
    }
    await addProgress({ date, weight });
    progressDate.value = '';
    progressWeight.value = '';
    await renderChart();
  });

  exportProgressCsv.addEventListener('click', async () => {
    const arr = await getProgress();
    if (!arr.length) {
      return alert('No progress to export');
    }
    const csv = ['date,weight,calories'].concat(arr.map(r => `${r.date || ''},${r.weight || ''},${r.calories || ''}`)).join('\n');
    downloadText('progress.csv', csv);
  });

  resetProgress.addEventListener('click', async () => {
    if (!confirm('Reset progress?')) {
      return;
    }
    // No server delete implemented - clear local fallback
    localStorage.removeItem('ml_progress');
    await renderChart();
  });

  clearSelection.addEventListener('click', () => {
    localStorage.removeItem('ml_last_selection');
    selectionSummary.textContent = 'No plan selected.';
    sumCalories.textContent = '0';
    sumProtein.textContent = '0g';
    sumCarbs.textContent = '0g';
    sumFat.textContent = '0g';
  });

  exportSelected.addEventListener('click', () => {
    const s = localStorage.getItem('ml_last_selection');
    if (!s) {
      return alert('No selection');
    }
    const p = JSON.parse(s);
    let rows = ['meal,item,quantity,protein,carbs,fat,calories'];
    p.meals && p.meals.forEach(m => {
      m.items && m.items.forEach(i => rows.push(`${m.name},${i.name},${i.quantity || ''},${i.protein || ''},${i.carbs || ''},${i.fat || ''},${i.calories || ''}`));
    });
    downloadText('plan.csv', rows.join('\n'));
  });

  function downloadText(name, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // Chart
  const ctx = document.getElementById('progressChart');
  let chart = null;
  async function renderChart() {
    const data = await getProgress();
    const labels = data.map(d => d.date);
    const weights = data.map(d => d.weight || null);
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = weights;
      chart.update();
      return;
    }
    chart = new Chart(ctx, {
      type: 'line', data: { labels, datasets: [{ label: 'Weight (kg)', data: weights, borderColor: '#007bff', backgroundColor: 'rgba(0,123,255,0.08)', spanGaps: true }] },
      options: { scales: { y: { beginAtZero: false } }, plugins: { legend: { display: true } } }
    });
  }

  // Save notes
  notesEl.value = localStorage.getItem('ml_notes') || '';
  notesEl.addEventListener('blur', () => localStorage.setItem('ml_notes', notesEl.value));

  // init
  await loadPlans();
  renderPlans(plans);
  const last = localStorage.getItem('ml_last_selection');
  if (last) {
    selectPlan(JSON.parse(last));
  }
  await renderChart();
})();
