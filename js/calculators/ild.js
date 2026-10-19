// Interstitial lung disease: clinical approach and clue-based differential
(function () {
  const UI = typeof window !== 'undefined' && window.UI ? window.UI : require('../ui.js');
  const Tree = typeof window !== 'undefined' && window.Tree ? window.Tree : require('../tree.js');

  const has = (...xs) => xs.every(x => x !== null && x !== undefined && !Number.isNaN(x));

  const CTD_SIGNS = [
    ['raynaud', 'Raynaud phenomenon'], ['mechanic', "Mechanic's hands / cracked fingers"], ['arthritis', 'Inflammatory arthritis'],
    ['rash', 'Gottron papules / heliotrope / skin thickening'], ['sicca', 'Sicca symptoms'], ['myositis', 'Myalgia or proximal weakness'],
  ];
  const EXPOSURES = [
    ['organic', 'Birds, feathers, visible mold or farm'], ['silica', 'Silica (sandblasting, construction, tunnelling)'],
    ['asbestos', 'Asbestos (shipyard, insulation, brake mechanic)'],
  ];
  const DRUGS = [
    ['amiodarone', 'Amiodarone'], ['methotrexate', 'Methotrexate'], ['nitrofurantoin', 'Nitrofurantoin'], ['bleomycin', 'Bleomycin'],
    ['ici', 'Other chemotherapy / immune checkpoint inhibitor'], ['radiation', 'Chest radiation 4-12 weeks ago'],
  ];
  const OTHER = [
    ['lymph', 'Lymphadenopathy or organomegaly'], ['ptx', 'History of pneumothorax'], ['hemoptysis', 'Hemoptysis'],
  ];
  const CXR = [
    ['lowVol', 'Low lung volume'], ['upper', 'Upper zone predominant'], ['lower', 'Lower zone predominant'],
    ['peripheral', 'Peripheral predominant'], ['plaque', 'Pleural plaque'], ['effusion', 'Pleural effusion'], ['hilar', 'Hilar or mediastinal nodes'],
  ];
  const SERO = [
    ['ana', 'ANA'], ['rfccp', 'RF / anti-CCP'], ['scl70', 'Scl-70'], ['rnp', 'RNP'], ['ssa', 'Ro/SSA, La/SSB'],
    ['asyn', 'Antisynthetase (Jo-1, PL-7, PL-12, EJ, OJ)'], ['mda5', 'MDA-5'], ['ro52', 'Ro-52'], ['pmscl', 'PM-Scl'],
  ];
  const HRCT = [
    ['', 'Not done'], ['uip', 'UIP: basal subpleural reticulation, honeycombing'], ['nsip', 'NSIP: basal GGO, subpleural sparing'],
    ['op', 'OP: consolidation, peribronchovascular, reverse halo'], ['nodules', 'Perilymphatic nodules, calcified nodes'],
    ['cysts', 'Cysts'], ['ggo', 'Diffuse ground glass / crazy paving'], ['indeterminate', 'Indeterminate'],
  ];

  // Each category collects points with the reason so the ranking is explainable
  function rank(v) {
    const c = {};
    const add = (k, pts, why) => { (c[k] = c[k] || { pts: 0, why: [] }).pts += pts; c[k].why.push(why); };

    const ctdSigns = CTD_SIGNS.filter(([id]) => v[id]);
    ctdSigns.forEach(([, l]) => add('ctd', 2, l));
    const sero = SERO.filter(([id]) => v[id]);
    sero.forEach(([id, l]) => add('ctd', id === 'ana' ? 2 : 3, `${l} positive`));
    if (v.mda5) add('acute', 2, 'MDA-5: rapidly progressive ILD');

    if (v.organic) add('hp', 3, 'Organic antigen exposure');
    if (v.silica) add('pneumo', 3, 'Silica exposure');
    if (v.asbestos) add('pneumo', 3, 'Asbestos exposure');
    if (v.plaque) add('pneumo', 2, 'Pleural plaque');
    DRUGS.filter(([id]) => v[id]).forEach(([, l]) => add('drug', 3, l));

    if (v.lymph) add('sarcoid', 2, 'Lymphadenopathy / organomegaly');
    if (v.hilar) add('sarcoid', 3, 'Hilar or mediastinal nodes');
    if (v.ptx) add('cystic', 2, 'Pneumothorax');
    if (v.hemoptysis) add('dah', 3, 'Hemoptysis');

    if (v.smoking === 'current') { add('smoking', 3, 'Current smoker'); }
    if (v.smoking === 'former') { add('ipf', 1, 'Former smoker'); add('smoking', 1, 'Former smoker'); }

    if (v.tempo === 'acute') { add('acute', 3, 'Onset < 2 weeks'); add('hp', 1, 'Acute onset'); }
    if (v.tempo === 'subacute') { add('ctd', 1, 'Subacute onset'); add('drug', 1, 'Subacute onset'); add('hp', 1, 'Subacute onset'); add('cop', 1, 'Subacute onset'); }
    if (v.tempo === 'chronic') { add('ipf', 2, 'Chronic course'); add('pneumo', 1, 'Chronic course'); }
    if (has(v.age) && v.age >= 60) add('ipf', 2, `Age ${v.age}`);
    if (has(v.age) && v.age < 50) { add('ctd', 1, `Age ${v.age}`); add('sarcoid', 1, `Age ${v.age}`); }

    if (v.lowVol) { add('ipf', 1, 'Low lung volume'); add('nsip', 1, 'Low lung volume'); }
    if (v.upper) { add('sarcoid', 1, 'Upper zone'); add('pneumo', v.silica ? 2 : 1, 'Upper zone'); add('smoking', 1, 'Upper zone'); }
    if (v.lower) { add('ipf', 1, 'Lower zone'); add('nsip', 1, 'Lower zone'); add('ctd', 1, 'Lower zone'); }
    if (v.peripheral) { add('cop', 1, 'Peripheral'); add('acute', 1, 'Peripheral (eosinophilic pneumonia)'); }
    if (v.effusion) add('ctd', 1, 'Pleural effusion (SLE, RA)');

    const hrct = { uip: [['ipf', 3], ['ctd', 1], ['hp', 1], ['pneumo', 1]], nsip: [['nsip', 3], ['ctd', 2], ['drug', 1]],
      op: [['cop', 3], ['ctd', 1], ['drug', 1]], nodules: [['sarcoid', 3], ['pneumo', 2]], cysts: [['cystic', 4]],
      ggo: [['hp', 2], ['acute', 1], ['pap', 1], ['dah', 1]] }[v.hrct] || [];
    const label = { uip: 'UIP', nsip: 'NSIP', op: 'OP', nodules: 'perilymphatic nodules', cysts: 'cysts', ggo: 'ground glass' }[v.hrct];
    hrct.forEach(([k, p]) => add(k, p, `HRCT ${label}`));

    if (has(v.balLym)) { if (v.balLym > 50) add('hp', 3, `BAL lymphocytes ${v.balLym}%`); else if (v.balLym > 15) { add('hp', 1, 'BAL lymphocytosis'); add('sarcoid', 1, 'BAL lymphocytosis'); add('nsip', 1, 'BAL lymphocytosis'); } }
    if (has(v.balEos) && v.balEos > 25) add('acute', 3, `BAL eosinophils ${v.balEos}% (eosinophilic pneumonia)`);
    if (has(v.cd4cd8) && v.cd4cd8 > 4) add('sarcoid', 3, `CD4/CD8 ${v.cd4cd8}`);
    if (v.balBloody) add('dah', 4, 'Bloody BAL rising on sequential aliquots');
    if (v.balMilky) add('pap', 4, 'Milky BAL (PAS positive)');

    // Idiopathic only when no known cause
    const known = ctdSigns.length || sero.length || v.organic || v.silica || v.asbestos || DRUGS.some(([id]) => v[id]);
    if (!known && c.ipf) add('ipf', 2, 'No CTD, exposure or drug cause');

    // Exposure-defined causes need the exposure itself
    if (!(v.silica || v.asbestos || v.plaque)) delete c.pneumo;
    if (!DRUGS.some(([id]) => v[id])) delete c.drug;
    return Object.entries(c).sort((a, b) => b[1].pts - a[1].pts).map(([k, val]) => ({ key: k, ...val }));
  }

  function name(key, v) {
    if (key === 'ctd') {
      if (v.mda5) return 'Anti-MDA5 dermatomyositis ILD';
      if (v.asyn) return 'Antisynthetase syndrome ILD';
      if (v.scl70) return 'Systemic sclerosis ILD';
      if (v.rfccp) return 'Rheumatoid arthritis ILD';
      if (v.ssa) return 'Sjogren ILD';
      if (v.rnp) return 'Mixed connective tissue disease ILD';
      return 'Connective tissue disease ILD (or IPAF)';
    }
    if (key === 'pneumo') return v.asbestos && !v.silica ? 'Asbestosis' : v.silica && !v.asbestos ? 'Silicosis' : 'Pneumoconiosis (silicosis, asbestosis)';
    if (key === 'drug') {
      const d = DRUGS.filter(([id]) => v[id]).map(([, l]) => l);
      return v.radiation && d.length === 1 ? 'Radiation pneumonitis' : `Drug-induced ILD${d.length ? ` (${d.join(', ')})` : ''}`;
    }
    return {
      hp: 'Hypersensitivity pneumonitis', sarcoid: 'Sarcoidosis', ipf: 'Idiopathic pulmonary fibrosis',
      nsip: 'Idiopathic NSIP', cop: 'Cryptogenic organizing pneumonia', smoking: 'Smoking-related ILD (RB-ILD, DIP, PLCH)',
      cystic: 'Cystic lung disease (LAM, PLCH, Birt-Hogg-Dube)', dah: 'Diffuse alveolar hemorrhage',
      pap: 'Pulmonary alveolar proteinosis', acute: 'Acute ILD (AIP, acute eosinophilic pneumonia, rapidly progressive CTD-ILD)',
    }[key];
  }

  function interpret(v) {
    const path = new Set(['susp', 'eval']);
    const sections = [];

    // Clinical clues
    const clue = [];
    clue.push({ acute: 'Acute (< 2 weeks): AIP, acute eosinophilic pneumonia, COP, acute HP, anti-MDA5 ILD',
      subacute: 'Subacute (2 weeks - months): CTD-ILD, COP, drug-induced ILD, subacute HP',
      chronic: 'Chronic (months - years): IPF, iNSIP, chronic HP, pneumoconiosis, CTD-ILD' }[v.tempo]);
    if (v.smoking === 'current') clue.push('Current smoker: RB-ILD, DIP, PLCH; also COPD and lung cancer');
    if (v.crackles) clue.push('Velcro crackles: fibrotic ILD');
    if (v.clubbing) clue.push('Clubbing: IPF, asbestosis, chronic HP');
    sections.push({ title: '1  Clinical evaluation', lines: clue });

    // Imaging
    const img = [];
    if (v.lowVol) img.push('Low lung volume: fibrotic ILD (IPF, NSIP, CTD-ILD, asbestosis, chronic drug)');
    else img.push('Preserved lung volume: LAM, PLCH, respiratory bronchiolitis, bronchiolitis obliterans, coexisting COPD');
    if (v.upper) img.push('Upper zone: sarcoidosis, silicosis, PLCH, ankylosing spondylitis');
    if (v.lower) img.push('Lower zone: IPF, NSIP, CTD-ILD, asbestosis');
    if (v.peripheral) img.push('Peripheral: organizing pneumonia, chronic eosinophilic pneumonia, CTD-ILD');
    if (v.plaque) img.push('Pleural plaque: asbestosis');
    if (v.effusion) img.push('Pleural effusion: CTD (SLE, RA), LAM (chylous)');
    if (v.hilar) img.push('Hilar or mediastinal nodes: sarcoidosis, berylliosis, lymphoma or cancer');
    if (v.hrct) {
      path.add('hrct');
      img.push(`HRCT: ${HRCT.find(h => h[0] === v.hrct)[1]}`);
    } else img.push('HRCT is the key test: obtain when ILD is suspected');
    sections.push({ title: '2  Imaging', lines: img });

    // Serology
    const sero = SERO.filter(([id]) => v[id]).map(([, l]) => l);
    sections.push({ title: '3  Serology', lines: sero.length ? [`Positive: ${sero.join(', ')}`,
      v.mda5 || v.ro52 ? 'MDA-5 or Ro-52: risk of aggressive ILD' : ''].filter(Boolean)
      : ['Send ANA, RF, anti-CCP, Scl-70, RNP, Ro/SSA, La/SSB and myositis panel when CTD features are present'] });

    // BAL
    const bal = [];
    if (has(v.balNeu)) bal.push(`Neutrophils ${v.balNeu}%: ${v.balNeu > 50 ? '> 50%, acute lung injury, aspiration, suppurative infection' : v.balNeu > 3 ? '> 3%, infection, aspiration, IPF, CTD, asbestosis, DAD' : 'normal'}`);
    if (has(v.balLym)) bal.push(`Lymphocytes ${v.balLym}%: ${v.balLym > 50 ? '> 50%, HP or cellular NSIP' : v.balLym > 15 ? '> 15%, sarcoidosis, NSIP, HP, drug, CTD, radiation, COP' : 'normal (10-15%)'}`);
    if (has(v.cd4cd8)) bal.push(`CD4/CD8 ${v.cd4cd8}: ${v.cd4cd8 > 4 ? '> 4, sarcoidosis' : 'not specific (normal 0.9-2.5)'}`);
    if (has(v.balEos)) bal.push(`Eosinophils ${v.balEos}%: ${v.balEos > 25 ? '> 25%, eosinophilic pneumonia' : v.balEos > 1 ? '> 1%, drug, asthma, EGPA, ABPA, eosinophilic pneumonia' : 'normal'}`);
    if (v.balBloody) bal.push('Bloody, rising on sequential aliquots: diffuse alveolar hemorrhage');
    if (v.balMilky) bal.push('Milky, PAS positive: pulmonary alveolar proteinosis');
    if (bal.length) { path.add('indet'); path.add('bronch'); path.add('bal'); sections.push({ title: '4  Bronchoalveolar lavage', lines: bal }); }

    // Ranking
    const ranked = rank(v);
    const top = ranked.slice(0, 5);
    const confident = top.length && top[0].pts >= 6 && (!top[1] || top[0].pts - top[1].pts >= 3);
    if (v.hrct) path.add(confident ? 'mddConf' : 'indet');
    const ddxLines = top.length
      ? top.map((t, i) => `  ${i + 1}. ${name(t.key, v)}  [${t.why.slice(0, 3).join('; ')}]`)
      : ['  Enter history, exposure, CXR or HRCT findings'];
    sections.push({ title: 'Top 5 differential diagnoses', lines: ddxLines, flag: true });

    // Next steps (lecture algorithm)
    const next = [];
    if (!v.hrct) next.push('HRCT chest');
    if (!sero.length && (top[0] && top[0].key === 'ctd' || CTD_SIGNS.some(([id]) => v[id]))) next.push('CTD serology and myositis panel');
    next.push('Multidisciplinary discussion: pulmonologist, radiologist, rheumatologist, pathologist');
    if (v.hrct && !confident) {
      next.push('Indeterminate: is bronchoscopy likely to help?');
      next.push('  Yes: BAL (HP, sarcoidosis, infection, eosinophilic pneumonia, DAH, PAP) and transbronchial biopsy');
      next.push('  No: transbronchial cryobiopsy or surgical lung biopsy');
    } else if (v.hrct) next.push('Confident clinical-radiologic diagnosis: treat cause, avoid exposure or drug, assess progression');
    next.push('PFT with DLCO and 6-minute walk for baseline severity and follow-up');
    sections.push({ title: 'Next steps', lines: next });

    const summary = top.length ? `Leading: ${name(top[0].key, v)}${confident ? '' : ' (indeterminate - see differentials)'}` : 'Suspected ILD: enter clinical clues';
    return { sections, path, summary, ranked };
  }

  // ---------- trees and tables ----------

  const APPROACH_TREE = {
    id: 'susp', text: 'Suspected ILD', note: 'Dyspnea, dry cough, crackles, restrictive PFT, low DLCO',
    children: [{
      id: 'eval', text: 'History, examination, CXR, laboratory', note: 'Tempo, smoking, exposures, drugs, CTD features',
      children: [{
        id: 'hrct', text: 'HRCT + multidisciplinary discussion',
        children: [
          { id: 'mddConf', edge: 'Confident', text: 'Specific ILD diagnosis' },
          {
            id: 'indet', edge: 'Indeterminate', text: 'Is bronchoscopy likely to help?',
            children: [
              {
                id: 'bronch', edge: 'Yes', text: 'Bronchoscopy',
                children: [
                  { id: 'bal', text: 'Bronchoalveolar lavage', note: 'Cell count, culture, cytology' },
                  { id: 'tblb', text: 'Transbronchial biopsy', note: 'Sarcoidosis, OP, EP, infection, cancer' },
                ],
              },
              {
                id: 'bx', edge: 'No', text: 'Tissue',
                children: [
                  { id: 'cryo', text: 'Transbronchial cryobiopsy' },
                  { id: 'slb', text: 'Surgical lung biopsy' },
                ],
              },
            ],
          },
        ],
      }],
    }],
  };

  const CLASS_TABLE = [
    { group: 'Idiopathic interstitial pneumonia' },
    ['Chronic fibrosing', 'IPF, idiopathic NSIP', 'UIP or NSIP pattern'],
    ['Acute or subacute', 'COP, AIP', 'OP or diffuse alveolar damage'],
    ['Smoking-related', 'RB-ILD, DIP', 'Centrilobular nodules, GGO'],
    ['Rare', 'Idiopathic LIP, PPFE', 'Distinct histology'],
    { group: 'ILD with known cause' },
    ['Connective tissue disease', 'RA, Sjogren, SLE, PM/DM, MCTD, SSc, IPAF', 'NSIP, UIP, OP'],
    ['Inhalational exposure', 'Hypersensitivity pneumonitis; silicosis, asbestosis', 'Organic antigen; inorganic dust'],
    ['Medication', 'Amiodarone, methotrexate, nitrofurantoin, bleomycin, ICI, radiation', 'Any pattern'],
    ['Granulomatous', 'Sarcoidosis', 'Perilymphatic nodules, hilar nodes'],
    ['Other', 'LAM, PLCH, Birt-Hogg-Dube; PAP; DAH', 'Cysts; crazy paving; hemorrhage'],
  ];

  const HRCT_TABLE = [
    ['Ground glass', '+/-', '+++', '+ / crazy paving'],
    ['Consolidation', '-', '-', '+++ / reverse halo'],
    ['Reticulation', '++', '++', '+/-'],
    ['Traction bronchiectasis', '++', '+ (central)', '-'],
    ['Honeycombing', '+++', '+/-', '-'],
    ['Distribution', 'Basal, subpleural', 'Basal, subpleural sparing', 'Focal or multifocal, peribronchovascular'],
    ['Clinical diagnoses', 'IPF, CTD (RA, SSc), chronic HP, asbestosis, drug', 'CTD-NSIP, drug, idiopathic NSIP', 'COP, infection, CTD'],
  ];

  const SERO_TABLE = [
    ['ANA', 'SLE 90-100%, SSc 97%, MCTD 100%, PM/DM 40-80%, RA 30-50%'],
    ['RF, anti-CCP', 'Rheumatoid arthritis'],
    ['Scl-70', 'Systemic sclerosis'],
    ['RNP', 'Mixed connective tissue disease'],
    ['Ro/SSA, La/SSB', 'Sjogren syndrome'],
    ['Antisynthetase (Jo-1, PL-7, PL-12, EJ, OJ)', 'Myositis with ILD'],
    ['MDA-5, Ro-52', 'Aggressive, rapidly progressive ILD'],
    ['PM-Scl', 'Polymyositis-scleroderma overlap'],
  ];

  // ---------- UI ----------

  const checks = list => `<div class="check-row">${list.map(([id, l]) =>
    `<label for="${id}"><input type="checkbox" id="${id}"> ${l}</label>`).join('')}</div>`;
  const NUMS = ['age', 'balNeu', 'balLym', 'balEos', 'cd4cd8'];
  const SELS = ['tempo', 'smoking', 'hrct'];
  const FLAGS = [...CTD_SIGNS, ...EXPOSURES, ...DRUGS, ...OTHER, ...CXR, ...SERO, ['crackles'], ['clubbing'], ['balBloody'], ['balMilky']].map(x => x[0]);
  const EXAMPLE = { age: 40, tempo: 'subacute', smoking: 'never', raynaud: true, mechanic: true, myositis: true, crackles: true,
    lower: true, lowVol: true, hrct: 'nsip', ana: true, asyn: true, ssa: true, ro52: true };

  function render(el) {
    el.innerHTML = `
      <div class="page-grid">
        <div class="abg-grid">
          <form class="card" id="ildForm">
            <h2>Interstitial lung disease</h2>
            <p class="muted">Chest</p>
            <p>More than 200 diffuse parenchymal lung diseases. Identify a cause from history and HRCT, then confirm by multidisciplinary discussion.</p>
            <fieldset><legend>History</legend>
              <div class="form-grid">
                ${UI.fieldHtml({ id: 'age', label: 'Age', unit: 'years', step: '1' })}
                ${UI.fieldHtml({ id: 'tempo', label: 'Onset', type: 'select', options: [['chronic', 'Chronic (months - years)'], ['subacute', 'Subacute (2 weeks - months)'], ['acute', 'Acute (< 2 weeks)']] })}
                ${UI.fieldHtml({ id: 'smoking', label: 'Smoking', type: 'select', options: [['never', 'Never'], ['former', 'Former'], ['current', 'Current']] })}
              </div>
              <p class="muted small">Exposure</p>${checks(EXPOSURES)}
              <p class="muted small">Drugs</p>${checks(DRUGS)}
              <p class="muted small">Other clues</p>${checks(OTHER)}
            </fieldset>
            <fieldset><legend>Examination</legend>
              ${checks([['crackles', 'Velcro crackles'], ['clubbing', 'Clubbing'], ...CTD_SIGNS])}</fieldset>
            <fieldset><legend>Chest X-ray</legend>${checks(CXR)}</fieldset>
            <fieldset><legend>HRCT and serology</legend>
              ${UI.fieldHtml({ id: 'hrct', label: 'HRCT pattern', type: 'select', options: HRCT })}
              <p class="muted small">Positive serology</p>${checks(SERO)}</fieldset>
            <details class="sub" id="balBox"><summary>Bronchoalveolar lavage</summary>
              <div class="form-grid">
                ${UI.fieldHtml({ id: 'balNeu', label: 'Neutrophils', unit: '%', step: '1' })}
                ${UI.fieldHtml({ id: 'balLym', label: 'Lymphocytes', unit: '%', step: '1' })}
                ${UI.fieldHtml({ id: 'balEos', label: 'Eosinophils', unit: '%', step: '1' })}
                ${UI.fieldHtml({ id: 'cd4cd8', label: 'CD4/CD8', unit: '', step: '0.1' })}
              </div>
              ${checks([['balBloody', 'Bloody, rising on sequential aliquots'], ['balMilky', 'Milky, PAS positive']])}
            </details>
            <p class="muted small" id="exampleNote">Example loaded: lecture case 3 (antisynthetase with Sjogren). Replace with your patient's findings.</p>
            <button type="reset" class="btn secondary">Clear</button>
          </form>
          <div class="card result" id="ildResult"></div>
        </div>
        <div class="card">
          <h3 class="section-title">Approach to ILD diagnosis</h3>
          ${Tree.render(APPROACH_TREE)}
          <p class="tree-legend">Highlighted boxes show where the case stands.</p>
        </div>
        <div class="card">
          <h3 class="section-title">Classification</h3>
          ${Tree.table(['Group', 'Diseases', 'Pattern or clue'], CLASS_TABLE)}
          <h3 class="section-title" style="margin-top:16px">HRCT patterns</h3>
          ${Tree.table(['Feature', 'UIP', 'NSIP', 'Organizing pneumonia'], HRCT_TABLE)}
          <h3 class="section-title" style="margin-top:16px">Serology</h3>
          ${Tree.table(['Antibody', 'Disease'], SERO_TABLE)}
        </div>
      </div>`;

    const form = el.querySelector('#ildForm');
    Object.entries(EXAMPLE).forEach(([id, val]) => {
      const i = el.querySelector('#' + id);
      if (i.type === 'checkbox') i.checked = val; else i.value = val;
    });
    const update = () => {
      const v = {};
      NUMS.forEach(id => { const raw = el.querySelector('#' + id).value; v[id] = raw === '' ? null : Number(raw); });
      SELS.forEach(id => { v[id] = el.querySelector('#' + id).value; });
      FLAGS.forEach(id => { v[id] = el.querySelector('#' + id).checked; });
      show(el, interpret(v));
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('reset', () => {
      setTimeout(() => { el.querySelector('#exampleNote').hidden = true; update(); }, 0);
    });
    update();
  }

  function show(el, res) {
    const esc = UI.esc;
    el.querySelector('#ildResult').innerHTML = `
      <h3>Interpretation</h3>
      <p class="summary-line">${esc(res.summary)}</p>
      ${res.sections.map(s => `
        <div class="step ${s.flag ? 'flagged' : ''}">
          <h4>${esc(s.title)}</h4>
          <pre>${s.lines.map(esc).join('\n')}</pre>
        </div>`).join('')}
      <p class="muted small">Decision support only. Final diagnosis needs multidisciplinary discussion.</p>`;
    Tree.highlight(el, res.path);
  }

  const api = { render, interpret, rank };
  if (typeof window !== 'undefined') window.ILD = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
