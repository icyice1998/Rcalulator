// Metabolic acidosis: anion gap classification and second-tier workup
(function () {
  const UI = typeof window !== 'undefined' && window.UI ? window.UI : require('../ui.js');
  const Tree = typeof window !== 'undefined' && window.Tree ? window.Tree : require('../tree.js');
  const Workup = typeof window !== 'undefined' && window.AcidBaseWorkup
    ? window.AcidBaseWorkup : require('./acidbase-workup.js');

  const r1 = x => Math.round(x * 10) / 10;
  const r2 = x => Math.round(x * 100) / 100;
  const has = (...xs) => xs.every(x => x !== null && x !== undefined && !Number.isNaN(x));

  function anionGap(v) {
    const ag = v.na - (v.cl + v.hco3);
    const corr = has(v.alb) ? ag + 2.5 * (4 - v.alb) : null;
    const used = corr ?? ag;
    const normalAg = has(v.normalAg) ? v.normalAg : 12;
    const res = { ag, corr, used, normalAg, high: used > normalAg + 2 };
    if (has(v.alb, v.phos)) res.expectedAg = 2 * v.alb + 0.5 * v.phos;
    if (!res.high) return res;

    const dAG = used - normalAg, dH = 24 - v.hco3;
    const d = { diff: dAG - dH };
    if (dH > 0) {
      d.ratio = dAG / dH;
      d.ratioNote = d.ratio < 0.4 ? 'normal-AG acidosis predominates'
        : d.ratio < 0.8 ? 'high-AG + normal-AG metabolic acidosis'
          : d.ratio <= 1.2 ? 'pure high-AG metabolic acidosis'
            : d.ratio <= 2 ? 'borderline (pure range 0.8-1.6/2 in some texts) - check delta difference'
              : 'high-AG acidosis + metabolic alkalosis';
    }
    const band = x => x < -5 ? 'nagma' : x > 5 ? 'alk' : 'pure';
    if (has(v.lactate) && v.lactate > 2) {
      d.lactDiff = 0.6 * dAG - dH;
      d.final = band(d.lactDiff);
      d.finalBasis = 'lactate-adjusted delta difference';
    } else {
      d.final = band(d.diff);
      d.finalBasis = 'delta difference';
    }
    res.delta = d;
    return res;
  }

  const FINAL_TEXT = {
    pure: 'Pure high-AG metabolic acidosis',
    nagma: 'High-AG + normal-AG metabolic acidosis',
    alk: 'High-AG metabolic acidosis + metabolic alkalosis',
  };

  const FIELDS = [
    { group: 'Serum', id: 'hco3', label: 'HCO3-', unit: 'mEq/L', step: '0.1' },
    { group: 'Serum', id: 'na',   label: 'Na+',   unit: 'mEq/L', step: '0.1' },
    { group: 'Serum', id: 'k',    label: 'K+',    unit: 'mEq/L', step: '0.1' },
    { group: 'Serum', id: 'cl',   label: 'Cl-',   unit: 'mEq/L', step: '0.1' },
    { group: 'Serum', id: 'alb',  label: 'Albumin', unit: 'g/dL', step: '0.1' },
    { group: 'Serum', id: 'phos', label: 'Phosphate', unit: 'mg/dL', step: '0.1' },
    { group: 'Serum', id: 'normalAg', label: 'Lab normal AG', unit: 'mEq/L', step: '1', placeholder: '12' },
    { group: 'Blood gas (optional)', id: 'ph',    label: 'pH',    unit: '',     step: '0.01' },
    { group: 'Blood gas (optional)', id: 'paco2', label: 'PaCO2', unit: 'mmHg', step: '0.1' },

    { group: 'High-AG workup', key: 'hagma', id: 'lactate', label: 'Lactate', unit: 'mmol/L', step: '0.1' },
    { group: 'High-AG workup', key: 'hagma', id: 'ketone',  label: 'Ketone (beta-OHB)', unit: 'mmol/L', step: '0.1' },
    { group: 'High-AG workup', key: 'hagma', id: 'egfr',    label: 'eGFR', unit: 'mL/min/1.73m2', step: '1' },
    { group: 'High-AG workup', key: 'hagma', id: 'sosm',    label: 'Measured serum osm', unit: 'mOsm/kg', step: '1' },
    { group: 'High-AG workup', key: 'hagma', id: 'bun',     label: 'BUN', unit: 'mg/dL', step: '1' },
    { group: 'High-AG workup', key: 'hagma', id: 'glu',     label: 'Glucose', unit: 'mg/dL', step: '1' },

    { group: 'Normal-AG workup (urine)', key: 'urine', id: 'una',   label: 'Urine Na',   unit: 'mEq/L', step: '1' },
    { group: 'Normal-AG workup (urine)', key: 'urine', id: 'uk',    label: 'Urine K',    unit: 'mEq/L', step: '1' },
    { group: 'Normal-AG workup (urine)', key: 'urine', id: 'ucl',   label: 'Urine Cl',   unit: 'mEq/L', step: '1' },
    { group: 'Normal-AG workup (urine)', key: 'urine', id: 'uph',   label: 'Urine pH',   unit: '',      step: '0.1' },
    { group: 'Normal-AG workup (urine)', key: 'urine', id: 'uosm',  label: 'Urine osm',  unit: 'mOsm/kg', step: '1' },
    { group: 'Normal-AG workup (urine)', key: 'urine', id: 'uurea', label: 'Urine urea', unit: 'mg/dL', step: '1' },
    { group: 'Normal-AG workup (urine)', key: 'urine', id: 'uglu',  label: 'Urine glucose', unit: 'mg/dL', step: '1' },
    { group: 'Normal-AG workup (urine)', key: 'urine', id: 'uhco3', label: 'Urine HCO3', unit: 'mEq/L', step: '0.1' },
    { group: 'Normal-AG workup (urine)', key: 'urine', id: 'ucr',   label: 'Urine Cr',   unit: 'mg/dL', step: '0.1' },
    { group: 'Normal-AG workup (urine)', key: 'urine', id: 'scr',   label: 'Serum Cr',   unit: 'mg/dL', step: '0.01' },
  ];

  function interpret(v) {
    const out = { steps: [], errors: [], warnings: [], workups: [], path: new Set() };
    if (!has(v.na, v.cl, v.hco3)) {
      out.errors.push('Na, Cl and HCO3 are required.');
      return out;
    }
    if (v.hco3 >= 22) out.warnings.push(`HCO3 ${v.hco3} is not low: metabolic acidosis not evident (AG still reported for hidden HAGMA).`);
    if (has(v.ph) && v.ph >= 7.35) out.warnings.push(`pH ${v.ph} is not acidemic: consider mixed disorder; urine NH4+ indices are valid only while pH < 7.35.`);

    if (v.hco3 < 22) out.path.add('ma');
    out.path.add('ag');

    // 1. Compensation
    if (has(v.paco2)) {
      out.path.add('winter');
      const exp = 1.5 * v.hco3 + 8;
      const note = v.paco2 > exp + 2 ? 'Concomitant respiratory acidosis (CNS depression / toxin, lung disease)'
        : v.paco2 < exp - 2 ? 'Concomitant respiratory alkalosis (salicylate, sepsis)' : 'Appropriate compensation';
      out.steps.push({ title: '1  Respiratory compensation', flag: note !== 'Appropriate compensation', lines: [
        'Expected PaCO2 = 1.5 x HCO3 + 8 (+/-2)  [Winter]',
        `  Expected ${r1(exp - 2)} - ${r1(exp + 2)}; measured ${v.paco2}: ${note}`,
      ] });
    } else {
      out.steps.push({ title: '1  Respiratory compensation', muted: true, lines: ['Enter PaCO2 to check Winter formula'] });
    }

    // 2. Anion gap and delta
    const ag = anionGap(v);
    const lines = [`AG = Na - (Cl + HCO3) = ${r1(ag.ag)} mEq/L`];
    if (ag.corr !== null) lines.push(`Albumin-corrected AG = AG + 2.5 x (4 - albumin) = ${r1(ag.corr)} mEq/L`);
    if (ag.expectedAg !== undefined) lines.push(`Expected normal AG = 2 x albumin + 0.5 x phosphate = ${r1(ag.expectedAg)} mEq/L`);
    lines.push(ag.high ? `Elevated (normal ${ag.normalAg} +/- 2): HIGH anion gap metabolic acidosis`
      : `Not elevated (normal ${ag.normalAg} +/- 2): NORMAL anion gap (hyperchloremic) metabolic acidosis`);
    const d = ag.delta;
    if (d) {
      if (d.ratio !== undefined) lines.push(`Delta ratio = (AG - ${ag.normalAg}) / (24 - HCO3) = ${r2(d.ratio)}: ${d.ratioNote}`);
      lines.push(`Delta difference = (AG - ${ag.normalAg}) - (24 - HCO3) = ${r1(d.diff)} (-5 to +5 pure)`);
      if (d.lactDiff !== undefined) lines.push(`Lactic acidosis: 0.6 x dAG - dHCO3 = ${r1(d.lactDiff)}`);
      lines.push(`Conclusion (${d.finalBasis}): ${FINAL_TEXT[d.final]}`);
    }
    out.steps.push({ title: '2  Anion gap and delta gap', lines, flag: true });

    // 3. Workup
    if (ag.high) {
      out.workups.push('hagma');
      const h = Workup.hagma(v);
      out.steps.push({ title: '3  High-AG metabolic acidosis', ...h });
      out.path.add('hagma');
      (HAGMA_PATH[h.key] || []).forEach(n => out.path.add(n));
      if (d && d.final === 'nagma') {
        out.workups.push('urine');
        const n = Workup.nagma(v);
        out.steps.push({ title: '3  Coexisting normal-AG metabolic acidosis', ...n });
        out.path.add('nagma');
        (NAGMA_PATH[n.key] || []).forEach(x => out.path.add(x));
      }
      if (d && d.final === 'alk') out.steps.push({ title: '3  Coexisting metabolic alkalosis', lines: [
        'Check urine Cl and blood pressure (metabolic alkalosis workup)'] });
    } else if (v.hco3 < 22) {
      out.workups.push('urine');
      const n = Workup.nagma(v);
      out.steps.push({ title: '3  Normal-AG metabolic acidosis', ...n });
      out.path.add('nagma');
      (NAGMA_PATH[n.key] || []).forEach(x => out.path.add(x));
    }
    return out;
  }

  // ---------- Approach (decision tree) and etiology ----------

  const HAGMA_PATH = {
    lactic: ['lactic'], keto: ['keto'], renal: ['renal'],
    toxicAlcohol: ['nonlk', 'toxic'], nonLK: ['nonlk', 'othertox'],
  };
  const NAGMA_PATH = {
    nagma: [], gi: ['unc', 'adequate', 'gi'], prta: ['unc', 'adequate', 'prta'], falsePosUnc: ['unc', 'adequate', 'fpunc'],
    drta: ['unc', 'impaired', 'drta'], hyperK: ['unc', 'impaired', 'hyperk'],
    voltage: ['unc', 'impaired', 'hyperk', 'voltage'], type4: ['unc', 'impaired', 'hyperk', 'type4'],
  };

  const TREE = {
    id: 'ma', text: 'Metabolic acidosis', note: 'HCO3 < 22 mEq/L',
    children: [{
      id: 'winter', text: 'Check compensation', note: 'PaCO2 = 1.5 x HCO3 + 8 +/- 2',
      children: [{
        id: 'ag', text: 'Anion gap', note: 'Na - (Cl + HCO3), correct for albumin',
        children: [
          {
            id: 'hagma', edge: 'AG > 14', text: 'High anion gap', note: 'Delta gap for coexisting disorder',
            children: [
              { id: 'lactic', edge: 'Lactate > 2', text: 'Lactic acidosis', note: 'Type A shock, type B drugs' },
              { id: 'keto', edge: 'Ketone >= 3', text: 'Ketoacidosis', note: 'DKA, alcoholic, starvation' },
              { id: 'renal', edge: 'GFR < 20', text: 'Kidney failure', note: 'AKI, advanced CKD' },
              {
                id: 'nonlk', edge: 'None of these', text: 'Serum osmolal gap',
                children: [
                  { id: 'toxic', edge: '> 25', text: 'Toxic alcohol', note: 'Methanol, ethylene glycol' },
                  { id: 'othertox', edge: '<= 25', text: 'Other causes', note: 'Salicylate, toluene, pyroglutamate, D-lactate, cell lysis' },
                ],
              },
            ],
          },
          {
            id: 'nagma', edge: 'AG normal', text: 'Normal anion gap', note: 'Hyperchloremic',
            children: [{
              id: 'unc', text: 'Urine NH4+ excretion', note: 'UNC, UOG (while pH < 7.35)',
              children: [
                {
                  id: 'adequate', edge: 'UNC neg / UOG >= 100', text: 'Adequate NH4+',
                  children: [
                    { id: 'gi', edge: 'Urine K low', text: 'GI HCO3 loss', note: 'Diarrhea, ostomy, fistula' },
                    { id: 'prta', edge: 'FE HCO3 > 15%', text: 'Proximal RTA', note: 'Acetazolamide, tenofovir, myeloma' },
                    { id: 'fpunc', edge: 'UNC pos, UOG >= 100', text: 'Unmeasured urine anion', note: 'Ketoacids, hippurate' },
                  ],
                },
                {
                  id: 'impaired', edge: 'UNC pos / UOG < 100', text: 'Low NH4+: distal RTA',
                  children: [
                    { id: 'drta', edge: 'K low or normal', text: 'Classical dRTA', note: 'Sjogren, lithium, toluene' },
                    {
                      id: 'hyperk', edge: 'K high', text: 'Hyperkalemic RTA',
                      children: [
                        { id: 'voltage', edge: 'Urine pH > 5.5', text: 'Voltage-dependent', note: 'Trimethoprim, amiloride, obstruction' },
                        { id: 'type4', edge: 'Urine pH < 5.5', text: 'Type 4 RTA', note: 'Diabetes, RAAS blockers' },
                      ],
                    },
                  ],
                },
              ],
            }],
          },
        ],
      }],
    }],
  };

  const ETIOLOGY = [
    { group: 'High anion gap: gain of organic or retained acid' },
    ['L-lactic acidosis, type A', 'Tissue hypoxia', 'Septic, hypovolemic or cardiogenic shock; severe hypoxemia; mesenteric ischemia; CO or cyanide poisoning'],
    ['L-lactic acidosis, type B', 'No hypoperfusion', 'Metformin, NRTI, propofol, linezolid; thiamine deficiency; liver failure; malignancy; seizure'],
    ['D-lactic acidosis', 'Colonic bacterial fermentation', 'Short bowel syndrome, jejunoileal bypass'],
    ['Ketoacidosis', 'Ketone overproduction', 'DKA (including euglycemic DKA with SGLT2 inhibitor), alcoholic ketoacidosis, starvation'],
    ['Kidney failure', 'Retained sulfate, phosphate, urate', 'Oliguric AKI, CKD with GFR < 20'],
    ['Toxic alcohol (high osmolal gap)', 'Toxic acid metabolites', 'Methanol, ethylene glycol, propylene glycol, diethylene glycol'],
    ['Other toxins (normal osmolal gap)', 'Exogenous or drug-related acid', 'Salicylate, toluene (early), pyroglutamic acid (paracetamol), iron, isoniazid'],
    ['Cell lysis', 'Release of intracellular acid', 'Rhabdomyolysis, tumor lysis syndrome, hemolysis'],
    { group: 'Normal anion gap: HCO3 loss or impaired renal acid excretion' },
    ['GI HCO3 loss', 'Loss of alkaline fluid', 'Diarrhea, laxative, ileostomy, pancreatic or biliary fistula, ureteral diversion'],
    ['Proximal RTA (type 2)', 'Low proximal HCO3 reabsorption', 'Acetazolamide, topiramate, tenofovir, ifosfamide, multiple myeloma, heavy metals, Fanconi syndrome'],
    ['Classical or backleak dRTA (type 1)', 'Low distal H+ secretion', 'Sjogren, SLE, RA, lithium, amphotericin B, toluene, SE Asian ovalocytosis, hereditary'],
    ['Voltage-dependent dRTA', 'Low ENaC lumen negativity, hyperkalemia', 'Amiloride, triamterene, trimethoprim, pentamidine, obstructive uropathy'],
    ['Type 4 RTA', 'Hypo- or pseudohypoaldosteronism', 'Diabetic hyporeninemic hypoaldosteronism, ACEi/ARB/MRA, NSAID, CNI, heparin, adrenal insufficiency'],
    ['Early CKD', 'Low ammoniagenesis', 'CKD with GFR 20-50'],
    ['Acid load or dilution', 'Chloride-rich acid gain', 'Large-volume 0.9% saline, TPN (arginine or lysine HCl), NH4Cl, cholestyramine, toluene (late)'],
  ];

  // ---------- UI ----------

  function groupHtml(g) {
    const fs = FIELDS.filter(f => f.group === g);
    const grid = `<div class="form-grid">${fs.map(UI.fieldHtml).join('')}</div>`;
    return fs[0].key
      ? `<details class="sub" data-key="${fs[0].key}"><summary>${g}</summary>${grid}</details>`
      : `<fieldset><legend>${g}</legend>${grid}</fieldset>`;
  }

  function render(el) {
    const groups = [...new Set(FIELDS.map(f => f.group))];
    el.innerHTML = `
      <div class="card">
        <h2>Metabolic acidosis</h2>
        <p class="muted">Nephrology</p>
        <p>Primary fall in serum HCO3 (< 22 mEq/L) with pH < 7.35, or a hidden component found by the anion gap.</p>
        <form id="maForm">
          ${groups.map(groupHtml).join('')}
          <button type="submit" class="btn">Interpret</button>
          <button type="reset" class="btn secondary">Clear</button>
        </form>
      </div>
      <div class="card" id="maResult" hidden></div>
      <div class="card">
        <h3 class="section-title">Approach</h3>
        ${Tree.render(TREE)}
        <p class="tree-legend">Highlighted boxes show the path for the values entered.</p>
      </div>
      <div class="card">
        <h3 class="section-title">Etiology</h3>
        ${Tree.table(['Category', 'Mechanism', 'Causes'], ETIOLOGY)}
      </div>
      <details class="card">
        <summary>Formulas</summary>
        <pre class="ref">${UI.esc(FORMULAS)}</pre>
      </details>`;

    const form = el.querySelector('#maForm');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = {};
      FIELDS.forEach(f => {
        const raw = el.querySelector('#' + f.id).value;
        v[f.id] = raw === '' ? null : Number(raw);
      });
      const res = interpret(v);
      res.workups.forEach(k => {
        const dEl = el.querySelector(`details[data-key="${k}"]`);
        if (dEl) dEl.open = true;
      });
      show(res);
      Tree.highlight(el, res.path);
    });
    form.addEventListener('reset', () => {
      document.getElementById('maResult').hidden = true;
      Tree.highlight(el, new Set());
    });
  }

  function show(res) {
    const esc = UI.esc;
    const out = document.getElementById('maResult');
    out.hidden = false;
    out.innerHTML = `
      <h3>Result</h3>
      ${[...res.errors, ...res.warnings].map(w => `<p class="flag">${esc(w)}</p>`).join('')}
      ${res.steps.map(s => `
        <div class="step ${s.flag ? 'flagged' : ''} ${s.muted ? 'muted' : ''}">
          <h4>${esc(s.title)}</h4>
          <pre>${s.lines.map(esc).join('\n')}</pre>
        </div>`).join('')}
      <p class="muted small">Decision support only. Interpret in clinical context.</p>`;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const FORMULAS = `Approach
  Metabolic acidosis -> compensation (Winter) -> anion gap -> delta gap -> workup

Anion gap
  AG = Na - (Cl + HCO3)          normal 12 +/- 2 (lab-dependent)
  Corrected AG = AG + 2.5 x (4 - albumin)
  Expected AG = 2 x albumin + 0.5 x phosphate (mg/dL)
  Delta ratio = (AG - 12) / (24 - HCO3) ; delta difference = (AG - 12) - (24 - HCO3)
  Lactic acidosis: 0.6 x (AG - 12) - (24 - HCO3)

High anion gap
  L-lactate -> ketone -> renal failure (GFR < 20) -> D-lactate / cell lysis -> toxin
  Serum OG = measured Sosm - (2Na + BUN/2.8 + Glucose/18) ; > 10 elevated, > 25 toxic alcohol

Normal anion gap (spot urine while pH < 7.35)
  UNC = (UNa + UK) - UCl         negative: GI loss / pRTA ; positive: impaired NH4+
  UOG = Uosm - [2(UNa + UK) + Uurea/2.8 + Uglucose/18]   < 100 impaired NH4+
  Impaired NH4+: K low/normal -> classical/backleak dRTA
                 K high + UpH > 5.5 -> voltage-dependent dRTA ; UpH < 5.5 -> type 4 RTA
  FE HCO3 = (UHCO3 x SCr) / (SHCO3 x UCr) x 100   > 15% pRTA`;

  const api = { render, interpret };
  if (typeof window !== 'undefined') window.MetabolicAcidosis = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
