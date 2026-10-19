// Dyskalemia: hypokalemia and hyperkalemia approach
(function () {
  const Workup = typeof window !== 'undefined' && window.AcidBaseWorkup
    ? window.AcidBaseWorkup : require('./acidbase-workup.js');
  const UI = typeof window !== 'undefined' && window.UI ? window.UI : require('../ui.js');
  const Tree = typeof window !== 'undefined' && window.Tree ? window.Tree : require('../tree.js');

  const r1 = x => Math.round(x * 10) / 10;
  const has = (...xs) => xs.every(x => x !== null && x !== undefined && !Number.isNaN(x));
  const POSM_DEFAULT = 290;

  // ---------- shared urine indices ----------

  function urineIndices(v) {
    const res = {};
    if (has(v.uk, v.ucr) && v.ucr > 0) res.ukcr = v.uk / (v.ucr / 100); // mEq per g creatinine
    if (has(v.uk, v.uosm, v.k)) {
      res.posm = has(v.posm) ? v.posm : POSM_DEFAULT;
      res.posmAssumed = !has(v.posm);
      res.ttkg = (v.uk / v.k) / (v.uosm / res.posm);
      res.ttkgValid = v.uosm > res.posm && (!has(v.una) || v.una > 25);
    }
    return res;
  }

  function acidBase(hco3) {
    return hco3 < 22 ? 'acid' : hco3 > 26 ? 'alk' : 'normal';
  }

  // ---------- Hypokalemia ----------

  function hypokalemia(v) {
    const sections = [];
    const path = new Set(['hypo']);
    let key = 'hypoGeneral';

    // 1. Severity
    const sev = v.k < 2.5 ? 'Severe' : v.k < 3.0 ? 'Moderate' : 'Mild';
    const ecg = v.k < 2.5 ? 'AF, multifocal atrial tachycardia, ectopics, bradycardia, torsades, VF'
      : v.k < 3.0 ? 'QT prolongation, U waves, ST depression, low P wave, PR prolongation, ectopics'
        : 'T-wave flattening or inversion';
    const urgent = v.k < 2.5 || v.ecg || v.paralysis;
    const sevLines = [`K ${v.k} mEq/L: ${sev} hypokalemia (mild 3.0-3.4, moderate 2.5-2.9, severe < 2.5)`, `Expected ECG: ${ecg}`];
    if (urgent) sevLines.push('Life-threatening: IV KCl via large vein with continuous ECG monitoring (see Management)');
    sections.push({ title: '1  Severity', lines: sevLines, flag: urgent });

    // 2. Pseudo and shift
    const ab = acidBase(v.hco3);
    const shiftLines = [];
    let shift = false;
    if (v.pseudo) shiftLines.push('Spurious sample suspected (marked leukocytosis, delayed processing): repeat plasma K promptly separated');
    if (v.paralysis && v.thyro) { shift = true; shiftLines.push('Periodic weakness with thyrotoxicosis: thyrotoxic periodic paralysis (check TSH, free T4; low PO4 and Mg)'); }
    else if (v.paralysis) { shift = true; shiftLines.push('Periodic weakness: hypokalemic periodic paralysis vs thyrotoxic (check TSH); familial if onset < 20 y and family history'); }
    if (v.shiftDrug) { shift = true; shiftLines.push('Insulin, beta-2 agonist, catecholamine, theophylline or refeeding: transcellular shift'); }
    if (!shift && ab === 'normal' && has(v.uk) && v.uk < 15)
      shiftLines.push('Normal acid-base with low urine K: consider shift (ABCDEFGHT) or poor intake');
    shiftLines.push('Shift causes: Alkalosis/anabolism, Beta-agonist, Catecholamine, Drugs (insulin, chloroquine, barium), Exercise, Familial PP, Glucose with insulin, Hypothermia, Thyrotoxic PP');
    sections.push({ title: '2  Exclude pseudohypokalemia and shift', lines: shiftLines, flag: shift || v.pseudo });
    path.add('hscreen');

    if (shift) {
      path.add('hshift');
      key = 'hypoShift';
    } else {
      path.add('hloss');
      // 3. Renal vs extra-renal
      const ui = urineIndices(v);
      const lossLines = [];
      let renal = null;
      if (ui.ukcr !== undefined) {
        renal = ui.ukcr > 13;
        lossLines.push(`Urine K/Cr = ${r1(ui.ukcr)} mEq/g: ${renal ? '> 13, renal loss' : '<= 13, extra-renal loss or shift'}`);
      }
      if (ui.ttkg !== undefined) {
        lossLines.push(`TTKG = (UK/PK) / (Uosm/Posm${ui.posmAssumed ? ' assumed 290' : ''}) = ${r1(ui.ttkg)}: ${ui.ttkg < 2 ? '< 2, extra-renal' : '>= 2, renal loss (> 4 clearly)'}` +
          (ui.ttkgValid ? '' : '  (valid only if Uosm > Posm and UNa > 25)'));
        if (renal === null) renal = ui.ttkg >= 2;
      }
      if (has(v.uk)) {
        lossLines.push(`Spot urine K = ${v.uk} mEq/L: ${v.uk > 15 ? '> 15, renal loss' : '<= 15, extra-renal loss'}`);
        if (renal === null) renal = v.uk > 15;
      }
      if (renal === null) lossLines.push('Enter urine K (with creatinine or osmolality) to separate renal from extra-renal loss');
      sections.push({ title: '3  Renal or extra-renal loss', lines: lossLines, flag: renal !== null });

      // 4. Acid-base branch
      const abLines = [`Serum HCO3 ${v.hco3}: ${ab === 'acid' ? 'metabolic acidosis (< 22)' : ab === 'alk' ? 'metabolic alkalosis (> 26)' : 'normal acid-base (22-26)'}`];
      if (ab === 'normal') {
        path.add('hnormal');
        if (renal === true) { path.add('hnorm-ren'); key = 'hypoPolyuria'; abLines.push('Renal loss with normal HCO3: polyuria / osmotic diuresis, hypomagnesemia, early diuretic'); }
        else if (renal === false) { path.add('hnorm-ext'); key = 'hypoIntake'; abLines.push('Extra-renal with normal HCO3: poor intake, profuse sweating, unrecognized shift'); }
      } else if (ab === 'acid') {
        path.add('hacid');
        if (renal === true) { path.add('hac-ren'); key = 'hypoAcidRenal'; abLines.push('Renal K loss with acidosis: RTA (type 1 or 2), ketoacidosis, toluene. Use Nephrology > Metabolic acidosis'); }
        else if (renal === false) { path.add('hac-ext'); key = 'gi'; abLines.push('Extra-renal K loss with acidosis: diarrhea, ostomy, laxative'); }
      } else {
        path.add('halk');
        abLines.push(...alkalosisBranch(v, path, k => { key = k; }, renal));
      }
      sections.push({ title: '4  Acid-base status', lines: abLines, flag: ab !== 'normal' });
    }

    if (has(v.mg) && v.mg < 1.8)
      sections.push({ title: 'Magnesium', lines: [`Mg ${v.mg} mg/dL: hypomagnesemia - correct Mg first or K repletion will fail`], flag: true });

    sections.push({ title: 'Top 5 differential diagnoses', lines: Workup.ddx(key).slice(2), flag: true });
    sections.push({ title: 'Management', lines: hypoManagement(v, urgent, shift, ab) });
    return { sections, path, summary: `${sev} hypokalemia`, key };
  }

  function alkalosisBranch(v, path, setKey, renal) {
    const lines = [];
    if (v.bp === 'high') {
      path.add('hht');
      lines.push('Hypertension: mineralocorticoid effect - check PAC and PRA (stop diuretic, correct K first)');
      setKey('clResHT');
      if (has(v.pac, v.pra)) {
        const pacHigh = v.pac >= 10, praLow = v.pra <= 1;
        const arr = v.pra > 0 ? v.pac / v.pra : Infinity;
        lines.push(`PAC ${v.pac} ng/dL, PRA ${v.pra} ng/mL/h, ARR ${Number.isFinite(arr) ? r1(arr) : '-'}`);
        if (pacHigh && !praLow) { path.add('hsec'); setKey('secAldo'); lines.push('High PAC, high PRA: secondary aldosteronism (RAS, renin tumor, malignant HT, OCP)'); }
        else if (pacHigh && praLow) { path.add('hpa'); setKey('pa'); lines.push('High PAC, low PRA (ARR > 20): primary aldosteronism (adenoma, hyperplasia, carcinoma, GRA)'); }
        else if (praLow) { path.add('hlow'); setKey('lowLow'); lines.push('Low PAC, low PRA: Liddle, AME / licorice, Cushing, CAH (11B or 17A), DOC excess'); }
        else lines.push('Pattern indeterminate: interpret with assay reference range');
      }
      return lines;
    }
    if (v.bp === 'low' && has(v.ucl)) {
      path.add('hnt');
      if (v.ucl < 15) {
        path.add('hclresp');
        lines.push(`Urine Cl ${v.ucl} < 15: chloride-responsive`);
        if (has(v.una) && v.una > 20) {
          if (has(v.uph) && v.uph > 6.5) { setKey('activeVomit'); lines.push('UNa > 20 with urine pH > 6.5: bicarbonaturia from active vomiting'); }
          else { setKey('nonAbsAnion'); lines.push('UNa > 20 with urine pH < 6.5: non-reabsorbable anion'); }
        } else {
          setKey('clRespRemote');
          lines.push('Remote vomiting or diuretic, post-hypercapnia, chloride-wasting diarrhea, villous adenoma');
        }
      } else {
        path.add('hclres');
        lines.push(`Urine Cl ${v.ucl} >= 15: chloride-resistant`);
        if (has(v.uk) && v.uk < 30) { path.add('hlax'); setKey('laxative'); lines.push('Urine K < 30: laxative abuse'); }
        else {
          path.add('hdiur'); setKey('diureticBG');
          lines.push('Urine K >= 30: loop or thiazide diuretic, Bartter, Gitelman, acquired tubulopathy, hypomagnesemia');
          if (has(v.ucacr)) lines.push(v.ucacr > 0.2 ? `Urine Ca/Cr ${v.ucacr} > 0.2 mg/mg: Bartter-like or loop diuretic`
            : v.ucacr < 0.07 ? `Urine Ca/Cr ${v.ucacr} < 0.07 mg/mg: Gitelman-like or thiazide (check Mg)`
              : `Urine Ca/Cr ${v.ucacr}: indeterminate`);
          lines.push('Screen urine for diuretics before diagnosing Bartter or Gitelman');
        }
      }
      return lines;
    }
    if (v.bp !== 'low') lines.push('Select blood pressure status to continue');
    else lines.push('Enter urine Cl to continue');
    if (renal === false) { setKey('hypoAlkExtra'); lines.push('Low urine K with alkalosis: remote diuretic or vomiting, laxative, villous adenoma'); }
    else if (renal === true) setKey('diureticBG');
    else setKey('metAlk');
    return lines;
  }

  function hypoManagement(v, urgent, shift, ab) {
    const lines = [];
    if (!shift) {
      const deficit = Math.max(0, (4.0 - v.k) / 0.3 * 100);
      lines.push(`Rough deficit: 100 mEq raises K about 0.3 -> about ${Math.round(deficit / 10) * 10} mEq to reach 4.0 (ongoing loss adds more)`);
    } else {
      lines.push('Shift: total body K is near normal - give small doses (KCl 10-20 mEq) and recheck; rebound hyperkalemia risk');
      if (v.thyro) lines.push('Thyrotoxic periodic paralysis: propranolol 1-3 mg/kg oral, treat thyrotoxicosis');
    }
    if (urgent) {
      lines.push('IV: large vein KCl 10-20 mEq/h (20-40 mEq/h only if life-threatening, with ECG monitor)');
      lines.push('Arrhythmia/arrest: up to 20 mEq over 10 min then 10 mEq over 10 min, ECG monitored');
    } else {
      lines.push('Oral preferred: KCl elixir 15 mL = 20 mEq; KCl tablet 750 mg = 10 mEq');
      lines.push('IV if oral not possible: peripheral KCl <= 60 mEq/L at <= 10 mEq/h');
    }
    lines.push(ab === 'acid' ? 'Acidosis: potassium citrate or bicarbonate; give K before correcting acidosis'
      : 'Use KCl (alkalosis, chloride depletion); K-phosphate only if hypophosphatemia');
    lines.push('Dilute in saline, not dextrose; correct Mg; recheck K every 2-6 h while on IV');
    return lines;
  }

  // ---------- Hyperkalemia ----------

  const DRUGS = [
    ['raasi', 'ACEi / ARB / ARNI', 'reduces aldosterone'],
    ['mra', 'Spironolactone / eplerenone', 'aldosterone resistance'],
    ['enac', 'Amiloride / trimethoprim', 'ENaC block'],
    ['cni', 'Calcineurin inhibitor', 'low renin and ENaC effect'],
    ['nsaid', 'NSAID', 'hyporeninemia'],
    ['bb', 'Beta-blocker', 'shift and low renin'],
    ['heparin', 'Heparin / LMWH', 'low aldosterone synthesis'],
    ['digoxin', 'Digoxin', 'Na-K-ATPase inhibition'],
    ['ksupp', 'K supplement / salt substitute', 'intake'],
  ];

  function hyperkalemia(v) {
    const sections = [];
    const path = new Set(['hyper']);
    let key = 'hyperGeneral';

    // 1. Severity
    const severe = v.k >= 6.5 || (v.k >= 6.0 && v.ecg);
    const sev = severe ? 'Severe' : v.k >= 6.0 ? 'Moderate' : 'Mild';
    const sevLines = [`K ${v.k} mEq/L: ${sev} hyperkalemia (mild 5.1-5.9, moderate 6.0-6.4, severe >= 6.5 or >= 6.0 with ECG change)`,
      'ECG: peaked T, short QT, flat P, PR prolongation, wide QRS, sine wave, bradycardia, VF'];
    if (severe) {
      path.add('hkemerg');
      sevLines.push('EMERGENCY:',
        '  Stabilize: 10% calcium gluconate 10-30 mL IV over 5-10 min; repeat if ECG persists',
        '  Shift: regular insulin 10 U IV + 50% dextrose 50 mL (if glucose < 250 mg/dL); salbutamol 10-20 mg nebulized',
        '  NaHCO3 only if metabolic acidosis',
        '  Remove: SZC 10 g tid, loop diuretic if volume allows, dialysis if refractory or anuric',
        '  Monitor ECG and K at 1, 2, 4, 6 h; glucose hourly after insulin');
    }
    sections.push({ title: '1  Severity', lines: sevLines, flag: severe });

    // 2. Pseudohyperkalemia
    path.add('hkpseudo');
    const pLines = [];
    if (v.pseudo) {
      pLines.push('Spurious sample suspected: repeat without fist clenching or prolonged tourniquet, process quickly; plasma K if WBC or platelets very high');
      key = 'hyperPseudo';
    } else {
      pLines.push('Clues to pseudohyperkalemia: risk factor + normal acid-base + no ECG change despite high K');
      if (!v.ecg && v.hco3 >= 22 && (!has(v.egfr) || v.egfr >= 60) && !v.lysis)
        pLines.push('This pattern fits: repeat with correct method before treating');
    }
    sections.push({ title: '2  Exclude pseudohyperkalemia', lines: pLines, flag: v.pseudo });

    // 3. Shift / lysis / intake
    path.add('hkshift');
    const drugs = DRUGS.filter(([id]) => v[id]);
    const loadDrugs = drugs.filter(([id]) => ['bb', 'digoxin', 'ksupp'].includes(id));
    const sLines = [];
    const load = v.lysis || loadDrugs.length > 0;
    if (v.lysis) sLines.push('Cell lysis or tissue injury: rhabdomyolysis, tumor lysis, hemolysis, burns');
    loadDrugs.forEach(([, name, how]) => sLines.push(`${name}: ${how}`));
    if (v.hco3 < 22) sLines.push(`HCO3 ${v.hco3}: acidosis (inorganic acidosis shifts K; chronic hyperkalemia also causes NAGMA)`);
    if (!sLines.length) sLines.push('No shift, lysis or intake factor marked');
    sLines.push('Other: insulin deficiency / hyperglycemia, hyperosmolality, succinylcholine, CNI, stored RBC transfusion');

    // 4. Renal handling
    const ui = urineIndices(v);
    const rLines = [];
    const gfrLow = has(v.egfr) && v.egfr < 20;
    const lowFlow = has(v.una) && v.una <= 25;
    if (has(v.egfr)) rLines.push(`eGFR ${v.egfr}: ${gfrLow ? '< 20, advanced kidney failure can explain hyperkalemia' : '> 20, kidney failure alone does not explain it'}`);
    if (has(v.una)) rLines.push(`Urine Na ${v.una}: ${lowFlow ? '<= 25, low distal Na delivery (volume depletion, HF)' : '> 25, distal Na delivery adequate'}`);
    if (ui.ttkg !== undefined) rLines.push(`TTKG = (UK/PK) / (Uosm/Posm${ui.posmAssumed ? ' assumed 290' : ''}) = ${r1(ui.ttkg)}: ` +
      (ui.ttkg > 8 ? '> 8, appropriate renal K secretion' : ui.ttkg < 6 ? '< 5-6, impaired distal K secretion' : '6-8, borderline') +
      (ui.ttkgValid ? '' : '  (valid only if Uosm > Posm and UNa > 25)'));

    if (load && (ui.ttkg === undefined || ui.ttkg > 8)) {
      path.add('hkshiftyes');
      if (key !== 'hyperPseudo') key = 'hyperShift';
      sLines.push('Extra-renal K load is likely the main cause (urine K > 40-60 mmol/day expected)');
    } else {
      path.add('hkrenal');
      if (gfrLow || lowFlow) {
        path.add('hkrf');
        if (key !== 'hyperPseudo') key = 'hyperRenalFail';
        rLines.push('Low GFR or low distal flow: AKI, advanced CKD, volume depletion');
      } else if ((ui.ttkg !== undefined && ui.ttkg < 8) || has(v.uph) || has(v.ttkgFludro)) {
        path.add('hktub');
        if (key !== 'hyperPseudo') key = 'hyperTubular';
        rLines.push('Tubular defect: give fludrocortisone 0.05-0.2 mg and repeat TTKG within 4 h, or use urine pH');
        const def = has(v.ttkgFludro) ? v.ttkgFludro > 8 : has(v.uph) ? v.uph < 5.5 : null;
        if (has(v.ttkgFludro)) rLines.push(`TTKG after fludrocortisone ${v.ttkgFludro}: ${v.ttkgFludro > 8 ? '> 8, responds' : '< 8, no response'}`);
        if (has(v.uph)) rLines.push(`Urine pH ${v.uph}: ${v.uph < 5.5 ? '< 5.5' : '> 5.5'}`);
        if (def === true) {
          path.add('hkdef');
          if (key !== 'hyperPseudo') key = 'hyperAldoDef';
          rLines.push('Aldosterone deficiency (type 4 RTA)',
            '  Low renin: diabetes, chronic obstruction, acute GN, NSAID, beta-blocker',
            '  High renin: primary adrenal insufficiency, heparin, ACEi/ARB, azoles, critical illness');
        } else if (def === false) {
          path.add('hkres');
          if (key !== 'hyperPseudo') key = 'hyperAldoRes';
          rLines.push('Aldosterone resistance (voltage-dependent distal RTA, ENaC defect)',
            '  Drugs: amiloride, spironolactone, trimethoprim, CNI',
            '  Diseases: acute obstruction, PHA type 1 and 2, kidney transplant, SLE');
        }
      } else {
        rLines.push('Enter eGFR, urine Na, urine K and osmolality (TTKG) or urine pH to continue');
      }
    }
    sections.push({ title: '3  Shift, cell lysis or high intake', lines: sLines, flag: load });
    sections.push({ title: '4  Renal K excretion', lines: rLines, flag: gfrLow || lowFlow || path.has('hktub') });

    const renalDrugs = drugs.filter(([id]) => !['bb', 'digoxin', 'ksupp'].includes(id));
    if (renalDrugs.length)
      sections.push({ title: 'Drug review', flag: true,
        lines: renalDrugs.map(([, name, how]) => `${name}: ${how}`) });

    sections.push({ title: 'Top 5 differential diagnoses', lines: Workup.ddx(key).slice(2), flag: true });
    sections.push({ title: 'Chronic management', lines: [
      'Low-K diet; stop salt substitutes, NSAIDs and K supplements; review drugs above',
      'Keep RAAS blockers when indicated: add a binder or diuretic rather than stopping',
      'Thiazide (chlorthalidone) or loop diuretic if not volume depleted; SGLT2 inhibitor; treat constipation',
      'Correct metabolic acidosis with NaHCO3; fludrocortisone if salt-wasting and not volume overloaded',
      'Exclude urinary obstruction, poorly controlled diabetes, adrenal insufficiency',
      'Binders: SZC 10 g tid 48 h then 5-10 g daily (edema) | patiromer 8.4-25.2 g daily (low Mg) |',
      '  calcium polystyrene 15 g 2-3 times/day, short term, no sorbitol (colonic necrosis risk)',
    ] });
    // A spurious sample stops the diagnostic path until K is repeated
    const shown = v.pseudo ? new Set([...path].filter(n => ['hyper', 'hkemerg', 'hkpseudo'].includes(n))) : path;
    return { sections, path: shown, summary: `${sev} hyperkalemia${v.pseudo ? ' (repeat to exclude pseudohyperkalemia)' : ''}`, key };
  }

  function interpret(v) {
    if (v.k < 3.5) return { type: 'hypo', ...hypokalemia(v) };
    if (v.k > 5.0) return { type: 'hyper', ...hyperkalemia(v) };
    return { type: 'normal', summary: 'Normokalemia (3.5-5.0 mEq/L)', path: new Set(), sections: [
      { title: 'Serum potassium', lines: [`K ${v.k} mEq/L is within 3.5-5.0. Move the K slider below 3.5 or above 5.0 to start the approach.`] }] };
  }

  // ---------- decision trees and etiology ----------

  const HYPO_TREE = {
    id: 'hypo', text: 'Hypokalemia', note: 'K < 3.5; exclude pseudohypokalemia, review drugs and TSH',
    children: [
        { id: 'hshift', edge: 'Shift', text: 'Transcellular shift', note: 'Insulin, beta-agonist, TPP, HypoPP' },
        {
          id: 'hloss', edge: 'True deficit', text: 'Renal or extra-renal loss', note: 'Renal: UK > 15, UK/Cr > 13, TTKG > 2-4',
          children: [
            {
              id: 'hnormal', edge: 'HCO3 22-26', text: 'Normal acid-base',
              children: [
                { id: 'hnorm-ren', edge: 'Renal', text: 'Polyuria', note: 'Osmotic diuresis, low Mg' },
                { id: 'hnorm-ext', edge: 'Extra-renal', text: 'Intake or sweat', note: 'Malnutrition, sweating' },
              ],
            },
            {
              id: 'halk', edge: 'HCO3 > 26', text: 'Metabolic alkalosis',
              children: [
                {
                  id: 'hht', edge: 'Hypertension', text: 'PAC and PRA',
                  children: [
                    { id: 'hsec', edge: 'PAC high, PRA high', text: 'Secondary aldosteronism', note: 'RAS, renin tumor' },
                    { id: 'hpa', edge: 'PAC high, PRA low', text: 'Primary aldosteronism', note: 'Adenoma, hyperplasia' },
                    { id: 'hlow', edge: 'Both low', text: 'Non-aldosterone', note: 'Liddle, AME, Cushing' },
                  ],
                },
                {
                  id: 'hnt', edge: 'Normal or low BP', text: 'Urine Cl',
                  children: [
                    { id: 'hclresp', edge: 'UCl < 15', text: 'Cl-responsive', note: 'Vomiting, remote diuretic' },
                    {
                      id: 'hclres', edge: 'UCl > 15', text: 'Cl-resistant',
                      children: [
                        { id: 'hlax', edge: 'UK < 30', text: 'Laxative abuse' },
                        { id: 'hdiur', edge: 'UK > 30', text: 'Diuretic, Bartter, Gitelman', note: 'Urine Ca/Cr, Mg' },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 'hacid', edge: 'HCO3 < 22', text: 'Metabolic acidosis',
              children: [
                { id: 'hac-ren', edge: 'Renal', text: 'RTA, ketoacid, toluene' },
                { id: 'hac-ext', edge: 'Extra-renal', text: 'Diarrhea, ostomy' },
              ],
            },
          ],
        },
    ],
  };

  const HYPER_TREE = {
    id: 'hyper', text: 'Hyperkalemia', note: 'K > 5.0-5.5 mEq/L',
    children: [
      { id: 'hkemerg', edge: 'K >= 6.5 or ECG change', text: 'Emergency treatment', note: 'Calcium, insulin-glucose, salbutamol, remove K' },
      {
        id: 'hkpseudo', edge: 'Then', text: 'Exclude pseudohyperkalemia', note: 'Hemolysis, high WBC or platelets, fist clenching',
        children: [{
          id: 'hkshift', text: 'Shift, cell lysis or high intake?', note: 'Rhabdomyolysis, TLS, drugs',
          children: [
            { id: 'hkshiftyes', edge: 'Yes', text: 'Extra-renal K load', note: 'Urine K > 40-60 mmol/day' },
            {
              id: 'hkrenal', edge: 'No', text: 'GFR > 20 and urine Na > 25?',
              children: [
                { id: 'hkrf', edge: 'No', text: 'Kidney failure or low distal flow', note: 'AKI, advanced CKD, volume depletion' },
                {
                  id: 'hktub', edge: 'Yes, TTKG < 5-6', text: 'Tubular defect', note: 'Fludrocortisone test or urine pH',
                  children: [
                    { id: 'hkdef', edge: 'TTKG > 8 / UpH < 5.5', text: 'Aldosterone deficiency', note: 'Type 4 RTA: DM, NSAID, ACEi/ARB, heparin, AI' },
                    { id: 'hkres', edge: 'TTKG < 8 / UpH > 5.5', text: 'Aldosterone resistance', note: 'Amiloride, MRA, trimethoprim, CNI, obstruction' },
                  ],
                },
              ],
            },
          ],
        }],
      },
    ],
  };

  const HYPO_ETIOLOGY = [
    { group: 'Low intake or transcellular shift' },
    ['Decreased intake', 'Contributes with other losses', 'Starvation, anorexia, alcoholism, clay ingestion'],
    ['Transcellular shift', 'K moves into cells', 'Alkalosis, insulin, beta-2 agonist, catecholamine, theophylline, refeeding, B12 or folate therapy, G-CSF, hypothermia, barium, chloroquine'],
    ['Periodic paralysis', 'Channelopathy', 'Thyrotoxic periodic paralysis, familial hypokalemic periodic paralysis'],
    { group: 'Extra-renal loss (urine K < 15 mEq/L)' },
    ['Gastrointestinal', 'Stool K loss', 'Diarrhea, laxative abuse, villous adenoma, ostomy, bowel diversion'],
    ['Skin', 'Sweat', 'Profuse sweating, burns'],
    { group: 'Renal loss (urine K > 15 mEq/L)' },
    ['High distal Na delivery', 'Flow-dependent secretion', 'Thiazide, loop diuretic, osmotic diuresis, Bartter, Gitelman, salt-wasting nephropathy'],
    ['Mineralocorticoid excess', 'ENaC activation', 'Primary aldosteronism, GRA, renovascular HT, renin tumor, Cushing, AME or licorice, Liddle, CAH'],
    ['Non-reabsorbable anion', 'Lumen negativity', 'Active vomiting (bicarbonaturia), DKA, toluene (hippurate), high-dose penicillin'],
    ['Tubular and other', 'Tubular injury', 'Distal and proximal RTA, hypomagnesemia, amphotericin B, aminoglycoside, cisplatin'],
    { group: 'Spurious' },
    ['Pseudohypokalemia', 'Uptake in the tube', 'Marked leukocytosis with delayed processing'],
  ];

  const HYPER_ETIOLOGY = [
    { group: 'Spurious' },
    ['Pseudohyperkalemia', 'In-vitro K release', 'Hemolysis, fist clenching, tight tourniquet, EDTA, delayed transport, leukocytosis, thrombocytosis'],
    { group: 'Increased load' },
    ['Intake', 'Exogenous K', 'K supplements, salt substitutes, high-K diet with CKD, stored RBC transfusion'],
    ['Transcellular shift', 'K moves out of cells', 'Inorganic acidosis, insulin deficiency, hyperglycemia, mannitol, beta-blocker, digoxin, succinylcholine, hyperkalemic periodic paralysis'],
    ['Cell lysis', 'Release of cell K', 'Rhabdomyolysis, tumor lysis, hemolysis, burns, ischemia-reperfusion'],
    { group: 'Low renal excretion' },
    ['Low GFR or distal flow', 'Too little filtrate or flow', 'Oliguric AKI, CKD with GFR < 20, volume depletion, heart failure'],
    ['Aldosterone deficiency, low renin', 'Type 4 RTA', 'Diabetic kidney disease, NSAID, beta-blocker, CNI, chronic obstruction, acute GN'],
    ['Aldosterone deficiency, high renin', 'Type 4 RTA', 'Primary adrenal insufficiency, heparin or LMWH, ACEi or ARB, azole antifungals, critical illness'],
    ['Aldosterone resistance', 'ENaC or MR blockade', 'Amiloride, triamterene, spironolactone, eplerenone, trimethoprim, pentamidine, obstruction, transplant, SLE, PHA type 1 and 2'],
  ];

  // ---------- UI ----------

  const SLIDERS = [
    { id: 'k',    label: 'Serum K',    unit: 'mEq/L', min: 1.5, max: 9, step: 0.1, value: 2.8 },
    { id: 'hco3', label: 'Serum HCO3', unit: 'mEq/L', min: 5,   max: 50, step: 0.5, value: 30 },
  ];
  const BOXES = [
    { group: 'Serum and urine', id: 'egfr', label: 'eGFR', unit: 'mL/min/1.73m2', step: '1' },
    { group: 'Serum and urine', id: 'mg',   label: 'Serum Mg', unit: 'mg/dL', step: '0.1' },
    { group: 'Serum and urine', id: 'posm', label: 'Serum osm', unit: 'mOsm/kg', step: '1', placeholder: '290' },
    { group: 'Serum and urine', id: 'una',  label: 'Urine Na', unit: 'mEq/L', step: '1' },
    { group: 'Serum and urine', id: 'uk',   label: 'Urine K',  unit: 'mEq/L', step: '1' },
    { group: 'Serum and urine', id: 'ucl',  label: 'Urine Cl', unit: 'mEq/L', step: '1' },
    { group: 'Serum and urine', id: 'uosm', label: 'Urine osm', unit: 'mOsm/kg', step: '1' },
    { group: 'Serum and urine', id: 'ucr',  label: 'Urine Cr', unit: 'mg/dL', step: '1' },
    { group: 'Serum and urine', id: 'uph',  label: 'Urine pH', unit: '', step: '0.1' },
    { group: 'hypo', id: 'bp', label: 'Blood pressure', type: 'select',
      options: [['', 'Not specified'], ['high', 'Hypertension'], ['low', 'Normal or low']] },
    { group: 'hypo', id: 'pac',   label: 'PAC', unit: 'ng/dL', step: '0.1' },
    { group: 'hypo', id: 'pra',   label: 'PRA', unit: 'ng/mL/h', step: '0.01' },
    { group: 'hypo', id: 'ucacr', label: 'Urine Ca/Cr', unit: 'mg/mg', step: '0.01' },
    { group: 'hyper', id: 'ttkgFludro', label: 'TTKG 4 h after fludrocortisone', unit: '', step: '0.1' },
  ];
  const EXAMPLE = { egfr: 90, una: 40, uk: 42, ucl: 35, ucr: 210, bp: 'low' };
  const CHECKS = {
    common: [['ecg', 'ECG change or arrhythmia'], ['pseudo', 'Spurious sample suspected']],
    hypo: [['paralysis', 'Periodic weakness / paralysis'], ['thyro', 'Thyrotoxicosis'], ['shiftDrug', 'Insulin, beta-agonist or refeeding']],
    hyper: [['lysis', 'Cell lysis / tissue injury'], ...DRUGS.map(([id, name]) => [id, name])],
  };
  const checkHtml = list => `<div class="check-row">${list.map(([id, l]) =>
    `<label for="${id}"><input type="checkbox" id="${id}"> ${l}</label>`).join('')}</div>`;

  function render(el) {
    el.innerHTML = `
      <div class="page-grid">
        <div class="abg-grid">
          <form class="card" id="dkForm">
            <h2>Dyskalemia</h2>
            <p class="muted">Nephrology</p>
            <p>Hypokalemia K &lt; 3.5 and hyperkalemia K &gt; 5.0 mEq/L. Move the K slider to switch approach.</p>
            <fieldset><legend>Serum</legend>${SLIDERS.map(UI.sliderField).join('')}</fieldset>
            <fieldset><legend>Clinical</legend>${checkHtml(CHECKS.common)}</fieldset>
            <fieldset id="hypoChecks"><legend>Hypokalemia clues</legend>${checkHtml(CHECKS.hypo)}</fieldset>
            <fieldset id="hyperChecks"><legend>Hyperkalemia clues and drugs</legend>${checkHtml(CHECKS.hyper)}</fieldset>
            <fieldset><legend>Serum and urine</legend>
              <div class="form-grid">${BOXES.filter(f => f.group === 'Serum and urine').map(UI.fieldHtml).join('')}</div></fieldset>
            <fieldset id="hypoBoxes"><legend>Metabolic alkalosis workup</legend>
              <div class="form-grid">${BOXES.filter(f => f.group === 'hypo').map(UI.fieldHtml).join('')}</div></fieldset>
            <fieldset id="hyperBoxes"><legend>Tubular test</legend>
              <div class="form-grid">${BOXES.filter(f => f.group === 'hyper').map(UI.fieldHtml).join('')}</div></fieldset>
            <p class="muted small" id="exampleNote">Example case loaded (diuretic-type hypokalemia). Replace with your patient's values.</p>
            <button type="reset" class="btn secondary">Clear</button>
          </form>
          <div class="card result" id="dkResult"></div>
        </div>
        <div class="card" id="dkTreeHypo">
          <h3 class="section-title">Approach to hypokalemia</h3>
          ${Tree.render(HYPO_TREE)}
          <p class="tree-legend">Highlighted boxes show the path for the values entered.</p>
        </div>
        <div class="card" id="dkTreeHyper">
          <h3 class="section-title">Approach to hyperkalemia</h3>
          ${Tree.render(HYPER_TREE)}
          <p class="tree-legend">Highlighted boxes show the path for the values entered.</p>
        </div>
        <div class="card" id="dkEtioHypo">
          <h3 class="section-title">Etiology of hypokalemia</h3>
          ${Tree.table(['Category', 'Mechanism', 'Causes'], HYPO_ETIOLOGY)}
        </div>
        <div class="card" id="dkEtioHyper">
          <h3 class="section-title">Etiology of hyperkalemia</h3>
          ${Tree.table(['Category', 'Mechanism', 'Causes'], HYPER_ETIOLOGY)}
        </div>
      </div>`;

    const form = el.querySelector('#dkForm');
    Object.entries(EXAMPLE).forEach(([id, val]) => { el.querySelector('#' + id).value = val; });
    const update = () => {
      const res = interpret(readInputs(el));
      show(el, res);
    };
    UI.bindSliders(el, SLIDERS, update);
    form.addEventListener('input', e => { if (!e.target.id.endsWith('-range')) update(); });
    form.addEventListener('change', update);
    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('reset', e => {
      e.preventDefault();
      form.querySelectorAll('input[type=number]:not([id$="-range"]), select').forEach(i => { i.value = ''; });
      form.querySelectorAll('input[type=checkbox]').forEach(i => { i.checked = false; });
      UI.resetSliders(el, SLIDERS.map(f => ({ ...f, value: f.id === 'k' ? 4.2 : 24 })));
      el.querySelector('#exampleNote').hidden = true;
      update();
    });
    update();
  }

  function readInputs(el) {
    const v = {};
    SLIDERS.forEach(f => {
      const n = Number(el.querySelector('#' + f.id).value);
      v[f.id] = Number.isNaN(n) || el.querySelector('#' + f.id).value === '' ? f.value : n;
    });
    BOXES.forEach(f => {
      const raw = el.querySelector('#' + f.id).value;
      v[f.id] = f.type === 'select' ? raw : raw === '' ? null : Number(raw);
    });
    [...CHECKS.common, ...CHECKS.hypo, ...CHECKS.hyper].forEach(([id]) => { v[id] = el.querySelector('#' + id).checked; });
    return v;
  }

  function show(el, res) {
    const esc = UI.esc;
    const hypo = res.type === 'hypo', hyper = res.type === 'hyper';
    ['hypoChecks', 'hypoBoxes', 'dkTreeHypo', 'dkEtioHypo'].forEach(id => { el.querySelector('#' + id).hidden = hyper; });
    ['hyperChecks', 'hyperBoxes', 'dkTreeHyper', 'dkEtioHyper'].forEach(id => { el.querySelector('#' + id).hidden = hypo; });
    el.querySelector('#dkResult').innerHTML = `
      <h3>Interpretation</h3>
      <p class="summary-line">${esc(res.summary)}</p>
      ${res.sections.map(s => `
        <div class="step ${s.flag ? 'flagged' : ''}">
          <h4>${esc(s.title)}</h4>
          <pre>${s.lines.map(esc).join('\n')}</pre>
        </div>`).join('')}
      <p class="muted small">Decision support only. Interpret in clinical context.</p>`;
    Tree.highlight(el, res.path);
  }

  const api = { render, interpret, hypokalemia, hyperkalemia };
  if (typeof window !== 'undefined') window.Dyskalemia = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
