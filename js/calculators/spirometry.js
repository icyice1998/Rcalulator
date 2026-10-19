// Spirometry interpretation
(function () {
  const Workup = typeof window !== 'undefined' && window.AcidBaseWorkup
    ? window.AcidBaseWorkup : require('./acidbase-workup.js');
  const UI = typeof window !== 'undefined' && window.UI ? window.UI : require('../ui.js');
  const Tree = typeof window !== 'undefined' && window.Tree ? window.Tree : require('../tree.js');

  const r1 = x => Math.round(x * 10) / 10;
  const has = (...xs) => xs.every(x => x !== null && x !== undefined && !Number.isNaN(x));

  function severityAts(fev1) {
    return fev1 > 70 ? 'mild' : fev1 >= 60 ? 'moderate' : fev1 >= 50 ? 'moderately severe'
      : fev1 >= 35 ? 'severe' : 'very severe';
  }
  function severityRestriction(fvc) {
    return fvc > 60 ? 'mild' : fvc >= 50 ? 'moderate' : fvc >= 35 ? 'severe' : 'very severe';
  }
  function gold(fev1) {
    return fev1 >= 80 ? 'GOLD 1 (mild)' : fev1 >= 50 ? 'GOLD 2 (moderate)' : fev1 >= 30 ? 'GOLD 3 (severe)' : 'GOLD 4 (very severe)';
  }

  function bronchodilator(v) {
    const out = [];
    const check = (name, pre, post) => {
      if (!has(pre, post) || pre <= 0) return null;
      const ml = (post - pre) * 1000, pct = (post - pre) / pre * 100;
      const pos = pct >= 12 && ml >= 200;
      out.push(`${name}: ${pre} -> ${post} L = ${ml >= 0 ? '+' : ''}${Math.round(ml)} mL (${r1(pct)}%): ${pos ? 'significant' : 'not significant'}`);
      return pos;
    };
    const a = check('FEV1', v.fev1Pre, v.fev1Post);
    const b = check('FVC', v.fvcPre, v.fvcPost);
    return { lines: out, tested: a !== null || b !== null, positive: a === true || b === true };
  }

  function interpret(input) {
    const v = { ...input };
    const sections = [];
    const path = new Set(['sp']);
    const warnings = [];
    if (!has(v.ratio) && has(v.fev1Pre, v.fvcPre) && v.fvcPre > 0) {
      v.ratio = Math.round(v.fev1Pre / v.fvcPre * 100) / 100;
      v.ratioCalc = true;
    }
    if (!has(v.age, v.ratio, v.fev1, v.fvc))
      return { path, warnings, summary: 'Enter age, FEV1 and FVC % predicted, and FEV1/FVC (or FEV1 and FVC litres)', sections: [] };
    const cut = v.age > 40 ? 0.70 : 0.75;

    // 1. Quality
    const qLines = [];
    if (!v.acceptable) qLines.push('Acceptability not confirmed: need good start, no cough in first second, no glottic closure or leak, and end of test (plateau > 1 s or time > 15 s)');
    if (!v.repeatable) qLines.push('Repeatability not confirmed: two largest FVC and FEV1 should be within 150 mL (3-8 efforts)');
    if (v.acceptable && v.repeatable) qLines.push('Acceptable and repeatable: interpret');
    else warnings.push('Interpret with caution until acceptability and repeatability are met.');
    sections.push({ title: '1  Quality', lines: qLines, flag: !(v.acceptable && v.repeatable) });

    // 2. Pattern
    const pLines = [`FEV1/FVC ${v.ratio}${v.ratioCalc ? ' (calculated)' : ''}: ${v.ratio < cut ? 'low' : 'normal'} (cut-off ${cut.toFixed(2)} for age ${v.age > 40 ? '> 40' : '<= 40'})`,
      `FEV1 ${v.fev1}% pred, FVC ${v.fvc}% pred` + (has(v.fef) ? `, FEF25-75 ${v.fef}% pred` : '')];
    let pattern, key;
    const fvcLow = v.fvc < 80;
    const bdr = bronchodilator(v);

    if (v.ratio < cut) {
      path.add('low');
      if (!fvcLow) {
        path.add('obsN');
        pattern = 'obstruction';
      } else {
        path.add('obsL');
        const gap = v.fvc - v.fev1;
        const corr = (70 - v.ratio * 100) + v.fvc;
        pLines.push(`FVC - FEV1 = ${r1(gap)} (>= 15 pure obstruction); corrected FVC = (70 - ratio%) + FVC% = ${r1(corr)} (> 80 pure obstruction)`);
        if (gap >= 15 || corr > 80) { path.add('pureObs'); pattern = 'obstruction'; pLines.push('Low FVC from air trapping: pure obstruction'); }
        else { path.add('mixed1'); pattern = 'mixed'; }
      }
    } else {
      path.add('nl');
      if (fvcLow) {
        path.add('fvcLow');
        if (v.fev1 > v.fvc) { path.add('restr'); pattern = 'restriction'; }
        else { path.add('mixed2'); pattern = 'mixed'; }
      } else {
        path.add('fvcNorm');
        if (has(v.fef) && v.fef < 65) { path.add('sad'); pattern = 'sad'; }
        else {
          pattern = 'normal';
          if (has(v.fef)) path.add('normal');
          else pLines.push('Enter FEF25-75% to check small airways');
        }
      }
    }

    let dx;
    if (pattern === 'obstruction') {
      const sev = severityAts(v.fev1);
      if (bdr.tested && path.has('obsN')) path.add(bdr.positive ? 'rev' : 'irrev');
      dx = `${sev[0].toUpperCase() + sev.slice(1)} airflow obstruction` + (bdr.tested ? (bdr.positive ? ', reversible (significant BDR)' : ', no significant BDR') : '');
      key = bdr.tested && !bdr.positive ? 'obsIrrev' : 'obsRev';
    } else if (pattern === 'mixed') {
      dx = `Mixed obstruction and restriction, ${severityAts(v.fev1)} (FEV1 ${v.fev1}%)` + (bdr.tested && bdr.positive ? ', with BDR' : '');
      key = 'mixedPattern';
    } else if (pattern === 'restriction') {
      const sev = severityRestriction(v.fvc);
      let site = '';
      key = 'restrGeneral';
      if (has(v.pef)) {
        if (v.pef > v.fev1) { site = ' (intraparenchymal: PEF > FEV1)'; key = 'restrIntra'; }
        else { site = ' (extraparenchymal: PEF <= FEV1, e.g. neuromuscular, chest wall, effort)'; key = 'restrExtra'; }
      }
      dx = `${sev[0].toUpperCase() + sev.slice(1)} restrictive pattern${site}`;
    } else if (pattern === 'sad') {
      dx = 'Small airway disease (FEF25-75 < 65%)';
      key = 'sad';
    } else {
      dx = 'Normal spirometry' + (bdr.tested ? (bdr.positive ? ' with significant BDR' : ', no bronchodilator response') : '');
    }
    pLines.push(`Pattern: ${dx}`);
    sections.push({ title: '2  Pattern', lines: pLines, flag: pattern !== 'normal' });

    // 3. Bronchodilator response
    sections.push({ title: '3  Bronchodilator response', flag: bdr.positive,
      lines: bdr.tested ? [...bdr.lines, 'Significant = increase >= 12% AND >= 200 mL in FEV1 or FVC (salbutamol 400 mcg via spacer, 15 min)']
        : ['Enter pre and post FEV1 or FVC (L) to assess'] });

    // 4. Severity
    const sLines = [];
    if (pattern === 'obstruction' || pattern === 'mixed') {
      sLines.push(`ATS/ERS by FEV1 ${v.fev1}%: ${severityAts(v.fev1)} (> 70 mild, 60-69 moderate, 50-59 moderately severe, 35-49 severe, < 35 very severe)`);
      const post = has(v.fev1PostPct) ? v.fev1PostPct : null;
      sLines.push(post !== null ? `If COPD, post-BD FEV1 ${post}%: ${gold(post)}` : 'If COPD, enter post-BD FEV1 % predicted for GOLD grade');
    }
    if (pattern === 'restriction' || pattern === 'mixed')
      sLines.push(`Restriction by FVC ${v.fvc}%: ${severityRestriction(v.fvc)} (> 60 mild, 50-59 moderate, 35-49 severe, < 35 very severe)`);
    if (sLines.length) sections.push({ title: '4  Severity', lines: sLines, flag: true });

    // 5. Flow-volume loop
    const loop = LOOPS[v.loop];
    // summary is finalized after the loop check
    if (loop && v.loop !== 'normal') {
      const lLines = [loop.text];
      if (has(v.fefFif)) lLines.push(`FEF50/FIF50 = ${v.fefFif}: ${v.fefFif > 1.1 ? '> 1, variable extrathoracic' : v.fefFif < 0.9 ? '< 1, variable intrathoracic' : 'about 1, fixed obstruction'}`);
      if (loop.ddx) { lLines.push(...Workup.ddx(loop.ddx)); dx += `; ${loop.text.split(' (')[0].toLowerCase()}`; }
      sections.push({ title: '5  Flow-volume loop', lines: lLines, flag: true });
    }

    if (key) sections.push({ title: 'Top 5 differential diagnoses', lines: Workup.ddx(key).slice(2), flag: true });
    sections.push({ title: 'Next steps', lines: NEXT[pattern] });
    return { sections, path, summary: dx, warnings };
  }

  const LOOPS = {
    normal: { label: 'Normal shape' },
    scooped: { label: 'Scooped (concave) expiratory limb', text: 'Scooped expiratory limb: lower airway obstruction' },
    narrow: { label: 'Narrow, tall loop', text: 'Narrow-based loop with preserved shape: restriction' },
    inspFlat: { label: 'Flattened inspiratory limb', text: 'Variable extrathoracic upper airway obstruction (FEF50/FIF50 > 1)', ddx: 'uaoExtra' },
    expFlat: { label: 'Flattened expiratory limb', text: 'Variable intrathoracic upper airway obstruction (FEF50/FIF50 < 1)', ddx: 'uaoIntra' },
    bothFlat: { label: 'Both limbs flattened', text: 'Fixed upper airway obstruction (FEF50/FIF50 about 1)', ddx: 'uaoFixed' },
    biphasic: { label: 'Biphasic expiratory limb', text: 'Biphasic loop: unilateral main bronchus obstruction (valve-like)' },
  };

  const NEXT = {
    obstruction: ['Correlate: asthma vs COPD (age, smoking, variability, eosinophils)', 'COPD: post-BD FEV1/FVC < 0.70 confirms; GOLD grade by post-BD FEV1',
      'Lung volumes if FVC low (air trapping, RV/TLC > 40%); DLCO for emphysema'],
    mixed: ['Measure TLC to confirm true restriction (TLC < 80%)', 'DLCO to separate parenchymal from extraparenchymal cause'],
    restriction: ['Spirometry suggests restriction only: confirm with TLC < 80%', 'DLCO low: parenchymal (ILD); DLCO normal: chest wall, neuromuscular, obesity',
      'MIP / MEP if neuromuscular weakness suspected; HRCT if ILD suspected'],
    sad: ['Common early finding in smokers and asthma; repeat over time', 'Consider methacholine challenge if asthma suspected'],
    normal: ['If symptoms persist: methacholine challenge (asthma), DLCO (ILD, pulmonary vascular disease), CPET'],
  };

  // ---------- decision tree and tables ----------

  const TREE = {
    id: 'sp', text: 'Spirometry', note: 'Acceptable and repeatable? Check volume-time curve and loop shape',
    children: [
      {
        id: 'low', edge: 'FEV1/FVC < 0.70 (0.75 if age <= 40)', text: 'Airflow limitation',
        children: [
          {
            id: 'obsN', edge: 'FVC >= 80%', text: 'Obstruction', note: 'Bronchodilator response?',
            children: [
              { id: 'rev', edge: '>= 12% and >= 200 mL', text: 'Reversible obstruction', note: 'Asthma likely' },
              { id: 'irrev', edge: 'No', text: 'Irreversible obstruction', note: 'COPD likely' },
            ],
          },
          {
            id: 'obsL', edge: 'FVC < 80%', text: 'FVC - FEV1 >= 15 or corrected FVC > 80%?',
            children: [
              { id: 'pureObs', edge: 'Yes', text: 'Pure obstruction', note: 'Air trapping lowers FVC' },
              { id: 'mixed1', edge: 'No', text: 'Mixed pattern', note: 'Confirm with TLC' },
            ],
          },
        ],
      },
      {
        id: 'nl', edge: 'FEV1/FVC normal or high', text: 'No airflow limitation',
        children: [
          {
            id: 'fvcLow', edge: 'FVC < 80%', text: 'FEV1 % > FVC %?',
            children: [
              { id: 'restr', edge: 'Yes', text: 'Restrictive pattern', note: 'Confirm TLC < 80%, DLCO' },
              { id: 'mixed2', edge: 'No', text: 'Mixed pattern' },
            ],
          },
          {
            id: 'fvcNorm', edge: 'FVC >= 80%', text: 'FEF25-75%',
            children: [
              { id: 'sad', edge: '< 65%', text: 'Small airway disease' },
              { id: 'normal', edge: '>= 65%', text: 'Normal spirometry' },
            ],
          },
        ],
      },
    ],
  };

  const ETIOLOGY = [
    { group: 'Obstructive' },
    ['Lower airway', 'Low FEV1/FVC, scooped loop', 'Asthma, COPD, bronchiectasis, obliterative bronchiolitis, post-tuberculosis'],
    ['Variable extrathoracic', 'Flat inspiratory limb, FEF50/FIF50 > 1', 'Vocal cord paralysis or dysfunction, vocal cord polyp, extrathoracic tracheomalacia'],
    ['Variable intrathoracic', 'Flat expiratory limb, FEF50/FIF50 < 1', 'Tracheomalacia, relapsing polychondritis, tracheal tumor'],
    ['Fixed upper airway', 'Both limbs flat, FEF50/FIF50 about 1', 'Tracheal or subglottic stenosis, goiter, tracheal tumor'],
    ['Main bronchus', 'Biphasic loop', 'Unilateral main bronchus obstruction (valve-like)'],
    { group: 'Restrictive' },
    ['Interstitial (intraparenchymal)', 'Low compliance, PEF > FEV1, low DLCO', 'IPF, CTD-ILD, hypersensitivity pneumonitis, pneumoconiosis, sarcoidosis'],
    ['Alveolar filling', 'Low lung volume, low DLCO', 'Pulmonary edema, pneumonia, alveolar hemorrhage'],
    ['Pleural', 'Lung cannot expand', 'Pleural effusion, fibrothorax, mesothelioma'],
    ['Neuromuscular', 'Weak muscles, low MIP/MEP', 'Myasthenia gravis, ALS, GBS, muscular dystrophy, diaphragm paralysis'],
    ['Thoracic cage and abdomen', 'Stiff chest wall', 'Kyphoscoliosis, ankylosing spondylitis, obesity, ascites, pregnancy'],
  ];

  const NORMALS = [
    ['FEV1, FVC', '80-120% predicted'],
    ['FEV1/FVC', '> 0.70 (age > 40), > 0.75 (age <= 40)'],
    ['FEF25-75%', '> 65% predicted'],
    ['TLC', '80-120% predicted'],
    ['FRC, RV, DLCO', '75-120% predicted'],
    ['RV/TLC', '< 40%'],
  ];
  const WITHHOLD = [
    ['SABA (salbutamol)', '4-6 h'],
    ['SAMA (ipratropium)', '12 h'],
    ['LABA (formoterol, salmeterol)', '24 h'],
    ['Ultra-LABA (indacaterol, vilanterol, olodaterol)', '36 h'],
    ['LAMA (tiotropium, umeclidinium, glycopyrronium)', '36-48 h'],
  ];

  // ---------- UI ----------

  // Report-style grid: [row label, [pre L, pre %pred, post L, post %pred] field ids]
  const GRID = [
    ['FVC', ['fvcPre', 'fvc', 'fvcPost', null], 'L'],
    ['FEV1', ['fev1Pre', 'fev1', 'fev1Post', 'fev1PostPct'], 'L'],
    ['FEV1/FVC', ['ratio', null, null, null], 'ratio'],
    ['FEF25-75%', [null, 'fef', null, null], ''],
    ['PEF', [null, 'pef', null, null], ''],
  ];
  const IDS = ['age', 'fefFif', ...GRID.flatMap(r => r[1].filter(Boolean))];
  const EXAMPLE = { age: 55, fvcPre: 2.66, fvc: 69, fvcPost: 2.62, fev1Pre: 0.96, fev1: 32, fev1Post: 0.97, fev1PostPct: 32,
    ratio: 0.36, fef: 10, pef: 45, loop: 'scooped' };

  const cell = id => id
    ? `<td><input type="number" id="${id}" step="0.01" inputmode="decimal" aria-label="${id}"></td>` : '<td class="na">-</td>';

  function render(el) {
    const t2 = rows => `<div class="table-wrap"><table class="etio"><tbody>${rows.map(([a, b]) =>
      `<tr><td>${UI.esc(a)}</td><td>${UI.esc(b)}</td></tr>`).join('')}</tbody></table></div>`;
    el.innerHTML = `
      <div class="page-grid">
        <div class="abg-grid">
          <form class="card" id="spForm">
            <h2>Spirometry</h2>
            <p class="muted">Chest</p>
            <fieldset><legend>Quality</legend>
              <div class="check-row">
                <label for="acceptable"><input type="checkbox" id="acceptable" checked> 3 acceptable efforts</label>
                <label for="repeatable"><input type="checkbox" id="repeatable" checked> FVC and FEV1 within 150 mL</label>
              </div>
            </fieldset>
            <div class="pft-top">
              <label for="age">Age <input type="number" id="age" step="1" inputmode="numeric"></label>
              <label for="loop">Loop
                <select id="loop">${Object.entries(LOOPS).map(([k, l]) => `<option value="${k}">${l.label}</option>`).join('')}</select>
              </label>
              <label for="fefFif">FEF50/FIF50 <input type="number" id="fefFif" step="0.01" inputmode="decimal"></label>
            </div>
            <div class="table-wrap">
              <table class="pft-table">
                <thead><tr><th></th><th>Pre</th><th>%Pred</th><th>Post</th><th>%Pred</th></tr></thead>
                <tbody>${GRID.map(([label, ids]) => `<tr><th>${label}</th>${ids.map(cell).join('')}</tr>`).join('')}</tbody>
              </table>
            </div>
            <p class="muted small">Required: age, FEV1 and FVC %Pred, FEV1/FVC (left blank, it is calculated from Pre litres).
              Post values give the bronchodilator response.</p>
            <p class="muted small" id="exampleNote">Example loaded: lecture case 2 (COPD). Replace with your patient's values.</p>
            <button type="reset" class="btn secondary">Clear</button>
          </form>
          <div class="card result" id="spResult"></div>
        </div>
        <div class="card">
          <h3 class="section-title">Approach to spirometry</h3>
          ${Tree.render(TREE)}
          <p class="tree-legend">Highlighted boxes show the path for the values entered. Corrected FVC = (70 - FEV1/FVC%) + FVC% pred.</p>
        </div>
        <div class="card">
          <h3 class="section-title">Causes by pattern</h3>
          ${Tree.table(['Pattern', 'Clue', 'Causes'], ETIOLOGY)}
        </div>
        <div class="card">
          <h3 class="section-title">Normal values</h3>
          ${t2(NORMALS)}
          <h3 class="section-title" style="margin-top:16px">Withhold bronchodilator before testing</h3>
          ${t2(WITHHOLD)}
          <p class="muted small">Also avoid smoking or vaping and vigorous exercise within 1 h, intoxicants within 8 h, and tight clothing.</p>
        </div>
      </div>`;

    const form = el.querySelector('#spForm');
    Object.entries(EXAMPLE).forEach(([id, val]) => { el.querySelector('#' + id).value = val; });
    const update = () => {
      const v = readInputs(el);
      el.querySelector('#ratio').placeholder = has(v.fev1Pre, v.fvcPre) && v.fvcPre > 0
        ? (v.fev1Pre / v.fvcPre).toFixed(2) : '';
      show(el, interpret(v));
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('reset', e => {
      e.preventDefault();
      IDS.forEach(id => { el.querySelector('#' + id).value = ''; });
      el.querySelector('#loop').value = 'normal';
      el.querySelector('#exampleNote').hidden = true;
      update();
    });
    update();
  }

  function readInputs(el) {
    const v = {};
    IDS.forEach(id => {
      const raw = el.querySelector('#' + id).value;
      v[id] = raw === '' ? null : Number(raw);
    });
    v.loop = el.querySelector('#loop').value;
    v.acceptable = el.querySelector('#acceptable').checked;
    v.repeatable = el.querySelector('#repeatable').checked;
    return v;
  }

  function show(el, res) {
    const esc = UI.esc;
    el.querySelector('#spResult').innerHTML = `
      <h3>Interpretation</h3>
      <p class="summary-line">${esc(res.summary)}</p>
      ${res.warnings.map(w => `<p class="flag">${esc(w)}</p>`).join('')}
      ${res.sections.map(s => `
        <div class="step ${s.flag ? 'flagged' : ''}">
          <h4>${esc(s.title)}</h4>
          <pre>${s.lines.map(esc).join('\n')}</pre>
        </div>`).join('')}
      <p class="muted small">Decision support only. Interpret in clinical context.</p>`;
    Tree.highlight(el, res.path);
  }

  const api = { render, interpret };
  if (typeof window !== 'undefined') window.Spirometry = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
