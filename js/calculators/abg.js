// ABG interpretation — stepwise physiological approach
(function () {
  const Workup = typeof window !== 'undefined' && window.AcidBaseWorkup
    ? window.AcidBaseWorkup : require('./acidbase-workup.js');

  const NORMAL = { ph: 7.40, paco2: 40, hco3: 24, alb: 4.0 };
  const RANGE = {
    phLow: 7.35, phHigh: 7.45,
    paco2Low: 35, paco2High: 45,
    hco3Low: 22, hco3High: 26,
  };

  // Expected compensation; tol = acceptable deviation from the predicted value
  const COMP = {
    metAcidosis:  { tol: 2, text: 'Expected PaCO2 = 1.5 x HCO3 + 8 (+/-2)  [Winter]' },
    metAlkalosis: { tol: 2, text: 'Expected PaCO2 = 40 + 0.7 x (HCO3 - 24) (+/-2)' },
    respAcidAcute:   { k: 0.1,  tol: 2, text: 'Acute: HCO3 rises 1 per 10 mmHg PaCO2 rise' },
    respAcidChronic: { k: 0.35, tol: 2, text: 'Chronic: HCO3 rises 3.5 per 10 mmHg PaCO2 rise' },
    respAlkAcute:    { k: 0.2,  tol: 2, text: 'Acute: HCO3 falls 2 per 10 mmHg PaCO2 fall' },
    respAlkChronic:  { k: 0.4,  tol: 2, text: 'Chronic: HCO3 falls 4 per 10 mmHg PaCO2 fall' },
  };

  const DISORDERS = {
    auto: 'Auto-detect from values',
    metAcidosis: 'Metabolic acidosis',
    metAlkalosis: 'Metabolic alkalosis',
    respAcidosis: 'Respiratory acidosis',
    respAlkalosis: 'Respiratory alkalosis',
  };

  const r1 = x => Math.round(x * 10) / 10;
  const has = (...xs) => xs.every(x => x !== null && x !== undefined && !Number.isNaN(x));

  // ---------- calculations ----------

  function consistency(v) {
    const hMeasured = Math.pow(10, 9 - v.ph);
    const hCalc = 24 * v.paco2 / v.hco3;
    const diff = Math.abs(hCalc - hMeasured) / hMeasured;
    return { hMeasured, hCalc, ok: diff <= 0.1, diff };
  }

  function detectPrimary(v) {
    const lowH = v.hco3 < RANGE.hco3Low, highH = v.hco3 > RANGE.hco3High;
    const lowC = v.paco2 < RANGE.paco2Low, highC = v.paco2 > RANGE.paco2High;

    if (v.ph < RANGE.phLow) {
      if (lowH && highC) return { list: ['metAcidosis', 'respAcidosis'], mixed: true };
      if (lowH) return { list: ['metAcidosis'] };
      if (highC) return { list: ['respAcidosis'] };
    } else if (v.ph > RANGE.phHigh) {
      if (highH && lowC) return { list: ['metAlkalosis', 'respAlkalosis'], mixed: true };
      if (highH) return { list: ['metAlkalosis'] };
      if (lowC) return { list: ['respAlkalosis'] };
    } else {
      // Normal pH with abnormal PaCO2 and HCO3: primary follows the side of 7.40;
      // the compensation step then separates full compensation from a mixed disorder
      if (highC && highH) return { list: [v.ph < NORMAL.ph ? 'respAcidosis' : 'metAlkalosis'], normalPh: true };
      if (lowC && lowH) return { list: [v.ph > NORMAL.ph ? 'respAlkalosis' : 'metAcidosis'], normalPh: true };
      return { list: [], normalPh: true };
    }
    return { list: [] };
  }

  function compensation(type, v, chronicity) {
    const dC = v.paco2 - NORMAL.paco2;
    const verdict = (actual, exp, tol, ifHigh, ifLow) => {
      const lo = exp - tol, hi = exp + tol;
      if (actual > hi) return { lo, hi, status: 'high', note: ifHigh };
      if (actual < lo) return { lo, hi, status: 'low', note: ifLow };
      return { lo, hi, status: 'ok', note: 'Appropriate compensation' };
    };

    if (type === 'metAcidosis') {
      const c = COMP.metAcidosis, exp = 1.5 * v.hco3 + 8;
      return [{ formula: c.text, param: 'PaCO2', actual: v.paco2,
        ...verdict(v.paco2, exp, c.tol,
          'Concomitant respiratory acidosis (CNS depression / toxin, lung disease)',
          'Concomitant respiratory alkalosis (salicylate, sepsis)') }];
    }
    if (type === 'metAlkalosis') {
      const c = COMP.metAlkalosis, exp = 40 + 0.7 * (v.hco3 - NORMAL.hco3);
      return [{ formula: c.text, param: 'PaCO2', actual: v.paco2,
        ...verdict(v.paco2, exp, c.tol, 'Concomitant respiratory acidosis', 'Concomitant respiratory alkalosis') }];
    }
    if (type === 'respAcidosis' || type === 'respAlkalosis') {
      const acid = type === 'respAcidosis';
      const keys = chronicity === 'acute' ? ['Acute']
        : chronicity === 'chronic' ? ['Chronic'] : ['Acute', 'Chronic'];
      return keys.map(k => {
        const c = COMP[(acid ? 'respAcid' : 'respAlk') + k];
        const exp = NORMAL.hco3 + c.k * dC;
        return { formula: c.text, param: 'HCO3', actual: v.hco3,
          ...verdict(v.hco3, exp, c.tol, 'Concomitant metabolic alkalosis', 'Concomitant metabolic acidosis') };
      });
    }
    return [];
  }

  function anionGap(v) {
    if (!has(v.na, v.cl, v.hco3)) return null;
    const ag = v.na - (v.cl + v.hco3);
    const corr = has(v.alb) ? ag + 2.5 * (NORMAL.alb - v.alb) : null;
    const used = corr ?? ag;
    const normalAg = has(v.normalAg) ? v.normalAg : 12;
    const res = { ag, corr, used, normalAg, high: used > normalAg + 2 };

    if (res.high && v.hco3 < NORMAL.hco3) {
      const ratio = (used - normalAg) / (NORMAL.hco3 - v.hco3);
      let note;
      if (ratio < 0.4) note = 'Hyperchloremic normal-AG acidosis predominates';
      else if (ratio < 0.8) note = 'Combined high-AG and normal-AG metabolic acidosis';
      else if (ratio <= 2) note = 'Pure high-AG metabolic acidosis';
      else note = 'High-AG acidosis with concomitant metabolic alkalosis (or pre-existing compensated respiratory acidosis)';
      res.delta = { ratio, note };
    } else if (res.high) {
      res.delta = { ratio: null, note: 'High AG with HCO3 >= 24: suggests concomitant metabolic alkalosis' };
    }
    return res;
  }

  function oxygenation(v) {
    if (!has(v.pao2, v.fio2)) return null;
    const fio2 = v.fio2 > 1 ? v.fio2 / 100 : v.fio2;
    const pf = v.pao2 / fio2;
    const res = { pf, fio2 };
    if (pf <= 100) res.pfNote = 'Severe (<=100)';
    else if (pf <= 200) res.pfNote = 'Moderate (101-200)';
    else if (pf <= 300) res.pfNote = 'Mild (201-300)';
    else res.pfNote = 'Not in ARDS range (>300)';

    if (has(v.paco2)) {
      const patm = has(v.patm) ? v.patm : 760;
      const pAO2 = fio2 * (patm - 47) - v.paco2 / 0.8;
      res.pAO2 = pAO2;
      res.aa = pAO2 - v.pao2;
      if (has(v.age)) {
        res.aaExpected = v.age / 4 + 4;
        res.aaHigh = res.aa > res.aaExpected;
      }
    }
    return res;
  }

  function interpret(v) {
    const out = { steps: [], errors: [], warnings: [] };
    if (!has(v.ph, v.paco2, v.hco3)) {
      out.errors.push('pH, PaCO2 and HCO3 are required.');
      return out;
    }
    if (v.ph < 6.5 || v.ph > 8.0) out.errors.push('pH out of physiological range (6.5-8.0).');
    if (v.paco2 < 5 || v.paco2 > 150) out.errors.push('PaCO2 out of range (5-150 mmHg).');
    if (v.hco3 < 1 || v.hco3 > 60) out.errors.push('HCO3 out of range (1-60 mEq/L).');
    if (out.errors.length) return out;

    // Step 1: internal consistency
    const cons = consistency(v);
    out.steps.push({
      title: 'Step 1  Internal consistency (Henderson)',
      lines: [
        `[H+] from pH = ${r1(cons.hMeasured)} nmol/L; 24 x PaCO2 / HCO3 = ${r1(cons.hCalc)} nmol/L`,
        cons.ok ? 'Consistent (within 10%)' : `Inconsistent (${Math.round(cons.diff * 100)}% difference) - check sample or transcription`,
      ],
      flag: !cons.ok,
    });

    // Step 2: pH status
    const phStatus = v.ph < RANGE.phLow ? 'Acidemia' : v.ph > RANGE.phHigh ? 'Alkalemia' : 'Normal pH';
    out.steps.push({ title: 'Step 2  pH', lines: [`pH ${v.ph}: ${phStatus}`] });

    // Step 3: primary disorder
    let primary;
    if (v.selected && v.selected !== 'auto') {
      primary = { list: [v.selected], userSelected: true };
      const expectAcid = v.selected === 'metAcidosis' || v.selected === 'respAcidosis';
      if ((expectAcid && v.ph > RANGE.phHigh) || (!expectAcid && v.ph < RANGE.phLow)) {
        out.warnings.push(`Selected ${DISORDERS[v.selected]} conflicts with ${phStatus.toLowerCase()}; consider a mixed disorder or re-check the selection.`);
      }
    } else {
      primary = detectPrimary(v);
    }
    const pLines = primary.list.length
      ? [primary.list.map(k => DISORDERS[k]).join(' + ') + (primary.userSelected ? ' (user selected)' : '')]
      : ['No primary acid-base disorder identified from pH / PaCO2 / HCO3'];
    if (primary.mixed) pLines.push('Mixed disorder: PaCO2 and HCO3 both deviate in the direction of the pH change');
    if (primary.normalPh && primary.list.length) pLines.push('pH within normal range despite abnormal PaCO2 and HCO3: near-complete compensation or mixed disorder (see Step 4)');
    out.steps.push({ title: 'Step 3  Primary disorder', lines: pLines });

    // Step 4: compensation (first/primary disorder only when not mixed)
    if (primary.list.length && !primary.mixed) {
      const type = primary.list[0];
      const comps = compensation(type, v, v.chronicity);
      const lines = [];
      comps.forEach(c => {
        lines.push(c.formula);
        lines.push(`  Expected ${c.param} ${r1(c.lo)} - ${r1(c.hi)}; measured ${c.actual}: ${c.note}`);
      });
      if (comps.length === 2) {
        const [a, ch] = comps;
        const lo = Math.min(a.lo, ch.lo), hi = Math.max(a.hi, ch.hi);
        if (v.hco3 >= lo && v.hco3 <= hi && a.status !== 'ok' && ch.status !== 'ok')
          lines.push('  HCO3 lies between acute and chronic predictions: consider acute-on-chronic');
      }
      out.steps.push({ title: 'Step 4  Expected compensation', lines, flag: comps.some(c => c.status !== 'ok') });
    }

    // Step 5: anion gap
    const ag = anionGap(v);
    if (ag) {
      const lines = [`AG = Na - (Cl + HCO3) = ${r1(ag.ag)} mEq/L`];
      if (ag.corr !== null) lines.push(`Albumin-corrected AG = AG + 2.5 x (4 - albumin) = ${r1(ag.corr)} mEq/L`);
      lines.push(ag.high ? `Elevated (normal ${ag.normalAg} +/- 2)` : `Not elevated (normal ${ag.normalAg} +/- 2)`);
      if (ag.delta) {
        if (ag.delta.ratio !== null)
          lines.push(`Delta ratio = (AG - ${ag.normalAg}) / (24 - HCO3) = ${Math.round(ag.delta.ratio * 100) / 100}`);
        lines.push(ag.delta.note);
      }
      if (ag.high && !primary.list.includes('metAcidosis'))
        lines.push('High AG present despite no primary metabolic acidosis on pH/HCO3: hidden HAGMA');
      out.steps.push({ title: 'Step 5  Anion gap', lines, flag: ag.high });
    } else {
      out.steps.push({ title: 'Step 5  Anion gap', lines: ['Enter Na and Cl to calculate (always check, even if pH is normal)'], muted: true });
    }

    // Step 6: oxygenation
    const ox = oxygenation(v);
    if (ox) {
      const lines = [`P/F ratio = ${Math.round(ox.pf)}: ${ox.pfNote}`];
      if (ox.aa !== undefined) {
        lines.push(`PAO2 = FiO2 x (Patm - 47) - PaCO2/0.8 = ${Math.round(ox.pAO2)} mmHg`);
        lines.push(`A-a gradient = ${Math.round(ox.aa)} mmHg` +
          (ox.aaExpected !== undefined
            ? ` (expected <= ${r1(ox.aaExpected)} for age): ${ox.aaHigh ? 'Elevated' : 'Normal'}`
            : ' (enter age for expected value)'));
      }
      out.steps.push({ title: 'Step 6  Oxygenation', lines, flag: ox.pf <= 300 || ox.aaHigh });
    }

    // Step 7: second-tier workup
    out.workups = [];
    const metAcid = primary.list.includes('metAcidosis') || v.hco3 < RANGE.hco3Low;
    if (ag && ag.high) {
      out.workups.push('hagma');
      out.steps.push({ title: 'Step 7  Further workup: High-AG metabolic acidosis', ...Workup.hagma(v) });
      if (ag.delta && ag.delta.ratio !== null && ag.delta.ratio < 0.8) {
        out.workups.push('urine');
        out.steps.push({ title: 'Step 7  Further workup: coexisting normal-AG acidosis', ...Workup.nagma(v) });
      }
    } else if (ag && metAcid) {
      out.workups.push('urine');
      out.steps.push({ title: 'Step 7  Further workup: Normal-AG metabolic acidosis', ...Workup.nagma(v) });
    } else if (!ag && metAcid) {
      out.steps.push({ title: 'Step 7  Further workup', lines: ['Enter Na and Cl to classify metabolic acidosis as high-AG or normal-AG'], muted: true });
    }
    if (primary.list.includes('metAlkalosis') || (ag && ag.delta && ag.delta.ratio > 2)) {
      out.workups.push('urine', 'alk');
      out.steps.push({ title: 'Step 7  Further workup: Metabolic alkalosis', ...Workup.metAlkalosis(v) });
    }

    return out;
  }

  // ---------- UI ----------

  const FIELDS = [
    { group: 'Blood gas', id: 'ph',    label: 'pH',    unit: '',      step: '0.01' },
    { group: 'Blood gas', id: 'paco2', label: 'PaCO2', unit: 'mmHg',  step: '0.1' },
    { group: 'Blood gas', id: 'hco3',  label: 'HCO3-', unit: 'mEq/L', step: '0.1' },
    { group: 'Electrolytes', id: 'na',  label: 'Na+',     unit: 'mEq/L', step: '0.1' },
    { group: 'Electrolytes', id: 'k',   label: 'K+',      unit: 'mEq/L', step: '0.1' },
    { group: 'Electrolytes', id: 'cl',  label: 'Cl-',     unit: 'mEq/L', step: '0.1' },
    { group: 'Electrolytes', id: 'alb', label: 'Albumin', unit: 'g/dL',  step: '0.1' },
    { group: 'Electrolytes', id: 'normalAg', label: 'Lab normal AG', unit: 'mEq/L', step: '1', placeholder: '12' },
    { group: 'Oxygenation', id: 'pao2', label: 'PaO2', unit: 'mmHg', step: '0.1' },
    { group: 'Oxygenation', id: 'fio2', label: 'FiO2', unit: '% or fraction', step: '0.01' },
    { group: 'Oxygenation', id: 'age',  label: 'Age',  unit: 'years', step: '1' },
    { group: 'Oxygenation', id: 'patm', label: 'Patm', unit: 'mmHg', step: '1', placeholder: '760' },

    { group: 'Urine studies', key: 'urine', id: 'una',   label: 'Urine Na',   unit: 'mEq/L', step: '1' },
    { group: 'Urine studies', key: 'urine', id: 'uk',    label: 'Urine K',    unit: 'mEq/L', step: '1' },
    { group: 'Urine studies', key: 'urine', id: 'ucl',   label: 'Urine Cl',   unit: 'mEq/L', step: '1' },
    { group: 'Urine studies', key: 'urine', id: 'uph',   label: 'Urine pH',   unit: '',      step: '0.1' },
    { group: 'Urine studies', key: 'urine', id: 'uosm',  label: 'Urine osm',  unit: 'mOsm/kg', step: '1' },
    { group: 'Urine studies', key: 'urine', id: 'uurea', label: 'Urine urea', unit: 'mg/dL', step: '1' },
    { group: 'Urine studies', key: 'urine', id: 'uglu',  label: 'Urine glucose', unit: 'mg/dL', step: '1' },
    { group: 'Urine studies', key: 'urine', id: 'uhco3', label: 'Urine HCO3', unit: 'mEq/L', step: '0.1' },
    { group: 'Urine studies', key: 'urine', id: 'ucr',   label: 'Urine Cr',   unit: 'mg/dL', step: '0.1' },
    { group: 'Urine studies', key: 'urine', id: 'scr',   label: 'Serum Cr',   unit: 'mg/dL', step: '0.01' },

    { group: 'HAGMA workup', key: 'hagma', id: 'lactate', label: 'Lactate', unit: 'mmol/L', step: '0.1' },
    { group: 'HAGMA workup', key: 'hagma', id: 'ketone',  label: 'Ketone (beta-OHB)', unit: 'mmol/L', step: '0.1' },
    { group: 'HAGMA workup', key: 'hagma', id: 'egfr',    label: 'eGFR', unit: 'mL/min/1.73m2', step: '1' },
    { group: 'HAGMA workup', key: 'hagma', id: 'sosm',    label: 'Measured serum osm', unit: 'mOsm/kg', step: '1' },
    { group: 'HAGMA workup', key: 'hagma', id: 'bun',     label: 'BUN', unit: 'mg/dL', step: '1' },
    { group: 'HAGMA workup', key: 'hagma', id: 'glu',     label: 'Glucose', unit: 'mg/dL', step: '1' },

    { group: 'Metabolic alkalosis workup', key: 'alk', id: 'bp', label: 'BP / volume', type: 'select',
      options: [['', 'Not specified'], ['high', 'Hypertension'], ['low', 'Normotension / hypotension']] },
    { group: 'Metabolic alkalosis workup', key: 'alk', id: 'pac',   label: 'PAC', unit: 'ng/dL', step: '0.1' },
    { group: 'Metabolic alkalosis workup', key: 'alk', id: 'pra',   label: 'PRA', unit: 'ng/mL/h', step: '0.01' },
    { group: 'Metabolic alkalosis workup', key: 'alk', id: 'ucacr', label: 'Urine Ca/Cr', unit: 'mg/mg', step: '0.01' },
  ];

  function fieldHtml(f) {
    const input = f.type === 'select'
      ? `<select id="${f.id}">${f.options.map(([val, l]) => `<option value="${val}">${l}</option>`).join('')}</select>`
      : `<input type="number" id="${f.id}" step="${f.step}" inputmode="decimal" placeholder="${f.placeholder || ''}">`;
    return `
      <div class="field">
        <label for="${f.id}">${f.label} <span class="unit">${f.unit || ''}</span></label>
        ${input}
      </div>`;
  }

  function groupHtml(g) {
    const fs = FIELDS.filter(f => f.group === g);
    const grid = `<div class="form-grid">${fs.map(fieldHtml).join('')}</div>`;
    return fs[0].key
      ? `<details class="sub" data-key="${fs[0].key}"><summary>${g}</summary>${grid}</details>`
      : `<fieldset><legend>${g}</legend>${grid}</fieldset>`;
  }

  function render(el) {
    const groups = [...new Set(FIELDS.map(f => f.group))];
    el.innerHTML = `
      <div class="card">
        <h2>ABG interpretation</h2>
        <p class="muted">Critical care</p>
        <form id="abgForm">
          <fieldset>
            <legend>Primary disorder</legend>
            <div class="form-grid">
              <div class="field">
                <label for="selected">Disorder</label>
                <select id="selected">
                  ${Object.entries(DISORDERS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}
                </select>
              </div>
              <div class="field" id="chronicityField">
                <label for="chronicity">Respiratory chronicity</label>
                <select id="chronicity">
                  <option value="unknown">Unknown (show both)</option>
                  <option value="acute">Acute (&lt; 24-48 h)</option>
                  <option value="chronic">Chronic (&gt; 3-5 days)</option>
                </select>
              </div>
            </div>
          </fieldset>
          ${groups.map(groupHtml).join('')}
          <button type="submit" class="btn">Interpret</button>
          <button type="reset" class="btn secondary">Clear</button>
        </form>
      </div>
      <div class="card" id="abgResult" hidden></div>
      <details class="card">
        <summary>Formulas and references</summary>
        <pre class="ref">${referenceText()}</pre>
      </details>`;

    const form = el.querySelector('#abgForm');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const res = interpret(readInputs(el));
      (res.workups || []).forEach(k => {
        const d = el.querySelector(`details[data-key="${k}"]`);
        if (d) d.open = true;
      });
      showResult(res);
    });
    form.addEventListener('reset', () => {
      document.getElementById('abgResult').hidden = true;
    });
  }

  function readInputs(el) {
    const v = {};
    FIELDS.forEach(f => {
      const raw = el.querySelector('#' + f.id).value;
      v[f.id] = f.type === 'select' ? raw : raw === '' ? null : Number(raw);
    });
    v.selected = el.querySelector('#selected').value;
    v.chronicity = el.querySelector('#chronicity').value;
    return v;
  }

  function esc(s) {
    return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  function showResult(res) {
    const out = document.getElementById('abgResult');
    out.hidden = false;
    if (res.errors.length) {
      out.innerHTML = `<h3>Result</h3>${res.errors.map(e => `<p class="flag">${esc(e)}</p>`).join('')}`;
      return;
    }
    out.innerHTML = `
      <h3>Result</h3>
      ${res.warnings.map(w => `<p class="flag">${esc(w)}</p>`).join('')}
      ${res.steps.map(s => `
        <div class="step ${s.flag ? 'flagged' : ''} ${s.muted ? 'muted' : ''}">
          <h4>${esc(s.title)}</h4>
          <pre>${s.lines.map(esc).join('\n')}</pre>
        </div>`).join('')}
      <p class="muted small">Decision support only. Interpret in clinical context.</p>`;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function referenceText() {
    return esc(`Reference ranges
  pH 7.35-7.45 | PaCO2 35-45 mmHg | HCO3 22-26 mEq/L

Internal consistency
  [H+] (nmol/L) = 24 x PaCO2 / HCO3 ;  [H+] = 10^(9 - pH)

Expected compensation
  Metabolic acidosis     PaCO2 = 1.5 x HCO3 + 8 (+/-2)        Winter
  Metabolic alkalosis    PaCO2 = 40 + 0.7 x (HCO3 - 24) (+/-2)
  Resp acidosis  acute   HCO3 +1   per 10 mmHg PaCO2 rise
                 chronic HCO3 +3.5 per 10 mmHg PaCO2 rise
  Resp alkalosis acute   HCO3 -2   per 10 mmHg PaCO2 fall
                 chronic HCO3 -4   per 10 mmHg PaCO2 fall

Anion gap
  AG = Na - (Cl + HCO3)             normal 12 +/- 2 (lab-dependent)
  Corrected AG = AG + 2.5 x (4 - albumin g/dL)
  Delta ratio = (AG - 12) / (24 - HCO3)
    < 0.4      hyperchloremic normal-AG acidosis
    0.4 - 0.8  combined high-AG + normal-AG acidosis
    0.8 - 2.0  pure high-AG acidosis
    > 2.0      high-AG acidosis + metabolic alkalosis

Oxygenation
  P/F = PaO2 / FiO2     Berlin ARDS: mild 201-300, moderate 101-200, severe <=100
  PAO2 = FiO2 x (Patm - 47) - PaCO2 / 0.8
  A-a gradient = PAO2 - PaO2 ; expected (room air) <= age/4 + 4

Normal-AG metabolic acidosis (spot urine while pH < 7.35)
  UNC = (UNa + UK) - UCl          negative: GI loss / pRTA ; positive: impaired NH4+
  Calc Uosm = 2(UNa + UK) + Uurea/2.8 + Uglucose/18
  UOG = measured - calculated Uosm   < 100 impaired NH4+ ; >= 100 adequate
    UNC and UOG disagree -> rely on UOG
  Impaired NH4+:  K low/normal          -> classical / backleak dRTA
                  K high + UpH > 5.5    -> voltage-dependent dRTA
                  K high + UpH < 5.5    -> type 4 RTA
  FE HCO3 = (UHCO3 x SCr)/(SHCO3 x UCr) x 100   > 15% pRTA ; < 5% normal
  Limitations: UNa < 25, unmeasured anions, bicarbonaturia (UpH > 7.5), GFR < 20

High-AG metabolic acidosis
  L-lactate -> ketone -> renal insufficiency -> D-lactate -> toxin
  Calc Sosm = 2Na + BUN/2.8 + Glucose/18
  Serum OG = measured - calculated   > 10 elevated ; > 20-25 toxic alcohol
  High OG: methanol, ethylene glycol, propylene glycol
  Normal OG: salicylate, hippurate (toluene), pyroglutamate

Metabolic alkalosis
  Exclude exogenous alkali
  UCl < 20                -> extra-renal salt loss (vomiting, NG, remote diuretic)
  UCl >= 20 + HT          -> mineralocorticoid excess -> PAC / PRA
  UCl >= 20 + normo/hypoT -> renal salt loss (diuretic, Bartter, Gitelman)
  Urine Ca/Cr > 0.2 Bartter-like ; < 0.07 Gitelman-like (mg/mg)
  Primary aldosteronism: PAC >= 10 ng/dL, PRA <= 1 ng/mL/h, ARR > 20

Sources
  Nata N. Case-based approach of normal anion gap metabolic acidosis.
    Nephrology Division, Phramongkutklao Hospital (lecture).
  Khemmongkon M. Electrolyte and acid-base disorders 2026 (lecture).
  Berend K, de Vries AP, Gans RO. Physiological approach to assessment of
    acid-base disturbances. N Engl J Med 2014;371:1434-45.
  Seifter JL. Integration of acid-base and electrolyte disorders.
    N Engl J Med 2014;371:1821-31.
  Kraut JA, Madias NE. Serum anion gap: its uses and limitations in
    clinical medicine. Clin J Am Soc Nephrol 2007;2:162-74.
  Figge J, et al. Anion gap and hypoalbuminemia. Crit Care Med 1998;26:1807-10.
  ARDS Definition Task Force. Acute respiratory distress syndrome:
    the Berlin Definition. JAMA 2012;307:2526-33.
  Batlle DC, et al. The use of the urinary anion gap in the diagnosis of
    hyperchloremic metabolic acidosis. N Engl J Med 1988;318:594-9.
  Kraut JA, Madias NE. Differential diagnosis of nongap metabolic acidosis:
    value of a systematic approach. Clin J Am Soc Nephrol 2012;7:671-9.
  Kraut JA, Kurtz I. Toxic alcohol ingestions: clinical features, diagnosis,
    and management. Clin J Am Soc Nephrol 2008;3:208-25.
  Funder JW, et al. Management of primary aldosteronism: Endocrine Society
    clinical practice guideline. J Clin Endocrinol Metab 2016;101:1889-916.`);
  }

  const api = { render, interpret, consistency, detectPrimary, compensation, anionGap, oxygenation };
  if (typeof window !== 'undefined') window.ABG = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
