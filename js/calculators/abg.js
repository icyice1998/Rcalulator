// ABG interpretation — oxygenation, ventilation, acid-base
(function () {
  const Workup = typeof window !== 'undefined' && window.AcidBaseWorkup
    ? window.AcidBaseWorkup : require('./acidbase-workup.js');
  const UI = typeof window !== 'undefined' && window.UI ? window.UI : require('../ui.js');

  const NORMAL = { ph: 7.40, paco2: 40, hco3: 24 };
  const RANGE = {
    phLow: 7.35, phHigh: 7.45,
    paco2Low: 35, paco2High: 45,
    hco3Low: 22, hco3High: 26,
  };
  const TOL = 2;      // +/- around predicted compensation
  const PATM = 760;
  const RQ = 0.8;

  // Respiratory compensation: HCO3 change per 1 mmHg PaCO2 change; dph = pH change per 1 mmHg
  const RESP = {
    acidAcute:   { k: [0.1, 0.1],  dph: 0.008, text: 'acute: HCO3 +1 per 10 mmHg' },
    acidChronic: { k: [0.35, 0.4], dph: 0.003, text: 'chronic: HCO3 +3.5 to 4 per 10 mmHg' },
    alkAcute:    { k: [0.2, 0.2],  dph: 0.008, text: 'acute: HCO3 -2 per 10 mmHg' },
    alkChronic:  { k: [0.4, 0.5],  dph: 0.002, text: 'chronic: HCO3 -4 to 5 per 10 mmHg' },
  };

  const DISORDERS = {
    auto: 'Auto-detect from values',
    metAcidosis: 'Metabolic acidosis',
    metAlkalosis: 'Metabolic alkalosis',
    respAcidosis: 'Respiratory acidosis',
    respAlkalosis: 'Respiratory alkalosis',
  };
  const DDX_KEY = {
    metAcidosis: 'metAcid', metAlkalosis: 'metAlk', respAcidosis: 'respAcid', respAlkalosis: 'respAlk',
  };

  const r1 = x => Math.round(x * 10) / 10;
  const r2 = x => Math.round(x * 100) / 100;
  const has = (...xs) => xs.every(x => x !== null && x !== undefined && !Number.isNaN(x));

  // ---------- calculations ----------

  function oxygenation(v) {
    const fio2 = v.fio2 > 1 ? v.fio2 / 100 : v.fio2;
    const roomAir = Math.abs(fio2 - 0.21) < 0.005;
    const res = { fio2, roomAir, pf: v.pao2 / fio2 };
    res.pAO2 = fio2 * (PATM - 47) - v.paco2 / RQ;
    res.aa = res.pAO2 - v.pao2;
    res.aaNormal = 2.5 + v.age / 4;
    res.aaWide = res.aa > res.aaNormal;

    if (roomAir) {
      res.grade = v.pao2 < 40 ? 'Severe hypoxemia' : v.pao2 < 60 ? 'Moderate hypoxemia'
        : v.pao2 < 80 ? 'Mild hypoxemia' : 'No hypoxemia';
      res.hypoxemic = v.pao2 < 80;
    } else {
      res.grade = res.pf <= 100 ? 'Severe impairment (P/F <= 100)' : res.pf <= 200 ? 'Moderate impairment (P/F 101-200)'
        : res.pf <= 300 ? 'Mild impairment (P/F 201-300)' : 'Adequate oxygenation (P/F > 300)';
      res.hypoxemic = res.pf <= 300;
    }
    return res;
  }

  function ventilation(v) {
    if (v.paco2 < RANGE.paco2Low) return { label: 'Hyperventilation', note: 'PaCO2 < 35, hypocapnia', abnormal: true };
    if (v.paco2 > RANGE.paco2High) return { label: 'Hypoventilation', note: 'PaCO2 > 45, hypercapnia', abnormal: true };
    return { label: 'Normal ventilation', note: 'PaCO2 35-45', abnormal: false };
  }

  function consistency(v) {
    const hMeasured = Math.pow(10, 9 - v.ph);
    const hCalc = 24 * v.paco2 / v.hco3;
    return { ok: Math.abs(hCalc - hMeasured) / hMeasured <= 0.1, hMeasured, hCalc };
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
      // Normal pH: primary follows the side of 7.40; compensation separates full compensation from mixed
      if (highC && highH) return { list: [v.ph < NORMAL.ph ? 'respAcidosis' : 'metAlkalosis'], normalPh: true };
      if (lowC && lowH) return { list: [v.ph > NORMAL.ph ? 'respAlkalosis' : 'metAcidosis'], normalPh: true };
      return { list: [], normalPh: true };
    }
    return { list: [] };
  }

  function verdict(actual, lo, hi) {
    return { lo, hi, status: actual > hi ? 'high' : actual < lo ? 'low' : 'ok' };
  }

  function compensation(type, v, chronicity) {
    if (type === 'metAcidosis') {
      const exp = 1.5 * v.hco3 + 8;
      return [{ text: 'Winter: PaCO2 = 1.5 x HCO3 + 8 +/- 2', param: 'PaCO2', actual: v.paco2,
        high: 'respiratory acidosis', low: 'respiratory alkalosis', ...verdict(v.paco2, exp - TOL, exp + TOL) }];
    }
    if (type === 'metAlkalosis') {
      const a = 0.7 * v.hco3 + 20, b = 40 + 0.7 * (v.hco3 - NORMAL.hco3);
      return [{ text: 'PaCO2 = 0.7 x HCO3 + 20 +/- 2', param: 'PaCO2', actual: v.paco2,
        high: 'respiratory acidosis', low: 'respiratory alkalosis',
        ...verdict(v.paco2, Math.min(a, b) - TOL, Math.max(a, b) + TOL) }];
    }
    const acid = type === 'respAcidosis';
    const dC = v.paco2 - NORMAL.paco2;
    const phases = chronicity === 'acute' ? ['Acute'] : chronicity === 'chronic' ? ['Chronic'] : ['Acute', 'Chronic'];
    return phases.map(p => {
      const c = RESP[(acid ? 'acid' : 'alk') + p];
      const e = c.k.map(k => NORMAL.hco3 + k * dC);
      return { phase: p, text: c.text, param: 'HCO3', actual: v.hco3,
        high: 'metabolic alkalosis', low: 'metabolic acidosis',
        ...verdict(v.hco3, Math.min(...e) - TOL, Math.max(...e) + TOL) };
    });
  }

  function respPhFit(type, v) {
    const acid = type === 'respAcidosis';
    const dC = v.paco2 - NORMAL.paco2;
    const acute = NORMAL.ph - RESP[acid ? 'acidAcute' : 'alkAcute'].dph * dC;
    const chronic = NORMAL.ph - RESP[acid ? 'acidChronic' : 'alkChronic'].dph * dC;
    return { acute, chronic };
  }

  // Name the acid-base diagnosis in one phrase
  function diagnose(primary, comps, type) {
    if (!primary.list.length) return 'No acid-base disorder';
    if (primary.mixed) return primary.list.map(k => DISORDERS[k]).join(' + ') + ' (mixed)';
    const name = DISORDERS[type];
    if (comps.length === 1) {
      const c = comps[0];
      return c.status === 'ok' ? `${name}, appropriately compensated` : `${name} + ${c[c.status]}`;
    }
    const [a, ch] = comps;
    if (a.status === 'ok' && ch.status !== 'ok') return `Acute ${name.toLowerCase()}`;
    if (ch.status === 'ok' && a.status !== 'ok') return `Chronic ${name.toLowerCase()}`;
    if (a.status === 'ok' && ch.status === 'ok') return `${name} (acute or chronic)`;
    const lo = Math.min(a.lo, ch.lo), hi = Math.max(a.hi, ch.hi);
    if (a.actual > lo && a.actual < hi) return `Acute-on-chronic ${name.toLowerCase()}`;
    return `${name} + ${a.actual > hi ? 'metabolic alkalosis' : 'metabolic acidosis'}`;
  }

  function interpret(v) {
    const out = { summary: [], sections: [], warnings: [] };

    // 1. Oxygenation
    const ox = oxygenation(v);
    const oxLines = [
      ox.roomAir ? `PaO2 ${v.pao2} mmHg on room air: ${ox.grade}`
        : `PaO2/FiO2 = ${v.pao2} / ${r2(ox.fio2)} = ${Math.round(ox.pf)}: ${ox.grade}`,
      `A-a gradient = ${r1(ox.aa)} mmHg (normal <= 2.5 + age/4 = ${r1(ox.aaNormal)}): ${ox.aaWide ? 'Wide' : 'Normal'}`,
    ];
    if (!ox.roomAir) oxLines.push('  Age-based A-a normal applies to room air; A-a widens with higher FiO2');
    let oxSummary = ox.grade;
    if (ox.hypoxemic) {
      const mech = ox.aaWide ? 'V/Q mismatch, shunt or diffusion defect'
        : v.paco2 > RANGE.paco2High ? 'alveolar hypoventilation' : 'low inspired O2 or hypoventilation';
      oxLines.push(`Mechanism: ${mech}`);
      oxLines.push(...Workup.ddx(ox.aaWide ? 'hypoxWide' : 'hypoxNormal'));
      oxSummary += ox.aaWide ? ' (wide A-a)' : ' (normal A-a)';
    }
    out.sections.push({ title: '1  Oxygenation', lines: oxLines, flag: ox.hypoxemic });
    out.summary.push(oxSummary);

    // 2. Ventilation
    const vent = ventilation(v);
    out.sections.push({ title: '2  Ventilation', flag: vent.abnormal,
      lines: [`PaCO2 ${v.paco2} mmHg: ${vent.label} (${vent.note})`] });
    out.summary.push(vent.label);

    // 3. Acid-base
    const cons = consistency(v);
    if (!cons.ok) out.warnings.push(`Values do not fit together: [H+] from pH ${r1(cons.hMeasured)} vs 24 x PaCO2/HCO3 ${r1(cons.hCalc)} nmol/L. Check the numbers.`);

    const phStatus = v.ph < RANGE.phLow ? 'Acidemia' : v.ph > RANGE.phHigh ? 'Alkalemia' : 'Normal pH';
    let primary;
    if (v.selected && v.selected !== 'auto') {
      primary = { list: [v.selected], userSelected: true };
      const acid = v.selected === 'metAcidosis' || v.selected === 'respAcidosis';
      if ((acid && v.ph > RANGE.phHigh) || (!acid && v.ph < RANGE.phLow))
        out.warnings.push(`Selected ${DISORDERS[v.selected].toLowerCase()} does not fit ${phStatus.toLowerCase()}.`);
    } else {
      primary = detectPrimary(v);
    }

    const abLines = [`pH ${v.ph}: ${phStatus}`];
    let comps = [];
    const type = primary.list[0];
    if (type) {
      abLines.push(`Primary: ${primary.list.map(k => DISORDERS[k]).join(' + ')}${primary.userSelected ? ' (selected)' : ''}`);
      comps = compensation(type, v, v.chronicity);
      comps.forEach(c => {
        const res = comps.length > 1 ? (c.status === 'ok' ? `fits ${c.phase.toLowerCase()}` : `does not fit ${c.phase.toLowerCase()}`)
          : c.status === 'ok' ? 'appropriate' : `${c.status === 'high' ? 'above' : 'below'} range -> + ${c[c.status]}`;
        abLines.push(`Expected ${c.param} ${r1(c.lo)}-${r1(c.hi)} (${c.text}); measured ${c.actual}: ${res}`);
      });
      if (type === 'respAcidosis' || type === 'respAlkalosis') {
        const p = respPhFit(type, v);
        abLines.push(`Expected pH: acute ${r2(p.acute)}, chronic ${r2(p.chronic)}; measured ${v.ph}`);
      }
    }
    const dx = diagnose(primary, comps, type);
    abLines.push(`Diagnosis: ${dx}`);
    primary.list.forEach(k => {
      if (primary.list.length > 1) abLines.push('', `${DISORDERS[k]}:`);
      abLines.push(...Workup.ddx(DDX_KEY[k]));
    });
    if (primary.list.includes('metAcidosis'))
      abLines.push('', 'Next: Nephrology > Metabolic acidosis for anion gap and workup');
    out.sections.push({ title: '3  Acid-base', lines: abLines, flag: primary.list.length > 0 });
    out.summary.push(dx);
    return out;
  }

  // ---------- UI ----------

  const SLIDERS = [
    { group: 'Blood gas', id: 'ph',    label: 'pH',    unit: '',      min: 6.8, max: 7.8, step: 0.01, value: 7.40 },
    { group: 'Blood gas', id: 'paco2', label: 'PaCO2', unit: 'mmHg',  min: 10,  max: 120, step: 1,    value: 40 },
    { group: 'Blood gas', id: 'hco3',  label: 'HCO3-', unit: 'mEq/L', min: 2,   max: 60,  step: 0.5,  value: 24 },
    { group: 'Oxygen',    id: 'pao2',  label: 'PaO2',  unit: 'mmHg',  min: 20,  max: 600, step: 1,    value: 95 },
    { group: 'Oxygen',    id: 'fio2',  label: 'FiO2',  unit: '%',     min: 21,  max: 100, step: 1,    value: 21 },
    { group: 'Oxygen',    id: 'age',   label: 'Age',   unit: 'years', min: 15,  max: 100, step: 1,    value: 50 },
  ];

  function render(el) {
    const groups = [...new Set(SLIDERS.map(f => f.group))];
    el.innerHTML = `
      <div class="abg-grid">
        <form class="card" id="abgForm">
          <h2>ABG interpretation</h2>
          <p class="muted">Critical care</p>
          ${groups.map(g => `
            <fieldset>
              <legend>${g}</legend>
              ${SLIDERS.filter(f => f.group === g).map(UI.sliderField).join('')}
            </fieldset>`).join('')}
          <fieldset>
            <legend>Primary disorder</legend>
            <div class="form-grid">
              <div class="field">
                <label for="selected">Disorder</label>
                <select id="selected">
                  ${Object.entries(DISORDERS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label for="chronicity">Respiratory chronicity</label>
                <select id="chronicity">
                  <option value="unknown">Unknown (show both)</option>
                  <option value="acute">Acute (&lt; 24-48 h)</option>
                  <option value="chronic">Chronic (&gt; 3-5 days)</option>
                </select>
              </div>
            </div>
          </fieldset>
          <button type="reset" class="btn secondary">Reset to normal</button>
        </form>
        <div class="card result" id="abgResult"></div>
      </div>`;

    const form = el.querySelector('#abgForm');
    const update = () => show(interpret(readInputs(el)));
    UI.bindSliders(el, SLIDERS, update);
    el.querySelector('#selected').addEventListener('change', update);
    el.querySelector('#chronicity').addEventListener('change', update);
    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('reset', e => {
      e.preventDefault();
      UI.resetSliders(el, SLIDERS);
      el.querySelector('#selected').value = 'auto';
      el.querySelector('#chronicity').value = 'unknown';
      update();
    });
    update();
  }

  function readInputs(el) {
    const v = {};
    SLIDERS.forEach(f => {
      const raw = el.querySelector('#' + f.id).value;
      const n = Number(raw);
      v[f.id] = raw === '' || Number.isNaN(n) ? f.value : n;
    });
    v.selected = el.querySelector('#selected').value;
    v.chronicity = el.querySelector('#chronicity').value;
    return v;
  }

  function show(res) {
    const esc = UI.esc;
    document.getElementById('abgResult').innerHTML = `
      <h3>Interpretation</h3>
      <ol class="summary">${res.summary.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      ${res.warnings.map(w => `<p class="flag">${esc(w)}</p>`).join('')}
      ${res.sections.map(s => `
        <div class="step ${s.flag ? 'flagged' : ''}">
          <h4>${esc(s.title)}</h4>
          <pre>${s.lines.map(esc).join('\n')}</pre>
        </div>`).join('')}
      <p class="muted small">Decision support only. Interpret in clinical context.</p>`;
  }

  const api = { render, interpret, oxygenation, ventilation, detectPrimary, compensation };
  if (typeof window !== 'undefined') window.ABG = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
