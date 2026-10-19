// Asthma: diagnosis, control and risk, treatment step, exacerbation
(function () {
  const UI = typeof window !== 'undefined' && window.UI ? window.UI : require('../ui.js');
  const Tree = typeof window !== 'undefined' && window.Tree ? window.Tree : require('../tree.js');

  const r1 = x => Math.round(x * 10) / 10;
  const has = (...xs) => xs.every(x => x !== null && x !== undefined && !Number.isNaN(x));
  const ddx = list => list.map((d, i) => `  ${i + 1}. ${d}`);

  // ---------- 1. Diagnosis ----------

  function diagnosis(v) {
    const lines = [];
    const path = new Set(['ad']);
    const positives = [];

    if (has(v.fev1Pre, v.fev1Post) && v.fev1Pre > 0) {
      const ml = (v.fev1Post - v.fev1Pre) * 1000, pct = (v.fev1Post - v.fev1Pre) / v.fev1Pre * 100;
      const pos = pct >= 12 && ml >= 200;
      const strong = pct >= 15 && ml >= 400;
      lines.push(`BDR: FEV1 +${Math.round(ml)} mL (${r1(pct)}%): ${pos ? (strong ? 'positive, high confidence (>= 15% and >= 400 mL)' : 'positive (>= 12% and >= 200 mL)') : 'negative'}`);
      if (pos) positives.push('bronchodilator responsiveness');
    }
    if (has(v.pefPre, v.pefPost) && v.pefPre > 0) {
      const pct = (v.pefPost - v.pefPre) / v.pefPre * 100;
      lines.push(`PEF after BD +${r1(pct)}%: ${pct >= 20 ? 'positive (>= 20%)' : 'negative'}`);
      if (pct >= 20) positives.push('PEF reversibility');
    }
    if (has(v.pefMax, v.pefMin) && v.pefMax + v.pefMin > 0) {
      const dv = (v.pefMax - v.pefMin) / ((v.pefMax + v.pefMin) / 2) * 100;
      lines.push(`Diurnal PEF variability = (max - min) / mean = ${r1(dv)}%: ${dv > 10 ? '> 10%, excessive' : '<= 10%'}`);
      if (dv > 10) positives.push('PEF variability');
    }
    if (has(v.ics4Pre, v.ics4Post) && v.ics4Pre > 0) {
      const ml = (v.ics4Post - v.ics4Pre) * 1000, pct = (v.ics4Post - v.ics4Pre) / v.ics4Pre * 100;
      const pos = pct >= 12 && ml >= 200;
      lines.push(`After 4 weeks ICS: FEV1 +${Math.round(ml)} mL (${r1(pct)}%): ${pos ? 'positive' : 'negative'}`);
      if (pos) positives.push('response to ICS');
    }
    let challenge = null;
    if (has(v.chFall) && v.chType) {
      const cut = { methacholine: 20, indirect: 15, exercise: 10 }[v.chType];
      challenge = v.chFall >= cut;
      lines.push(`Bronchial challenge (${v.chType}): FEV1 fall ${v.chFall}%: ${challenge ? `positive (>= ${cut}%)` : 'negative'}`);
      if (challenge) positives.push('bronchial challenge');
    }

    // Type 2 biomarkers
    let t2 = false;
    if (has(v.bec)) {
      const hi = v.bec >= 150;
      t2 = t2 || hi;
      lines.push(`Blood eosinophils ${v.bec}/uL: ${v.bec >= 300 ? '>= 300, type 2 (biologic threshold)' : hi ? '>= 150, suggests type 2' : '< 150'}`);
    }
    if (has(v.feno)) {
      const cut = { naive: 50, medium: 25, high: 20 }[v.icsStatus || 'naive'];
      const hi = v.icsStatus === 'naive' ? v.feno > cut : v.feno >= cut;
      t2 = t2 || hi;
      lines.push(`FeNO ${v.feno} ppb: ${hi ? 'high' : 'not high'} (cut-off ${cut} for ${{ naive: 'ICS-naive', medium: 'medium-dose ICS', high: 'high-dose ICS' }[v.icsStatus || 'naive']})`);
    }

    let dx;
    if (v.typical) {
      path.add('hi'); path.add('spiroH');
      if (positives.length && !positives.every(p => p === 'bronchial challenge')) { path.add('defLF'); dx = 'Definite asthma (lung function confirmed)'; }
      else if (challenge) { path.add('notconf'); path.add('bc'); dx = 'Definite asthma (bronchial challenge confirmed)'; }
      else if (t2) { path.add('notconf'); path.add('bio'); dx = 'Biomarker-supported asthma'; }
      else if (lines.length) { path.add('notconf'); dx = 'Not yet confirmed: repeat during symptoms, add biomarkers or bronchial challenge'; }
      else dx = 'Enter lung function or biomarker results';
    } else {
      path.add('lo'); path.add('spiroL');
      if (positives.length) { path.add('chal'); path.add('possible'); dx = 'Possible asthma: variable airflow present, exclude alternative diagnoses'; }
      else if (challenge === false) { path.add('chal'); path.add('noasthma'); dx = 'Asthma unlikely: look for alternative diagnosis'; }
      else dx = 'Low pre-test likelihood: spirometry with BDR, then bronchial challenge';
    }
    if (challenge === false && v.typical)
      lines.push('Negative challenge with typical history: out of season, remote occupational exposure, recent steroid, or mimic (VCD, central airway obstruction)');
    if (positives.length) lines.push(`Variable expiratory airflow confirmed by: ${positives.join(', ')}`);
    return { dx, lines, path, t2 };
  }

  // ---------- 2. Control and risk ----------

  const CONTROL = [
    ['cDay', 'Daytime symptoms > 2 times/week'],
    ['cNight', 'Any night waking due to asthma'],
    ['cRel', 'Reliever needed > 2 times/week'],
    ['cAct', 'Any activity limitation due to asthma'],
  ];
  const RISKS = [
    ['rSaba', 'High SABA use (>= 3 canisters/year)'],
    ['rNoIcs', 'No ICS'],
    ['rExac', '>= 1 severe exacerbation in last year'],
    ['rIcu', 'Ever intubated or ICU for asthma'],
    ['rAdh', 'Poor adherence or inhaler technique'],
    ['rCom', 'Obesity, rhinosinusitis, GERD, food allergy, pregnancy'],
    ['rExp', 'Smoking, e-cigarette, allergen, pollution'],
    ['rPsy', 'Psychological or socioeconomic problems'],
    ['rFev', 'FEV1 < 60% predicted'],
    ['rT2', 'High BEC or FeNO'],
  ];

  function control(v) {
    const n = CONTROL.filter(([id]) => v[id]).length;
    const level = n === 0 ? 'Well controlled' : n <= 2 ? 'Partly controlled' : 'Uncontrolled';
    const risks = RISKS.filter(([id]) => v[id]).map(([, l]) => l);
    const lines = [`Symptom control (past 4 weeks): ${n} of 4 -> ${level}`];
    lines.push(risks.length ? `Exacerbation risk increased (${risks.length} factor${risks.length > 1 ? 's' : ''}): ${risks.join('; ')}` : 'No exacerbation risk factor marked');
    return { level, n, risks, lines };
  }

  // ---------- 3. Treatment step (GINA adults and adolescents) ----------

  const STEPS = {
    1: { t1: 'As-needed low-dose ICS-formoterol (AIR-only)', t2: 'Take ICS whenever SABA is taken (ICS + SABA)' },
    2: { t1: 'As-needed low-dose ICS-formoterol (AIR-only)', t2: 'Low-dose maintenance ICS + as-needed SABA' },
    3: { t1: 'Low-dose ICS-formoterol maintenance and reliever (MART)', t2: 'Low-dose ICS-LABA + as-needed SABA or ICS-SABA' },
    4: { t1: 'Medium-dose ICS-formoterol MART', t2: 'Medium-dose ICS-LABA + as-needed SABA or ICS-SABA' },
    5: { t1: 'Add-on LAMA; refer for phenotype; consider high-dose ICS-formoterol; biologic (anti-IgE, anti-IL5/5R, anti-IL4Ra, anti-TSLP)',
      t2: 'Add-on LAMA; refer for phenotype; consider high-dose ICS-LABA; biologic' },
  };

  function treatment(v, ctl) {
    const lines = [];
    let step;
    if (v.current) {
      const cur = Number(v.current);
      if (ctl.level === 'Well controlled') {
        step = cur;
        lines.push(`On step ${cur}, well controlled: continue; consider step down after 3 months of good control`);
      } else {
        step = Math.min(5, cur + 1);
        lines.push(`On step ${cur}, ${ctl.level.toLowerCase()}: check inhaler technique, adherence, comorbidities and triggers first, then step up to ${step}`);
      }
      const sev = cur <= 2 ? 'mild' : cur === 3 ? 'moderate' : 'severe (if uncontrolled on optimized step 4-5: assess as difficult-to-treat or severe asthma)';
      if (ctl.level === 'Well controlled') lines.push(`Severity (controlled on step ${cur}): ${sev}`);
    } else {
      step = { mild: 2, most: 3, daily: 4 }[v.start];
      lines.push({ mild: 'Symptoms < 3-5 days/week with normal or mildly reduced lung function: start step 1-2',
        most: 'Symptoms most days, or waking >= 1/week, or low lung function: start step 3',
        daily: 'Daily symptoms or waking >= 1/week with low lung function or recent exacerbation: start step 4; short OCS course may be needed' }[v.start]);
    }
    lines.push(`Track 1 (preferred, reliever ICS-formoterol): ${STEPS[step].t1}`);
    lines.push(`Track 2 (alternative): ${STEPS[step].t2}`);
    lines.push('All patients: written action plan, inhaler technique, adherence, treat modifiable risks; review in 1-3 months');
    return { step, lines };
  }

  // ---------- 4. Exacerbation ----------

  function exacerbation(v) {
    const path = new Set(['ex']);
    const lines = [];
    const severe = [];
    if (v.talk === 'words') severe.push('talks in words');
    if (v.hunched) severe.push('sits hunched / agitated / accessory muscles');
    if (has(v.rr) && v.rr > 30) severe.push(`RR ${v.rr} > 30`);
    if (has(v.hr) && v.hr > 120) severe.push(`HR ${v.hr} > 120`);
    if (has(v.spo2) && v.spo2 < 90) severe.push(`SpO2 ${v.spo2}% < 90`);
    if (has(v.pefEx) && v.pefEx <= 50) severe.push(`PEF ${v.pefEx}% <= 50`);

    let level;
    if (v.altered) {
      level = 'Life-threatening';
      path.add('lt');
      lines.push('Drowsy, confused or silent chest: consult ICU, start SABA and O2, prepare for intubation');
    } else if (severe.length) {
      level = 'Severe';
      path.add('sev');
      lines.push(`Severe by worst feature: ${severe.join(', ')}`);
      lines.push('Treat: SABA + ipratropium, controlled O2 to SpO2 93-95%, oral or IV corticosteroid,',
        '  consider IV magnesium sulfate 2 g over 20 min, consider high-dose ICS; transfer to acute care');
    } else {
      level = 'Mild to moderate';
      path.add('mm');
      lines.push('Talks in phrases, RR raised but <= 30, HR 100-120, SpO2 90-95%, PEF > 50%');
      lines.push('Treat: SABA (e.g. salbutamol 4-10 puffs by pMDI and spacer every 20 min for 1 h), consider ipratropium,',
        '  controlled O2 to SpO2 93-95%, oral prednisolone 40-50 mg');
    }
    if (has(v.pef1h)) {
      path.add('reass');
      if (v.pef1h >= 60) {
        path.add('disch');
        lines.push(`1 h after treatment PEF ${v.pef1h}%: ${v.pef1h > 80 ? '> 80%, good response' : '60-80%, moderate'}: plan discharge if symptoms improved`);
      } else {
        path.add('cont');
        lines.push(`1 h after treatment PEF ${v.pef1h}% < 60%: severe, continue treatment and reassess frequently; consider ICU if deteriorating`);
      }
    }
    lines.push('Discharge: prednisolone 40-50 mg/day for 5-7 days; start or step up ICS for 2-4 weeks; review technique,',
      '  give written action plan; follow up within 2-7 days');
    return { level, lines, path };
  }

  // ---------- trees and tables ----------

  const DX_TREE = {
    id: 'ad', text: 'Chronic or recurrent respiratory symptoms', note: 'Wheeze, dyspnea, chest tightness, cough varying over time',
    children: [
      {
        id: 'hi', edge: 'Typical + supportive history', text: 'High pre-test likelihood',
        children: [{
          id: 'spiroH', text: 'Spirometry with BDR or PEF variability',
          children: [
            { id: 'defLF', edge: 'Variable airflow', text: 'Definite asthma', note: 'Lung function confirmed' },
            {
              id: 'notconf', edge: 'Not confirmed', text: 'Biomarkers or challenge',
              children: [
                { id: 'bio', edge: 'BEC or FeNO high', text: 'Biomarker-supported asthma' },
                { id: 'bc', edge: 'Challenge positive', text: 'Definite asthma', note: 'Challenge confirmed' },
              ],
            },
          ],
        }],
      },
      {
        id: 'lo', edge: 'Atypical symptoms', text: 'Low pre-test likelihood',
        children: [{
          id: 'spiroL', text: 'Spirometry with BDR',
          children: [{
            id: 'chal', text: 'Bronchial challenge',
            children: [
              { id: 'possible', edge: 'Variable / positive', text: 'Possible asthma', note: 'Exclude alternatives' },
              { id: 'noasthma', edge: 'Negative', text: 'No asthma', note: 'Alternative diagnosis' },
            ],
          }],
        }],
      },
    ],
  };

  const EX_TREE = {
    id: 'ex', text: 'Asthma exacerbation', note: 'Assess ABC, triage by worst feature',
    children: [
      { id: 'lt', edge: 'Drowsy, confused, silent chest', text: 'Life-threatening', note: 'ICU, SABA, O2, prepare intubation' },
      { id: 'sev', edge: 'Words, RR > 30, HR > 120, SpO2 < 90, PEF <= 50%', text: 'Severe', note: 'SABA + ipratropium, O2, steroid, IV Mg' },
      { id: 'mm', edge: 'Phrases, HR 100-120, SpO2 90-95, PEF > 50%', text: 'Mild to moderate', note: 'SABA, O2, oral steroid' },
      {
        id: 'reass', edge: '1 h after treatment', text: 'FEV1 or PEF',
        children: [
          { id: 'disch', edge: '60-80% and improved', text: 'Plan discharge' },
          { id: 'cont', edge: '< 60% or poor response', text: 'Continue, reassess, consider ICU' },
        ],
      },
    ],
  };

  const DDX_TABLE = [
    { group: 'Upper airway' },
    ['Foreign body, postnasal drip', 'Localized or upper airway symptoms', 'Vocal cord dysfunction, upper airway obstruction, tracheobronchomalacia'],
    { group: 'Pulmonary' },
    ['COPD, bronchiectasis', 'Fixed obstruction, sputum', 'ABPA, EGPA, cystic fibrosis, ILD, lung cancer, pneumonia, pneumothorax, sarcoidosis'],
    { group: 'Cardiac' },
    ['Left ventricular failure', 'Orthopnea, edema', 'Angina, mitral valve disease'],
    { group: 'Other' },
    ['GERD, obesity', 'Non-variable symptoms', 'Anemia, carcinoid, hyperventilation, mastocytosis, functional'],
  ];

  const ICS_DOSE = [
    ['Beclometasone dipropionate (HFA)', '100-200', '> 200-400', '> 400'],
    ['Budesonide (DPI)', '200-400', '> 400-800', '> 800'],
    ['Ciclesonide (HFA)', '80-160', '> 160-320', '> 320'],
    ['Fluticasone furoate (DPI)', '100', '-', '200'],
    ['Fluticasone propionate (DPI or HFA)', '100-250', '> 250-500', '> 500'],
    ['Mometasone furoate', '110-220', '> 220-440', '> 440'],
  ];

  const VS_COPD = [
    ['Onset', 'Childhood or early adulthood', 'Usually > 40 years, smoking'],
    ['Reversibility', 'Largely reversible', 'Partially reversible, progressive'],
    ['Inflammation', 'Type 2 eosinophilic', 'Neutrophilic'],
    ['Associations', 'Allergy, eczema, rhinitis', 'Chronic bronchitis, emphysema'],
    ['Lung function', 'May be normal between episodes', 'Persistently obstructive, declines'],
    ['Symptoms', 'Worse at night or early morning', 'Persistent, exertional'],
    ['ICS response', 'Good', 'Inconsistent'],
  ];

  // ---------- UI ----------

  const box = (id, label, unit, step) => UI.fieldHtml({ id, label, unit, step: step || '1' });
  const checks = list => `<div class="check-row">${list.map(([id, l]) =>
    `<label for="${id}"><input type="checkbox" id="${id}"> ${l}</label>`).join('')}</div>`;
  const resultBox = (id, title) => `<div class="step flagged" id="${id}"><h4>${title}</h4><pre></pre></div>`;

  function render(el) {
    const t = (head, rows) => Tree.table(head, rows);
    el.innerHTML = `
      <div class="page-grid">
        <div class="card">
          <h2>Asthma</h2>
          <p class="muted">Chest</p>
          <p>Heterogeneous disease with chronic airway inflammation, defined by variable respiratory symptoms
            (wheeze, dyspnea, chest tightness, cough) together with variable expiratory airflow limitation.</p>
          <p class="muted small">Work through the four sections in order. Each updates as you type.</p>
        </div>

        <div class="abg-grid">
          <form class="card" id="asDx">
            <h3 class="section-title">1  Diagnosis</h3>
            ${checks([['typical', 'Typical variable symptoms with supportive history']])}
            <fieldset><legend>Reversibility</legend><div class="form-grid">
              ${box('fev1Pre', 'FEV1 pre', 'L', '0.01')}${box('fev1Post', 'FEV1 post', 'L', '0.01')}
              ${box('pefPre', 'PEF pre', 'L/min')}${box('pefPost', 'PEF post', 'L/min')}</div></fieldset>
            <fieldset><legend>Variability</legend><div class="form-grid">
              ${box('pefMax', 'PEF highest (2 weeks)', 'L/min')}${box('pefMin', 'PEF lowest', 'L/min')}
              ${box('ics4Pre', 'FEV1 before ICS', 'L', '0.01')}${box('ics4Post', 'FEV1 after 4 weeks ICS', 'L', '0.01')}</div></fieldset>
            <fieldset><legend>Challenge and type 2 biomarkers</legend><div class="form-grid">
              ${UI.fieldHtml({ id: 'chType', label: 'Challenge', type: 'select', options: [['', 'Not done'], ['methacholine', 'Methacholine'], ['indirect', 'Mannitol / saline / hyperventilation'], ['exercise', 'Exercise']] })}
              ${box('chFall', 'FEV1 fall', '%')}
              ${box('bec', 'Blood eosinophils', '/uL')}${box('feno', 'FeNO', 'ppb')}
              ${UI.fieldHtml({ id: 'icsStatus', label: 'Current ICS', type: 'select', options: [['naive', 'ICS-naive'], ['medium', 'Medium dose'], ['high', 'High dose']] })}
            </div></fieldset>
          </form>
          <div class="card result">${resultBox('asDxOut', 'Diagnosis')}</div>
        </div>

        <div class="abg-grid">
          <form class="card" id="asCtl">
            <h3 class="section-title">2  Control and risk</h3>
            <fieldset><legend>In the past 4 weeks</legend>${checks(CONTROL)}</fieldset>
            <fieldset><legend>Risk factors for exacerbation</legend>${checks(RISKS)}</fieldset>
            <h3 class="section-title">3  Treatment step</h3>
            <div class="form-grid">
              ${UI.fieldHtml({ id: 'current', label: 'Current GINA step', type: 'select', options: [['', 'Not on treatment'], ['1', 'Step 1'], ['2', 'Step 2'], ['3', 'Step 3'], ['4', 'Step 4'], ['5', 'Step 5']] })}
              ${UI.fieldHtml({ id: 'start', label: 'If starting: presentation', type: 'select', options: [['mild', 'Symptoms < 3-5 days/week'], ['most', 'Most days or night waking or low LF'], ['daily', 'Daily + low LF or recent exacerbation']] })}
            </div>
          </form>
          <div class="card result">${resultBox('asCtlOut', 'Control and risk')}${resultBox('asTxOut', 'Treatment step')}</div>
        </div>

        <div class="abg-grid">
          <form class="card" id="asEx">
            <h3 class="section-title">4  Exacerbation</h3>
            ${checks([['altered', 'Drowsy, confused or silent chest'], ['hunched', 'Hunched, agitated or accessory muscles']])}
            <div class="form-grid">
              ${UI.fieldHtml({ id: 'talk', label: 'Talks in', type: 'select', options: [['phrases', 'Phrases'], ['words', 'Words']] })}
              ${box('rr', 'Respiratory rate', '/min')}${box('hr', 'Pulse', '/min')}${box('spo2', 'SpO2 on air', '%')}
              ${box('pefEx', 'PEF', '% pred or best')}${box('pef1h', 'PEF 1 h after treatment', '% pred or best')}
            </div>
          </form>
          <div class="card result">${resultBox('asExOut', 'Exacerbation')}</div>
        </div>

        <div class="card">
          <h3 class="section-title">Approach to diagnosis</h3>
          <div id="asDxTree">${Tree.render(DX_TREE)}</div>
          <h3 class="section-title" style="margin-top:16px">Approach to exacerbation</h3>
          <div id="asExTree">${Tree.render(EX_TREE)}</div>
          <p class="tree-legend">Highlighted boxes show the path for the values entered.</p>
        </div>
        <div class="card">
          <h3 class="section-title">Differential diagnosis of asthma</h3>
          ${t(['Group', 'Clue', 'Conditions'], DDX_TABLE)}
          <h3 class="section-title" style="margin-top:16px">Asthma vs COPD</h3>
          ${t(['Feature', 'Asthma', 'COPD'], VS_COPD)}
          <h3 class="section-title" style="margin-top:16px">ICS daily dose (mcg), adults and adolescents</h3>
          ${t(['Inhaled corticosteroid', 'Low', 'Medium', 'High'], ICS_DOSE)}
        </div>
      </div>`;

    const ids = ['fev1Pre', 'fev1Post', 'pefPre', 'pefPost', 'pefMax', 'pefMin', 'ics4Pre', 'ics4Post', 'chFall', 'bec', 'feno', 'rr', 'hr', 'spo2', 'pefEx', 'pef1h'];
    const sels = ['chType', 'icsStatus', 'current', 'start', 'talk'];
    const flags = ['typical', 'altered', 'hunched', ...CONTROL.map(c => c[0]), ...RISKS.map(r => r[0])];
    const example = { typical: true, fev1Pre: 2.10, fev1Post: 2.45, bec: 350, feno: 62, cDay: true, cRel: true, rSaba: true };
    Object.entries(example).forEach(([id, val]) => {
      const i = el.querySelector('#' + id);
      if (i.type === 'checkbox') i.checked = val; else i.value = val;
    });

    const update = () => {
      const v = {};
      ids.forEach(id => { const raw = el.querySelector('#' + id).value; v[id] = raw === '' ? null : Number(raw); });
      sels.forEach(id => { v[id] = el.querySelector('#' + id).value; });
      flags.forEach(id => { v[id] = el.querySelector('#' + id).checked; });
      const res = interpret(v);
      const put = (id, lines) => { el.querySelector(`#${id} pre`).textContent = lines.join('\n'); };
      put('asDxOut', [res.dx.dx, '', ...res.dx.lines, '', 'Top 5 differential diagnoses:', ...ddx(res.ddxList)]);
      put('asCtlOut', res.ctl.lines);
      put('asTxOut', res.tx.lines);
      put('asExOut', [res.ex.level, '', ...res.ex.lines]);
      Tree.highlight(el.querySelector('#asDxTree'), res.dx.path);
      Tree.highlight(el.querySelector('#asExTree'), res.ex.path);
    };
    el.querySelectorAll('form').forEach(f => {
      f.addEventListener('input', update);
      f.addEventListener('change', update);
      f.addEventListener('submit', e => e.preventDefault());
    });
    update();
  }

  function interpret(v) {
    const dx = diagnosis(v);
    const ctl = control(v);
    const tx = treatment(v, ctl);
    const ex = exacerbation(v);
    const ddxList = dx.path.has('noasthma') || dx.path.has('possible')
      ? ['Vocal cord dysfunction', 'COPD', 'Bronchiectasis', 'Left ventricular failure', 'GERD or postnasal drip']
      : dx.t2 ? ['Type 2 (allergic or eosinophilic) asthma', 'ABPA', 'EGPA', 'Eosinophilic bronchitis', 'Asthma-COPD overlap']
        : ['Asthma', 'COPD', 'Vocal cord dysfunction', 'Bronchiectasis', 'Left ventricular failure'];
    return { dx, ctl, tx, ex, ddxList };
  }

  const api = { render, interpret, diagnosis, control, treatment, exacerbation };
  if (typeof window !== 'undefined') window.Asthma = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
