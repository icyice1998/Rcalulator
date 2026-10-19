// Second-tier acid-base workup: NAGMA, HAGMA, metabolic alkalosis
(function () {
  const r1 = x => Math.round(x * 10) / 10;
  const has = (...xs) => xs.every(x => x !== null && x !== undefined && !Number.isNaN(x));

  // ---------- Normal anion gap metabolic acidosis ----------

  function nagma(v) {
    const lines = [];
    const res = { lines, flag: true };

    if (!has(v.una, v.uk, v.ucl)) {
      lines.push('Enter urine Na, K, Cl (spot urine taken while pH < 7.35) to evaluate renal NH4+ excretion');
      res.missing = true;
      return res;
    }

    if (has(v.ph) && v.ph >= 7.35) lines.push('Caution: UNC is interpretable only while acidemic (pH < 7.35)');
    if (has(v.egfr) && v.egfr <= 20) lines.push('Caution: eGFR <= 20 - acidosis may be from reduced nephron mass rather than RTA');
    if (v.una < 25) lines.push('Caution: urine Na < 25 (low distal Na delivery / hypovolemia) - UNC unreliable');
    if (has(v.uph) && v.uph > 7.5) lines.push('Caution: urine pH > 7.5 - bicarbonaturia makes UNC falsely positive');

    const unc = v.una + v.uk - v.ucl;
    res.unc = unc;
    lines.push(`UNC (urine anion gap) = (UNa + UK) - UCl = ${r1(unc)} mEq/L: ${unc < 0 ? 'Negative' : 'Positive'}`);

    let uog = null;
    if (has(v.uosm, v.uurea)) {
      const uglu = has(v.uglu) ? v.uglu : 0;
      const cUosm = 2 * (v.una + v.uk) + v.uurea / 2.8 + uglu / 18;
      uog = v.uosm - cUosm;
      res.uog = uog;
      lines.push(`Calculated Uosm = 2(UNa + UK) + Uurea/2.8 + Uglucose/18 = ${Math.round(cUosm)} mOsm/kg` +
        (has(v.uglu) ? '' : ' (urine glucose taken as 0)'));
      lines.push(`UOG = measured - calculated Uosm = ${Math.round(uog)} mOsm/kg: ${uog < 100 ? '< 100, low NH4+ excretion' : '>= 100, adequate NH4+ excretion'}`);
      if (unc >= 0 && uog >= 100)
        lines.push('UNC positive but UOG >= 100: false-positive UNC from unmeasured urine anion (hippurate/toluene, D-lactate, ketoacids, salicylate, bicarbonaturia)');
      if (unc < 0 && uog < 100)
        lines.push('UNC and UOG disagree: rely on UOG');
    } else {
      lines.push('Enter urine osmolality and urea to calculate UOG (preferred when UNC is unreliable)');
    }

    const impaired = uog !== null ? uog < 100 : unc >= 0;
    res.impaired = impaired;

    if (impaired) {
      lines.push('');
      lines.push('Impaired NH4+ excretion: distal RTA group');
      if (!has(v.k)) {
        lines.push('Enter serum K to subtype');
      } else if (v.k <= 5.0) {
        lines.push(`Serum K ${v.k} (low/normal): Classical (secretory) or backleak dRTA - expect urine pH > 5.5`);
        lines.push('  Causes: Sjogren, SLE, RA, PBC, lithium, amphotericin B, toluene, SAO (AE1), obstructive uropathy, hereditary');
        if (has(v.uph) && v.uph < 5.5) lines.push('  Urine pH < 5.5 is atypical for dRTA - re-check (UTI, sample handling)');
      } else {
        if (!has(v.uph)) {
          lines.push(`Serum K ${v.k} (high): enter urine pH - > 5.5 voltage-dependent dRTA, < 5.5 type 4 RTA`);
        } else if (v.uph > 5.5) {
          lines.push(`Serum K ${v.k} (high), urine pH ${v.uph} > 5.5: Voltage-dependent dRTA`);
          lines.push('  Causes: amiloride, triamterene, trimethoprim (high dose), pentamidine, lithium, partial obstructive uropathy');
        } else {
          lines.push(`Serum K ${v.k} (high), urine pH ${v.uph} <= 5.5: Type 4 RTA (hypo- / pseudohypoaldosteronism)`);
          lines.push('  Aldosterone deficiency: Addison, CAH, heparin/LMWH, hyporeninemic (DM, AIDS, TIN, NSAID, ACEi/ARB, CNI)');
          lines.push('  Aldosterone resistance: PHA type 1-3 (type 2 = Gordon)');
        }
      }
    } else {
      lines.push('');
      lines.push('Adequate NH4+ excretion: extrarenal or proximal HCO3 loss');
      lines.push('  GI loss (diarrhea, ostomy) | pRTA | dilutional (large IV saline) | acid load (HCl, NH4Cl, TPN)');
      if (has(v.k) && v.k < 3.5)
        lines.push(`  Hypokalemia with urine K ${has(v.uk) ? v.uk : '-'}: ` +
          (v.uk > 15 ? 'renal K loss (> 15) favours pRTA' : 'low urine K (<= 15) favours GI loss'));
    }

    if (has(v.uhco3, v.hco3, v.scr, v.ucr)) {
      const fe = (v.uhco3 * v.scr) / (v.hco3 * v.ucr) * 100;
      res.feHco3 = fe;
      lines.push('');
      lines.push(`FE HCO3 = (UHCO3 x SCr) / (SHCO3 x UCr) x 100 = ${r1(fe)}%: ` +
        (fe > 15 ? '> 15%, proximal RTA' : fe < 5 ? '< 5%, normal proximal reabsorption' : '5-15%, indeterminate'));
      lines.push('  Valid during bicarbonate loading with serum HCO3 near normal (> 18-20)');
      if (fe > 15) lines.push('  Check Fanconi: glycosuria with normal blood glucose, phosphaturia, aminoaciduria, uricosuria');
    }
    return res;
  }

  // ---------- High anion gap metabolic acidosis ----------

  function hagma(v) {
    const lines = [];
    const res = { lines, flag: true };
    const explained = [];

    lines.push('Check in order: L-lactate, ketone, renal insufficiency (L/K/R) -> D-lactate -> toxin');
    if (has(v.lactate)) {
      const hi = v.lactate > 2;
      lines.push(`L-lactate ${v.lactate} mmol/L: ${hi ? 'Elevated' : 'Not elevated'} (> 2)`);
      if (hi) explained.push('lactate');
    }
    if (has(v.ketone)) {
      const hi = v.ketone >= 3;
      lines.push(`Ketone (beta-OHB) ${v.ketone} mmol/L: ${hi ? '>= 3.0, ketoacidosis (DKA / AKA / starvation)' : v.ketone > 0.6 ? 'mild ketosis (starvation or AKA possible)' : 'not significant'}`);
      if (hi) explained.push('ketone');
    }
    if (has(v.egfr)) {
      const lo = v.egfr < 20;
      lines.push(`eGFR ${v.egfr}: ${lo ? '< 20, renal insufficiency can explain HAGMA' : 'renal failure unlikely to be the cause (needs GFR < 20-30 or oliguric AKI)'}`);
      if (lo) explained.push('renal');
    }
    if (!has(v.lactate) && !has(v.ketone) && !has(v.egfr))
      lines.push('Enter lactate, ketone and eGFR in "HAGMA workup"');

    if (explained.length && has(v.lactate) && v.lactate > 2)
      lines.push('  Lactate: type A (shock, hypoperfusion) vs type B (metformin, malignancy, thiamine def., toxin, liver failure)');
    if (!explained.length && (has(v.lactate) || has(v.ketone) || has(v.egfr)))
      lines.push('Not explained by L/K/R: consider D-lactate (short bowel, bowel bypass) then toxins');

    if (has(v.sosm, v.na, v.bun, v.glu)) {
      const cSosm = 2 * v.na + v.bun / 2.8 + v.glu / 18;
      const og = v.sosm - cSosm;
      res.og = og;
      lines.push('');
      lines.push(`Calculated Sosm = 2Na + BUN/2.8 + Glucose/18 = ${Math.round(cSosm)} mOsm/kg`);
      lines.push(`Serum osmolal gap = ${Math.round(og)} mOsm/kg: ` +
        (og > 20 ? '> 20, strongly suggests toxic alcohol (methanol, ethylene glycol, propylene glycol)'
          : og > 10 ? '> 10, elevated (toxic alcohol, ethanol, also lactic/ketoacidosis can raise slightly)'
            : 'normal (<= 10)'));
      if (og <= 10) lines.push('  Normal OG toxins: salicylate, hippurate (toluene), pyroglutamate (5-oxoproline, paracetamol)');
      lines.push('  Ethanol raises OG: subtract ethanol (mg/dL) / 3.7 if level available');
    } else {
      lines.push('Enter measured serum osmolality, BUN and glucose to calculate serum osmolal gap');
    }
    return res;
  }

  // ---------- Metabolic alkalosis ----------

  function metAlkalosis(v) {
    const lines = [];
    const res = { lines, flag: true };
    lines.push('First exclude exogenous alkali: NaHCO3, massive transfusion, citrate (CRRT), IV penicillin');

    if (!has(v.ucl)) {
      lines.push('Enter urine Cl (urine Na is unreliable because of bicarbonaturia)');
      res.missing = true;
    } else if (v.ucl < 20) {
      lines.push(`Urine Cl ${v.ucl} < 20: Extra-renal salt loss (chloride responsive)`);
      lines.push('  Vomiting / NG drain, villous adenoma, congenital chloridorrhea, laxative, cystic fibrosis,');
      lines.push('  post-hypercapnia, non-reabsorbable anion, remote diuretic use');
    } else {
      lines.push(`Urine Cl ${v.ucl} >= 20: assess BP / volume`);
      if (v.bp === 'high') {
        lines.push('  Hypertension: mineralocorticoid excess - check PAC / PRA');
      } else if (v.bp === 'low') {
        lines.push('  Normo-/hypotension: Renal salt loss');
        lines.push('  Current diuretic, Bartter / Gitelman, hypokalemia, hypomagnesemia, tubulopathy');
        if (has(v.ucacr)) {
          if (v.ucacr > 0.2) lines.push(`  Urine Ca/Cr ${v.ucacr} > 0.2 mg/mg: Bartter-like (or loop diuretic)`);
          else if (v.ucacr < 0.07) lines.push(`  Urine Ca/Cr ${v.ucacr} < 0.07 mg/mg: Gitelman-like (or thiazide)`);
          else lines.push(`  Urine Ca/Cr ${v.ucacr}: indeterminate (0.07-0.2)`);
        } else {
          lines.push('  Enter urine Ca/Cr to separate Bartter (> 0.2) from Gitelman (< 0.07)');
        }
      } else {
        lines.push('  Select BP status: hypertension -> PAC/PRA; normo/hypotension -> renal salt loss');
      }
    }

    if (has(v.pac, v.pra)) {
      lines.push('');
      const arr = v.pra > 0 ? v.pac / v.pra : Infinity;
      const pacHigh = v.pac >= 10, praLow = v.pra <= 1;
      lines.push(`PAC ${v.pac} ng/dL, PRA ${v.pra} ng/mL/h, ARR ${Number.isFinite(arr) ? r1(arr) : '-'}`);
      if (pacHigh && praLow && arr > 20) {
        lines.push('  High PAC / low PRA: Primary aldosteronism or GRA (FH-I)');
      } else if (pacHigh && !praLow) {
        lines.push('  High PAC / high PRA: Secondary hyperaldosteronism');
        lines.push('  Renovascular HT, renin-secreting tumor, malignant HT (or diuretic / vomiting if normotensive)');
      } else if (!pacHigh && praLow) {
        lines.push('  Low PAC / low PRA: non-aldosterone mineralocorticoid effect');
        lines.push('  AME / licorice, Liddle, Cushing / ectopic ACTH, CAH, DOC-producing tumor, Geller');
      } else {
        lines.push('  Pattern indeterminate - interpret with assay reference ranges');
      }
    }
    return res;
  }

  const api = { nagma, hagma, metAlkalosis };
  if (typeof window !== 'undefined') window.AcidBaseWorkup = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
