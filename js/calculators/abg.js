// ABG interpretation — oxygenation, ventilation, acid-base (physiological + base excess)
(function () {
  const Workup = typeof window !== 'undefined' && window.AcidBaseWorkup
    ? window.AcidBaseWorkup : require('./acidbase-workup.js');

  const NORMAL = { ph: 7.40, paco2: 40, hco3: 24, alb: 4.0 };
  const RANGE = {
    phLow: 7.35, phHigh: 7.45,
    paco2Low: 35, paco2High: 45,
    hco3Low: 22, hco3High: 26,
  };
  const TOL = 2;     // +/- around predicted compensation
  const BE_TOL = 2;  // +/- around predicted SBE / PaCO2 in the base excess approach

  // Respiratory compensation: HCO3 change per 1 mmHg PaCO2 change (range = textbook spread)
  const RESP = {
    acidAcute:   { k: [0.1, 0.1],   text: 'Acute: HCO3 +1 per 10 mmHg PaCO2 rise',       dph: 0.008 },
    acidChronic: { k: [0.35, 0.4],  text: 'Chronic: HCO3 +3.5 to 4 per 10 mmHg PaCO2 rise', dph: 0.003 },
    alkAcute:    { k: [0.2, 0.2],   text: 'Acute: HCO3 -2 per 10 mmHg PaCO2 fall',       dph: 0.008 },
    alkChronic:  { k: [0.4, 0.5],   text: 'Chronic: HCO3 -4 to 5 per 10 mmHg PaCO2 fall',  dph: 0.002 },
  };

  const DISORDERS = {
    auto: 'Auto-detect from values',
    metAcidosis: 'Metabolic acidosis',
    metAlkalosis: 'Metabolic alkalosis',
    respAcidosis: 'Respiratory acidosis',
    respAlkalosis: 'Respiratory alkalosis',
  };

  const r1 = x => Math.round(x * 10) / 10;
  const r2 = x => Math.round(x * 100) / 100;
  const has = (...xs) => xs.every(x => x !== null && x !== undefined && !Number.isNaN(x));

  // ---------- calculations ----------

  function fraction(fio2) {
    return fio2 > 1 ? fio2 / 100 : fio2;
  }

  function oxygenation(v) {
    if (!has(v.pao2)) return null;
    const assumed = !has(v.fio2);
    const fio2 = assumed ? 0.21 : fraction(v.fio2);
    const roomAir = Math.abs(fio2 - 0.21) < 0.005;
    const rq = has(v.rq) ? v.rq : 0.8;
    const patm = has(v.patm) ? v.patm : 760;
    const res = { fio2, assumed, roomAir, rq, patm, pf: v.pao2 / fio2 };

    if (roomAir) {
      res.grade = v.pao2 < 40 ? 'Severe hypoxemia (< 40)'
        : v.pao2 < 60 ? 'Moderate hypoxemia (< 60)'
          : v.pao2 < 80 ? 'Mild hypoxemia (< 80)' : 'No hypoxemia (>= 80)';
      res.hypoxemic = v.pao2 < 80;
    } else {
      res.hypoxemic = res.pf < 300;
    }

    if (has(v.paco2)) {
      res.pAO2 = fio2 * (patm - 47) - v.paco2 / rq;
      res.aa = res.pAO2 - v.pao2;
      if (has(v.age)) {
        res.aaNormal = 2.5 + v.age / 4;
        res.aaWide = res.aa > res.aaNormal;
      }
    }
    return res;
  }

  function ventilation(v) {
    const res = {
      status: v.paco2 < RANGE.paco2Low ? 'Hyperventilation (hypocapnia)'
        : v.paco2 > RANGE.paco2High ? 'Hypoventilation (hypercapnia)' : 'Normal ventilation',
    };
    if (has(v.petco2)) {
      res.vdvt = (v.paco2 - v.petco2) / v.paco2;
      res.vdHigh = res.vdvt > 0.3;
    }
    return res;
  }

  function consistency(v) {
    const hMeasured = Math.pow(10, 9 - v.ph);
    const hCalc = 24 * v.paco2 / v.hco3;
    const diff = Math.abs(hCalc - hMeasured) / hMeasured;
    const phCalc = 6.1 + Math.log10(v.hco3 / (0.03 * v.paco2));
    return { hMeasured, hCalc, phCalc, ok: diff <= 0.1, diff };
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

  function verdict(actual, lo, hi, ifHigh, ifLow) {
    if (actual > hi) return { lo, hi, status: 'high', note: ifHigh };
    if (actual < lo) return { lo, hi, status: 'low', note: ifLow };
    return { lo, hi, status: 'ok', note: 'Appropriate compensation' };
  }

  function compensation(type, v, chronicity) {
    if (type === 'metAcidosis') {
      const exp = 1.5 * v.hco3 + 8;
      return [{ formula: 'Expected PaCO2 = 1.5 x HCO3 + 8 (+/-2)  [Winter]', param: 'PaCO2', actual: v.paco2,
        ...verdict(v.paco2, exp - TOL, exp + TOL,
          'Concomitant respiratory acidosis (CNS depression / toxin, lung disease)',
          'Concomitant respiratory alkalosis (salicylate, sepsis)') }];
    }
    if (type === 'metAlkalosis') {
      const a = 0.7 * v.hco3 + 20, b = 40 + 0.7 * (v.hco3 - NORMAL.hco3);
      return [{ formula: 'Expected PaCO2 = 0.7 x HCO3 + 20 (+/-2)  or  40 + 0.7 x (HCO3 - 24)', param: 'PaCO2', actual: v.paco2,
        ...verdict(v.paco2, Math.min(a, b) - TOL, Math.max(a, b) + TOL,
          'Concomitant respiratory acidosis', 'Concomitant respiratory alkalosis') }];
    }
    if (type === 'respAcidosis' || type === 'respAlkalosis') {
      const acid = type === 'respAcidosis';
      const dC = v.paco2 - NORMAL.paco2;
      const keys = chronicity === 'acute' ? ['Acute']
        : chronicity === 'chronic' ? ['Chronic'] : ['Acute', 'Chronic'];
      return keys.map(k => {
        const c = RESP[(acid ? 'acid' : 'alk') + k];
        const e = c.k.map(x => NORMAL.hco3 + x * dC);
        return { formula: c.text, param: 'HCO3', actual: v.hco3, phase: k,
          ...verdict(v.hco3, Math.min(...e) - TOL, Math.max(...e) + TOL,
            'Concomitant metabolic alkalosis', 'Concomitant metabolic acidosis') };
      });
    }
    return [];
  }

  // pH-based estimate of acute vs chronic respiratory disorder
  function respPhCheck(type, v) {
    const acid = type === 'respAcidosis';
    const dC = v.paco2 - NORMAL.paco2;
    const acute = NORMAL.ph - RESP[acid ? 'acidAcute' : 'alkAcute'].dph * dC;
    const chronic = NORMAL.ph - RESP[acid ? 'acidChronic' : 'alkChronic'].dph * dC;
    const lo = Math.min(acute, chronic), hi = Math.max(acute, chronic);
    let note;
    if (Math.abs(v.ph - acute) <= 0.02) note = 'pH fits acute';
    else if (Math.abs(v.ph - chronic) <= 0.02) note = 'pH fits chronic';
    else if (v.ph > lo && v.ph < hi) note = 'pH between acute and chronic: acute-on-chronic or mixed';
    else note = 'pH outside both predictions: superimposed metabolic disorder';
    return { acute, chronic, note };
  }

  function anionGap(v) {
    if (!has(v.na, v.cl, v.hco3)) return null;
    const refAlb = has(v.refAlb) ? v.refAlb : NORMAL.alb;
    const ag = v.na - (v.cl + v.hco3);
    const corr = has(v.alb) ? ag + 2.5 * (refAlb - v.alb) : null;
    const used = corr ?? ag;
    const normalAg = has(v.normalAg) ? v.normalAg : 12;
    const res = { ag, corr, used, normalAg, refAlb, high: used > normalAg + 2 };
    if (has(v.alb, v.phos)) res.expectedAg = 2 * v.alb + 0.5 * v.phos;

    if (!res.high) return res;
    const dAG = used - normalAg, dH = NORMAL.hco3 - v.hco3;
    const d = { dAG, dH, diff: dAG - dH };

    if (dH > 0) {
      d.ratio = dAG / dH;
      d.ratioNote = d.ratio < 0.4 ? 'normal-AG acidosis predominates'
        : d.ratio < 0.8 ? 'high-AG + normal-AG metabolic acidosis'
          : d.ratio <= 1.2 ? 'pure high-AG metabolic acidosis'
            : d.ratio <= 2 ? 'borderline (pure range 0.8-1.6/2 in some texts) - check delta difference'
              : 'high-AG acidosis + metabolic alkalosis';
    }
    const band = x => x < -5 ? 'nagma' : x > 5 ? 'alk' : 'pure';
    d.diffBand = band(d.diff);
    if (has(v.lactate) && v.lactate > 2) {
      d.lactDiff = 0.6 * dAG - dH;
      d.final = band(d.lactDiff);
      d.finalBasis = 'lactate-adjusted delta difference';
    } else {
      d.final = d.diffBand;
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

  // Base excess (Copenhagen) approach, Berend NEJM 2018
  function baseExcess(v, chronicity) {
    if (!has(v.sbe)) return null;
    const lines = [];
    const found = [];
    const acidemia = v.ph < 7.38, alkalemia = v.ph > 7.42;
    lines.push(`pH ${v.ph}: ${acidemia ? 'acidemia (< 7.38)' : alkalemia ? 'alkalemia (> 7.42)' : 'normal (7.38-7.42)'}`);

    const metAcid = v.sbe < -2, metAlk = v.sbe > 2;
    const respAcid = v.paco2 > 42, respAlk = v.paco2 < 38;
    if (acidemia) {
      if (metAcid) found.push('metAcidosis');
      if (respAcid) found.push('respAcidosis');
    } else if (alkalemia) {
      if (metAlk) found.push('metAlkalosis');
      if (respAlk) found.push('respAlkalosis');
    } else {
      if (metAcid) found.push('metAcidosis');
      if (metAlk) found.push('metAlkalosis');
      if (respAcid) found.push('respAcidosis');
      if (respAlk) found.push('respAlkalosis');
    }
    if (!found.length) {
      lines.push(`SBE ${v.sbe}, PaCO2 ${v.paco2}: no primary disorder by BE criteria`);
      return { lines };
    }

    let flag = false;
    found.forEach(t => {
      if (t === 'metAcidosis' || t === 'metAlkalosis') {
        const acid = t === 'metAcidosis';
        const exp = 40 + (acid ? 1 : 0.6) * v.sbe;
        const vd = verdict(v.paco2, exp - BE_TOL, exp + BE_TOL, '+ respiratory acidosis', '+ respiratory alkalosis');
        lines.push(`${DISORDERS[t]} (SBE ${v.sbe} ${acid ? '< -2' : '> 2'})`);
        lines.push(`  Expected PaCO2 = 40 + ${acid ? '' : '0.6 x '}SBE = ${r1(exp)} (+/-${BE_TOL}); measured ${v.paco2}: ${vd.note}`);
        if (vd.status !== 'ok') flag = true;
      } else {
        const acid = t === 'respAcidosis';
        lines.push(`${DISORDERS[t]} (PaCO2 ${v.paco2} ${acid ? '> 42' : '< 38'})`);
        const phases = chronicity === 'acute' ? ['acute'] : chronicity === 'chronic' ? ['chronic'] : ['acute', 'chronic'];
        phases.forEach(p => {
          const exp = p === 'acute' ? 0 : 0.4 * (v.paco2 - 40);
          const vd = verdict(v.sbe, exp - BE_TOL, exp + BE_TOL, '+ metabolic alkalosis', '+ metabolic acidosis');
          lines.push(`  ${p === 'acute' ? 'Acute: expected SBE = 0' : `Chronic: expected SBE = 0.4 x (PaCO2 - 40) = ${r1(exp)}`} (+/-${BE_TOL}); measured ${v.sbe}: ${vd.note}`);
          if (vd.status !== 'ok' && phases.length === 1) flag = true;
        });
      }
    });
    if (v.sbe < -6) lines.push('SBE < -6: severe metabolic acidosis (marker of hypoperfusion in trauma / shock)');
    return { lines, flag };
  }

  function interpret(v) {
    const out = { steps: [], errors: [], warnings: [], workups: [] };
    if (!has(v.ph, v.paco2, v.hco3)) {
      out.errors.push('pH, PaCO2 and HCO3 are required.');
      return out;
    }
    if (v.ph < 6.5 || v.ph > 8.0) out.errors.push('pH out of physiological range (6.5-8.0).');
    if (v.paco2 < 5 || v.paco2 > 150) out.errors.push('PaCO2 out of range (5-150 mmHg).');
    if (v.hco3 < 1 || v.hco3 > 60) out.errors.push('HCO3 out of range (1-60 mEq/L).');
    if (out.errors.length) return out;

    // 1. Oxygenation
    const ox = oxygenation(v);
    if (ox) {
      const lines = [];
      lines.push(`FiO2 ${ox.fio2}${ox.assumed ? ' (not entered - room air assumed)' : ''}`);
      if (ox.roomAir) lines.push(`PaO2 ${v.pao2} on room air: ${ox.grade}`);
      lines.push(`PaO2/FiO2 = ${Math.round(ox.pf)}` + (ox.pf <= 300
        ? ` (${ox.pf <= 100 ? 'severe' : ox.pf <= 200 ? 'moderate' : 'mild'} range if ARDS criteria met: bilateral opacities, PEEP >= 5)` : ''));
      if (ox.aa !== undefined) {
        lines.push(`PAO2 = FiO2 x (${ox.patm} - 47) - PaCO2/${ox.rq} = ${r1(ox.pAO2)} mmHg`);
        lines.push(`A-a gradient = PAO2 - PaO2 = ${r1(ox.aa)} mmHg` + (ox.aaNormal !== undefined
          ? `; normal <= 2.5 + age/4 = ${r1(ox.aaNormal)}: ${ox.aaWide ? 'Wide' : 'Normal'}`
          : '; enter age for normal value'));
        if (!ox.roomAir) lines.push('  Age-based A-a reference applies to room air; A-a widens normally with higher FiO2');
        if (ox.hypoxemic && ox.aaNormal !== undefined) {
          if (ox.aaWide) lines.push('Mechanism (wide A-a, low P/F): V/Q mismatch, shunt, diffusion abnormality, low ScvO2');
          else lines.push(`Mechanism (normal A-a): ${v.paco2 > RANGE.paco2High ? 'alveolar hypoventilation (PaCO2 high)' : 'low PiO2 (altitude) or alveolar hypoventilation'}`);
        }
      }
      out.steps.push({ title: '1  Oxygenation', lines, flag: ox.hypoxemic || ox.aaWide });
    } else {
      out.steps.push({ title: '1  Oxygenation', lines: ['Enter PaO2 (and FiO2, age) to assess oxygenation'], muted: true });
    }

    // 2. Ventilation
    const vent = ventilation(v);
    const vLines = [`PaCO2 ${v.paco2} mmHg: ${vent.status}`];
    if (vent.vdvt !== undefined) {
      vLines.push(`Vd/Vt = (PaCO2 - PetCO2) / PaCO2 = ${r2(vent.vdvt)} (normal 0.3)`);
      if (vent.vdHigh) vLines.push('  Increased dead space: emphysema, low cardiac output / pulmonary embolism, high PEEP / auto-PEEP');
    }
    out.steps.push({ title: '2  Ventilation', lines: vLines, flag: vent.status !== 'Normal ventilation' || vent.vdHigh });

    // 3.1 Internal consistency
    const cons = consistency(v);
    out.steps.push({
      title: '3.1  Internal consistency',
      lines: [
        `[H+] from pH = ${r1(cons.hMeasured)} nmol/L; 24 x PaCO2 / HCO3 = ${r1(cons.hCalc)} nmol/L`,
        `pH = 6.1 + log(HCO3 / (0.03 x PaCO2)) = ${r2(cons.phCalc)}`,
        cons.ok ? 'Consistent (within 10%)' : `Inconsistent (${Math.round(cons.diff * 100)}% difference) - check sample or transcription`,
      ],
      flag: !cons.ok,
    });

    // 3.2 pH
    const phStatus = v.ph < RANGE.phLow ? 'Acidemia' : v.ph > RANGE.phHigh ? 'Alkalemia' : 'Normal pH';
    out.steps.push({ title: '3.2  pH', lines: [`pH ${v.ph}: ${phStatus} (7.35-7.45)`] });

    // 3.3 Primary disorder
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
    if (primary.normalPh && primary.list.length) pLines.push('pH within normal range despite abnormal PaCO2 and HCO3: near-complete compensation or mixed disorder (see 3.4)');
    out.steps.push({ title: '3.3  Primary disorder', lines: pLines });

    // 3.4 Compensation
    const concomitant = [];
    if (primary.list.length) {
      const type = primary.list[0];
      const comps = compensation(type, v, v.chronicity);
      const lines = [];
      comps.forEach(c => {
        lines.push(c.formula);
        lines.push(`  Expected ${c.param} ${r1(c.lo)} - ${r1(c.hi)}; measured ${c.actual}: ${c.note}`);
      });
      if (comps.length === 1 && comps[0].status !== 'ok') concomitant.push(comps[0].note);
      if (comps.length === 2 && comps.every(c => c.status === comps[0].status) && comps[0].status !== 'ok')
        concomitant.push(comps[0].note);
      if (primary.mixed) lines.push('  (mixed disorder: shown for the first disorder to confirm the second)');
      if (type === 'respAcidosis' || type === 'respAlkalosis') {
        const p = respPhCheck(type, v);
        lines.push(`pH prediction: acute ${r2(p.acute)}, chronic ${r2(p.chronic)}; measured ${v.ph}: ${p.note}`);
      }
      out.steps.push({ title: '3.4  Expected compensation', lines, flag: comps.some(c => c.status !== 'ok') });
    }

    // 3.5 Anion gap and delta
    const ag = anionGap(v);
    if (ag) {
      const lines = [`AG = Na - (Cl + HCO3) = ${r1(ag.ag)} mEq/L`];
      if (ag.corr !== null) lines.push(`Albumin-corrected AG = AG + 2.5 x (${ag.refAlb} - albumin) = ${r1(ag.corr)} mEq/L`);
      if (ag.expectedAg !== undefined) lines.push(`Expected normal AG = 2 x albumin + 0.5 x phosphate (mg/dL) = ${r1(ag.expectedAg)} mEq/L`);
      lines.push(ag.high ? `Elevated (normal ${ag.normalAg} +/- 2)` : `Not elevated (normal ${ag.normalAg} +/- 2)`);
      const d = ag.delta;
      if (d) {
        if (d.ratio !== undefined) lines.push(`Delta ratio = (AG - ${ag.normalAg}) / (24 - HCO3) = ${r2(d.ratio)}: ${d.ratioNote}`);
        lines.push(`Delta difference = (AG - ${ag.normalAg}) - (24 - HCO3) = ${r1(d.diff)} (-5 to +5 pure)`);
        if (d.lactDiff !== undefined) lines.push(`Lactic acidosis: 0.6 x dAG - dHCO3 = ${r1(d.lactDiff)}`);
        lines.push(`Conclusion (${d.finalBasis}): ${FINAL_TEXT[d.final]}`);
      }
      if (ag.high && !primary.list.includes('metAcidosis'))
        lines.push('High AG present despite no primary metabolic acidosis on pH/HCO3: hidden HAGMA');
      out.steps.push({ title: '3.5  Anion gap and delta gap', lines, flag: ag.high });
    } else {
      out.steps.push({ title: '3.5  Anion gap', lines: ['Enter Na and Cl to calculate (always check, even if pH is normal)'], muted: true });
    }

    // 3.6 Base excess approach
    const be = baseExcess(v, v.chronicity);
    if (be) out.steps.push({ title: '3.6  Base excess approach (Copenhagen)', lines: be.lines, flag: be.flag });

    // 4. Further workup
    const has_ = t => primary.list.includes(t);
    const metAcid = has_('metAcidosis') || concomitant.includes('Concomitant metabolic acidosis');
    if (ag && ag.high) {
      out.workups.push('hagma');
      out.steps.push({ title: '4  Further workup: High-AG metabolic acidosis', ...Workup.hagma(v) });
      if (ag.delta && ag.delta.final === 'nagma') {
        out.workups.push('urine');
        out.steps.push({ title: '4  Further workup: coexisting normal-AG acidosis', ...Workup.nagma(v) });
      }
    } else if (ag && metAcid) {
      out.workups.push('urine');
      out.steps.push({ title: '4  Further workup: Normal-AG metabolic acidosis', ...Workup.nagma(v) });
    } else if (!ag && metAcid) {
      out.steps.push({ title: '4  Further workup', lines: ['Enter Na and Cl to classify metabolic acidosis as high-AG or normal-AG'], muted: true });
    }
    if (has_('metAlkalosis') || (ag && ag.delta && ag.delta.final === 'alk')) {
      out.workups.push('urine', 'alk');
      out.steps.push({ title: '4  Further workup: Metabolic alkalosis', ...Workup.metAlkalosis(v) });
    }
    if (has_('respAcidosis') || concomitant.some(c => c.startsWith('Concomitant respiratory acidosis')))
      out.steps.push({ title: '4  Causes: Respiratory acidosis', ...Workup.respAcidosis(v) });
    if (has_('respAlkalosis'))
      out.steps.push({ title: '4  Causes: Respiratory alkalosis', ...Workup.respAlkalosis(v) });

    return out;
  }

  // ---------- UI ----------

  const FIELDS = [
    { group: 'Blood gas', id: 'ph',    label: 'pH',    unit: '',      step: '0.01' },
    { group: 'Blood gas', id: 'paco2', label: 'PaCO2', unit: 'mmHg',  step: '0.1' },
    { group: 'Blood gas', id: 'hco3',  label: 'HCO3-', unit: 'mEq/L', step: '0.1' },
    { group: 'Blood gas', id: 'sbe',   label: 'SBE (optional)', unit: 'mmol/L', step: '0.1' },
    { group: 'Electrolytes', id: 'na',  label: 'Na+',     unit: 'mEq/L', step: '0.1' },
    { group: 'Electrolytes', id: 'k',   label: 'K+',      unit: 'mEq/L', step: '0.1' },
    { group: 'Electrolytes', id: 'cl',  label: 'Cl-',     unit: 'mEq/L', step: '0.1' },
    { group: 'Electrolytes', id: 'alb', label: 'Albumin', unit: 'g/dL',  step: '0.1' },
    { group: 'Electrolytes', id: 'refAlb', label: 'Reference albumin', unit: 'g/dL', step: '0.1', placeholder: '4' },
    { group: 'Electrolytes', id: 'phos', label: 'Phosphate', unit: 'mg/dL', step: '0.1' },
    { group: 'Electrolytes', id: 'normalAg', label: 'Lab normal AG', unit: 'mEq/L', step: '1', placeholder: '12' },
    { group: 'Oxygenation', id: 'pao2', label: 'PaO2', unit: 'mmHg', step: '0.1' },
    { group: 'Oxygenation', id: 'fio2', label: 'FiO2', unit: '% or fraction', step: '0.01' },
    { group: 'Oxygenation', id: 'age',  label: 'Age',  unit: 'years', step: '1' },
    { group: 'Oxygenation', id: 'patm', label: 'Patm', unit: 'mmHg', step: '1', placeholder: '760' },
    { group: 'Oxygenation', id: 'rq',   label: 'RQ', unit: '', step: '0.1', placeholder: '0.8' },
    { group: 'Oxygenation', id: 'petco2', label: 'PetCO2 (optional)', unit: 'mmHg', step: '1' },

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
    return esc(`Order: 1 Oxygenation -> 2 Ventilation -> 3 Acid-base -> 4 Workup

Reference ranges (ABG)
  pH 7.35-7.45 | PaCO2 35-45 mmHg | HCO3 22-26 mEq/L | PaO2 85-100 | SBE -2 to +2
  (VBG: pH 7.32-7.42, PvCO2 38-48, PvO2 35-45)

1 Oxygenation
  PaO2 on room air: < 80 mild, < 60 moderate, < 40 severe hypoxemia
  PAO2 = FiO2 x (Patm - 47) - PaCO2 / RQ      (Patm 760 -> 713; RQ 0.8)
  A-a gradient = PAO2 - PaO2 ; normal <= 2.5 + age/4 (or 0.3 x age)
    Normal A-a: low PiO2, alveolar hypoventilation
    Wide A-a / low P/F: V/Q mismatch, shunt, diffusion, low ScvO2
  P/F = PaO2 / FiO2 ; Berlin ARDS mild 201-300, moderate 101-200, severe <= 100

2 Ventilation
  PaCO2 < 35 hyperventilation ; > 45 hypoventilation
  PaCO2 = 0.863 x VCO2 / (RR x VT x (1 - Vd/Vt))
  Vd/Vt = (PaCO2 - PetCO2) / PaCO2 ; normal 0.3

3 Acid-base (physiological approach)
  [H+] (nmol/L) = 24 x PaCO2 / HCO3 ; pH = 6.1 + log(HCO3 / (0.03 x PaCO2))
  Metabolic acidosis     PaCO2 = 1.5 x HCO3 + 8 (+/-2)         Winter
  Metabolic alkalosis    PaCO2 = 0.7 x HCO3 + 20 (+/-2)
                         or PaCO2 - 40 = 0.7 x (HCO3 - 24)
  Resp acidosis  acute   HCO3 +1 per 10 PaCO2      pH -0.08 per 10
                 chronic HCO3 +4 (3.5) per 10      pH -0.03 per 10
  Resp alkalosis acute   HCO3 -2 per 10            pH +0.08 per 10
                 chronic HCO3 -5 (4) per 10        pH +0.02 per 10

  AG = Na - (Cl + HCO3)              normal 12 +/- 2 (lab-dependent)
  Corrected AG = AG + 2.5 x (4 or 4.5 - albumin)
  Expected AG = 2 x albumin + 0.5 x phosphate (mg/dL)
  Delta ratio = (AG - 12) / (24 - HCO3)
    < 0.8          high-AG + normal-AG acidosis (< 0.4 normal-AG predominant)
    0.8 - 1.2      pure high-AG acidosis (0.8 - 1.6/2 in some texts)
    > 2 (> 1.2)    high-AG acidosis + metabolic alkalosis
  Delta difference = (AG - 12) - (24 - HCO3)
    -5 to +5 pure ; < -5 + normal-AG acidosis ; > +5 + metabolic alkalosis
    Lactic acidosis: 0.6 x (AG - 12) - (24 - HCO3)

3.6 Base excess approach (Copenhagen rules)
  Acidemia pH < 7.38 ; alkalemia pH > 7.42
  Metabolic acidosis  SBE < -2    expected PaCO2 = 40 + SBE
  Metabolic alkalosis SBE > +2    expected PaCO2 = 40 + 0.6 x SBE
  Resp acidosis  PaCO2 > 42 (45)  acute SBE = 0 +/- 2 ; chronic SBE = 0.4 x (PaCO2 - 40)
  Resp alkalosis PaCO2 < 38 (35)  acute SBE = 0 +/- 2 ; chronic SBE = 0.4 x (PaCO2 - 40)
  SBE < -6 severe metabolic acidosis

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
  Serum OG = measured - calculated   > 10 elevated ; > 25 methanol / ethylene glycol
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
  Poompichet A. Arterial blood gas interpretation. Division of Critical Care
    Medicine, Siriraj Hospital (lecture).
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
  Berend K. Diagnostic use of base excess in acid-base disorders.
    N Engl J Med 2018;378:1419-28.
  Batlle DC, et al. The use of the urinary anion gap in the diagnosis of
    hyperchloremic metabolic acidosis. N Engl J Med 1988;318:594-9.
  Kraut JA, Madias NE. Differential diagnosis of nongap metabolic acidosis:
    value of a systematic approach. Clin J Am Soc Nephrol 2012;7:671-9.
  Kraut JA, Kurtz I. Toxic alcohol ingestions: clinical features, diagnosis,
    and management. Clin J Am Soc Nephrol 2008;3:208-25.
  Funder JW, et al. Management of primary aldosteronism: Endocrine Society
    clinical practice guideline. J Clin Endocrinol Metab 2016;101:1889-916.`);
  }

  const api = { render, interpret, consistency, detectPrimary, compensation, anionGap, oxygenation, ventilation, baseExcess };
  if (typeof window !== 'undefined') window.ABG = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
