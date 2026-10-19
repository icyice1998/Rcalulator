// Pleural effusion topic with Light's criteria and pleural fluid analysis
(function () {
  const Topic = typeof window !== 'undefined' && window.Topic ? window.Topic : require('../topic.js');
  const Tree = typeof window !== 'undefined' && window.Tree ? window.Tree : require('../tree.js');
  const UI = typeof window !== 'undefined' && window.UI ? window.UI : require('../ui.js');

  const r2 = x => Math.round(x * 100) / 100;
  const has = (...xs) => xs.every(x => x !== null && x !== undefined && !Number.isNaN(x));

  const DDX = {
    trans: ['Heart failure', 'Cirrhosis (hepatic hydrothorax)', 'Nephrotic syndrome', 'Hypoalbuminemia', 'Peritoneal dialysis'],
    exu: ['Parapneumonic effusion', 'Tuberculous pleuritis', 'Malignant effusion', 'Pulmonary embolism', 'Autoimmune (RA, SLE)'],
    para: ['Complicated parapneumonic effusion', 'Empyema', 'Esophageal rupture', 'Rheumatoid pleuritis', 'Tuberculous empyema'],
    tb: ['Tuberculous pleuritis', 'Lymphoma', 'Malignant effusion', 'Rheumatoid pleuritis', 'Chylothorax'],
    lymph: ['Malignant effusion (lung, breast, lymphoma)', 'Tuberculous pleuritis', 'Post-CABG', 'Sarcoidosis', 'Chylothorax'],
    chylo: ['Lymphoma', 'Thoracic duct trauma or surgery', 'Lymphangioleiomyomatosis', 'Metastatic cancer', 'Cirrhosis (transudative chylothorax)'],
    pseudo: ['Long-standing tuberculous effusion', 'Rheumatoid pleuritis', 'Trapped lung', 'Chronic empyema', 'Paragonimiasis'],
    hemo: ['Chest trauma', 'Iatrogenic (procedure, anticoagulation)', 'Malignancy', 'Aortic rupture or dissection', 'Pulmonary infarction'],
    mal: ['Lung cancer', 'Breast cancer', 'Lymphoma', 'Mesothelioma', 'Ovarian or gastric cancer'],
  };

  function analyze(v) {
    const lines = [];
    const path = new Set(['pe', 'tap']);
    let key = null;

    // Light's criteria
    const crit = [];
    if (has(v.pProt, v.sProt) && v.sProt > 0) crit.push(['Protein ratio', v.pProt / v.sProt, 0.5]);
    if (has(v.pLdh, v.sLdh) && v.sLdh > 0) crit.push(['LDH ratio', v.pLdh / v.sLdh, 0.6]);
    if (has(v.pLdh)) {
      const uln = has(v.uln) ? v.uln : 250;
      crit.push([`Pleural LDH / (2/3 x ULN ${uln})`, v.pLdh / (uln * 2 / 3), 1]);
    }
    if (!crit.length) return { lines: ['Enter pleural and serum protein and LDH for Light\'s criteria'], path: new Set(['pe']), summary: 'Waiting for fluid results' };
    crit.forEach(([n, val, cut]) => lines.push(`${n} = ${r2(val)} (> ${cut} exudate): ${val > cut ? 'positive' : 'negative'}`));
    let exudate = crit.some(([, val, cut]) => val > cut);
    lines.push(`Light's criteria: ${exudate ? 'EXUDATE (at least one positive)' : crit.length < 3 ? 'no criterion positive so far (enter all three)' : 'TRANSUDATE (all negative)'}`);

    if (exudate && has(v.sAlb, v.pAlb)) {
      const seag = v.sAlb - v.pAlb;
      lines.push(`Serum - pleural albumin = ${r2(seag)} g/dL: ${seag > 1.2 ? '> 1.2, transudate (Light false positive, e.g. diuretic-treated HF)' : '<= 1.2, true exudate'}`);
      if (seag > 1.2) exudate = false;
    } else if (exudate && has(v.sProt, v.pProt) && v.sProt - v.pProt > 3.1) {
      lines.push(`Serum - pleural protein = ${r2(v.sProt - v.pProt)} g/dL > 3.1: transudate (Light false positive)`);
      exudate = false;
    }

    if (!exudate) {
      path.add('trans');
      key = 'trans';
      if (has(v.ph) && v.ph < 7.3) lines.push('Low pH transudate: consider urinothorax');
      return { lines, path, key, summary: 'Transudate: treat the systemic cause' };
    }
    path.add('exu');
    key = 'exu';
    let summary = 'Exudate';

    // Exudate refinement
    const ex = [];
    if (v.look === 'pus') { ex.push('Frank pus: empyema - drain'); key = 'para'; path.add('para'); summary = 'Empyema'; }
    if (has(v.ph) || has(v.glu)) {
      const lowPh = has(v.ph) && v.ph < 7.2, lowGlu = has(v.glu) && v.glu < 60;
      if (has(v.ph)) ex.push(`pH ${v.ph}: ${lowPh ? '< 7.2' : '>= 7.2'}`);
      if (has(v.glu)) ex.push(`Glucose ${v.glu} mg/dL: ${lowGlu ? '< 60' : '>= 60'}${has(v.glu) && v.glu < 30 ? ' (< 30: rheumatoid pleuritis or empyema)' : ''}`);
      if ((lowPh || lowGlu || v.gram) && key !== 'para') {
        key = 'para'; path.add('para'); summary = 'Complicated parapneumonic effusion';
        ex.push('Low pH or glucose (or positive Gram stain/culture) with pneumonia: complicated parapneumonic - drain');
        ex.push('Also low in: TB, malignancy, RA, esophageal rupture, lupus');
      }
    }
    if (v.gram && !ex.some(l => l.includes('Gram'))) ex.push('Positive Gram stain or culture: complicated parapneumonic or empyema');
    if (has(v.tg) && v.tg > 110 || v.look === 'milky' && !has(v.tg)) {
      key = 'chylo'; path.add('chy'); summary = 'Chylothorax';
      ex.push(has(v.tg) ? `Triglyceride ${v.tg} mg/dL > 110: chylothorax` : 'Milky fluid: check triglyceride (> 110 chylothorax) and cholesterol');
    } else if (has(v.tg, v.chol) && v.tg < 50 && v.chol > 200) {
      key = 'pseudo'; summary = 'Pseudochylothorax';
      ex.push(`Cholesterol ${v.chol} > 200 with TG < 50: pseudochylothorax (chronic effusion)`);
    }
    if (has(v.pHct, v.bHct) && v.bHct > 0) {
      const ratio = v.pHct / v.bHct;
      ex.push(`Pleural / blood Hct = ${r2(ratio)}: ${ratio > 0.5 ? '> 0.5, hemothorax - chest drain' : ratio > 0.01 ? 'bloody effusion, not hemothorax (malignancy, PE, trauma)' : 'not bloody'}`);
      if (ratio > 0.5) { key = 'hemo'; path.add('hemo'); summary = 'Hemothorax'; }
    }
    if (v.cyto) { key = 'mal'; path.add('mal'); summary = 'Malignant pleural effusion'; ex.push('Cytology positive: malignant effusion (sensitivity about 60%; repeat once if negative)'); }
    if (has(v.lym)) {
      const lymphocytic = v.lym > 50;
      ex.push(`Lymphocytes ${v.lym}%: ${lymphocytic ? '> 50%, lymphocytic (TB, malignancy, lymphoma, post-CABG, chylothorax, RA)' : 'not lymphocytic'}`);
      if (has(v.ada)) {
        ex.push(`ADA ${v.ada} U/L: ${v.ada > 70 ? '> 70, highly suggestive of TB' : v.ada > 40 ? '> 40, supports TB' : '<= 40, TB less likely'}`);
        if (lymphocytic && v.ada > 40 && !['mal', 'para', 'hemo', 'chylo'].includes(key)) { key = 'tb'; path.add('tb'); summary = 'Tuberculous pleuritis likely'; }
      }
      if (lymphocytic && key === 'exu') { key = 'lymph'; path.add('und'); summary = 'Lymphocytic exudate'; ex.push('Send cytology x 2, ADA; consider pleural biopsy (thoracoscopy) if undiagnosed'); }
    } else if (has(v.ada)) ex.push(`ADA ${v.ada} U/L: ${v.ada > 40 ? '> 40, supports TB (also empyema, lymphoma, RA)' : '<= 40'}`);
    if (has(v.amy) && v.amy > 200) ex.push(`Amylase ${v.amy} U/L raised: pancreatitis, esophageal rupture (salivary), malignancy`);
    if (key === 'exu') { path.add('und'); ex.push('Undiagnosed exudate: CT chest (CTPA if PE suspected), repeat cytology, thoracoscopic biopsy'); }
    lines.push('', ...ex);
    return { lines, path, key, summary };
  }

  // ---------- trees ----------

  const TREE = {
    id: 'pe', text: 'Pleural effusion', note: 'CXR, ultrasound (volume, septation, guide tap)',
    children: [
      { id: 'hf', edge: 'Typical HF, bilateral, afebrile', text: 'Treat HF and observe', note: 'Tap if unilateral, fever, pleuritic pain, or no response in 3 days' },
      {
        id: 'tap', edge: 'Otherwise', text: 'Diagnostic thoracentesis',
        note: 'Appearance, protein, LDH, cells, pH, glucose, Gram and culture, cytology, ADA',
        children: [
          { id: 'trans', edge: "Light's negative", text: 'Transudate', note: 'HF, cirrhosis, nephrotic, hypoalbuminemia, PD' },
          {
            id: 'exu', edge: "Light's positive", text: 'Exudate',
            children: [
              { id: 'para', edge: 'Pus, pH < 7.2, glucose < 60, Gram +', text: 'Complicated parapneumonic / empyema', note: 'Chest drain + antibiotics' },
              { id: 'tb', edge: 'Lymphocytic, ADA > 40', text: 'Tuberculous pleuritis', note: 'Anti-TB treatment' },
              { id: 'mal', edge: 'Cytology positive', text: 'Malignant effusion', note: 'IPC or pleurodesis' },
              { id: 'chy', edge: 'Milky, TG > 110 mg/dL', text: 'Chylothorax', note: 'Find duct injury or lymphoma' },
              { id: 'hemo', edge: 'Pleural/blood Hct > 0.5', text: 'Hemothorax', note: 'Chest drain, surgery if ongoing' },
              { id: 'und', edge: 'Undiagnosed', text: 'CT / CTPA, repeat cytology, thoracoscopy' },
            ],
          },
        ],
      },
    ],
  };

  // ---------- calculator markup ----------

  const FIELDS = [
    ['pProt', 'Pleural protein', 'g/dL', '0.1'], ['sProt', 'Serum protein', 'g/dL', '0.1'],
    ['pLdh', 'Pleural LDH', 'U/L', '1'], ['sLdh', 'Serum LDH', 'U/L', '1'], ['uln', 'Serum LDH ULN', 'U/L', '1'],
    ['pAlb', 'Pleural albumin', 'g/dL', '0.1'], ['sAlb', 'Serum albumin', 'g/dL', '0.1'],
    ['ph', 'Pleural pH', '', '0.01'], ['glu', 'Pleural glucose', 'mg/dL', '1'],
    ['lym', 'Lymphocytes', '%', '1'], ['ada', 'ADA', 'U/L', '1'], ['amy', 'Amylase', 'U/L', '1'],
    ['tg', 'Triglyceride', 'mg/dL', '1'], ['chol', 'Cholesterol', 'mg/dL', '1'],
    ['pHct', 'Pleural Hct', '%', '1'], ['bHct', 'Blood Hct', '%', '1'],
  ];
  const EXAMPLE = { pProt: 5.2, sProt: 7.0, pLdh: 420, sLdh: 220, uln: 250, ph: 7.35, glu: 85, lym: 85, ada: 68, look: 'straw' };

  const calcHtml = `
    <form id="peForm" class="pe-form">
      <div class="pft-top">
        <label for="look">Appearance
          <select id="look">
            <option value="straw">Clear / straw</option><option value="turbid">Turbid</option>
            <option value="pus">Pus</option><option value="milky">Milky</option><option value="bloody">Bloody</option>
          </select></label>
        <label for="gram"><input type="checkbox" id="gram"> Gram stain or culture positive</label>
        <label for="cyto"><input type="checkbox" id="cyto"> Cytology positive</label>
      </div>
      <div class="pe-grid">${FIELDS.map(([id, l, u, st]) =>
        `<label for="${id}"><span>${l} <small class="unit">${u}</small></span><input type="number" id="${id}" step="${st}" inputmode="decimal"></label>`).join('')}</div>
      <p class="muted small" id="peNote">Example loaded: lymphocytic exudate with high ADA. Replace with your patient's results; leave unknown boxes empty.</p>
    </form>
    <div class="step flagged" id="peOut"><h4>Fluid interpretation</h4><pre></pre></div>
    <div id="peTree">${Tree.render(TREE)}</div>
    <p class="tree-legend">Highlighted boxes show the path for the values entered.</p>`;

  const TOPIC = {
    title: 'Pleural effusion',
    subtitle: 'Chest',
    lead: 'Abnormal fluid in the pleural space from increased production (hydrostatic or oncotic imbalance, capillary leak) or reduced lymphatic drainage. The first step is to separate transudate from exudate.',
    sections: [
      {
        id: 'epi', title: 'Epidemiology',
        blocks: [
          { ul: [
            'Common: heart failure is the leading cause overall and of transudates',
            'Leading exudates: parapneumonic effusion, malignancy, pulmonary embolism; in Thailand tuberculous pleuritis is a major cause of lymphocytic exudate, especially in young adults',
            'About 40% of pneumonias have an effusion; 5-10% of these become complicated or empyema',
          ] },
        ],
      },
      {
        id: 'calc', title: 'Approach and fluid analysis',
        blocks: [
          { p: 'Thoracentesis is indicated for a new unexplained effusion over 1 cm on lateral decubitus or ultrasound. A patient with clear heart failure and bilateral effusions can be treated first; tap if the effusion is unilateral or asymmetric, with fever or pleuritic pain, or not improving after 3 days of diuresis.' },
          { html: calcHtml },
        ],
      },
      {
        id: 'criteria', title: 'Diagnostic criteria',
        blocks: [
          { sub: "Light's criteria: exudate if any one is present" },
          { table: { head: ['Criterion', 'Exudate'], rows: [
            ['Pleural / serum protein', '> 0.5'],
            ['Pleural / serum LDH', '> 0.6'],
            ['Pleural LDH', '> 2/3 of the serum upper limit of normal'],
          ] } },
          { p: "Light's criteria are about 98% sensitive for exudate but label about 25% of transudates as exudates, mainly heart failure on diuretics. Then use serum - pleural albumin gradient > 1.2 g/dL or protein gradient > 3.1 g/dL (transudate), or pleural NT-proBNP > 1500 pg/mL (heart failure)." },
          { sub: 'Parapneumonic effusion categories' },
          { table: { head: ['Category', 'Fluid', 'Management'], rows: [
            ['Simple', 'Clear, pH >= 7.2, glucose >= 60 mg/dL, Gram stain and culture negative', 'Antibiotics alone; re-tap if not improving'],
            ['Complicated', 'pH < 7.2, or glucose < 60 mg/dL, or positive Gram stain or culture, or loculated', 'Antibiotics + chest drain'],
            ['Empyema', 'Frank pus', 'Antibiotics + chest drain; fibrinolytic or VATS if poor drainage'],
          ] } },
        ],
      },
      {
        id: 'etio', title: 'Etiology',
        blocks: [
          { table: { head: ['Type', 'Mechanism', 'Causes'], rows: [
            { group: 'Transudate' },
            ['Raised hydrostatic pressure', 'Heart and venous', 'Heart failure (most common), constrictive pericarditis, SVC obstruction, fluid overload'],
            ['Low oncotic pressure', 'Hypoalbuminemia', 'Cirrhosis (hepatic hydrothorax, usually right), nephrotic syndrome, malnutrition'],
            ['Other', 'Fluid from other cavities', 'Peritoneal dialysis, urinothorax (low pH), CSF leak, hypothyroidism, atelectasis'],
            { group: 'Exudate' },
            ['Infection', 'Inflammation', 'Parapneumonic, empyema, tuberculosis, fungal, parasitic'],
            ['Malignancy', 'Pleural metastases, lymphatic block', 'Lung, breast, lymphoma, mesothelioma, ovary, stomach'],
            ['Vascular', 'Infarction', 'Pulmonary embolism'],
            ['Autoimmune', 'Serositis', 'Rheumatoid arthritis, SLE, post-cardiac injury (Dressler, post-CABG)'],
            ['Abdominal', 'Transdiaphragmatic', 'Pancreatitis, subphrenic abscess, esophageal rupture, Meigs syndrome'],
            ['Drugs', 'Hypersensitivity, serositis', 'Amiodarone, methotrexate, nitrofurantoin, dasatinib, bromocriptine'],
            ['Other', 'Lymph or blood', 'Chylothorax, hemothorax, uremia, asbestos-related benign effusion, trapped lung'],
          ] } },
        ],
      },
      {
        id: 'ix', title: 'Investigations and interpretation',
        blocks: [
          { sub: 'Imaging' },
          { ul: [
            'CXR: blunted costophrenic angle needs about 200 mL on PA, about 50 mL on lateral view; meniscus sign',
            'Ultrasound: more sensitive, shows septation or loculation, guides thoracentesis (reduces pneumothorax)',
            'CT with contrast: pleural thickening or nodularity (malignancy), split pleura sign (empyema), lung or mediastinal cause; CTPA if PE suspected',
          ] },
          { sub: 'Pleural fluid tests' },
          { table: { head: ['Test', 'Result', 'Suggests'], rows: [
            ['Appearance', 'Pus / milky / bloody / foul smell', 'Empyema / chylothorax or pseudochylothorax / hemothorax, malignancy, PE, trauma / anaerobes'],
            ['Cell count', 'Neutrophil predominant', 'Parapneumonic, PE, pancreatitis, early TB'],
            ['', 'Lymphocytes > 50%', 'TB, malignancy, lymphoma, post-CABG, chylothorax, RA, sarcoidosis'],
            ['', 'Eosinophils > 10%', 'Air or blood in pleura, drug, parasite, benign asbestos effusion, EGPA'],
            ['pH', '< 7.2', 'Complicated parapneumonic, empyema, esophageal rupture, RA, TB, malignancy'],
            ['Glucose', '< 60 mg/dL (< 30 in RA)', 'Empyema, RA, TB, malignancy, lupus, esophageal rupture'],
            ['ADA', '> 40 U/L (> 70 highly suggestive)', 'TB (with lymphocytic exudate); also empyema, lymphoma, RA'],
            ['Cytology', 'Malignant cells', 'Malignant effusion; sensitivity about 60%, repeat once'],
            ['Triglyceride / cholesterol', 'TG > 110 mg/dL / cholesterol > 200 with TG < 50', 'Chylothorax / pseudochylothorax'],
            ['Hematocrit', 'Pleural / blood > 0.5', 'Hemothorax'],
            ['Amylase', 'Raised', 'Pancreatitis, esophageal rupture (salivary), malignancy'],
            ['Gram stain, culture, AFB, GeneXpert', 'Positive', 'Bacterial infection, TB (pleural fluid culture positive in < 30% of TB)'],
          ] } },
          { note: 'Pleural biopsy (closed or thoracoscopic) has the highest yield for TB (granuloma, culture) and malignancy when fluid tests are negative.' },
        ],
      },
      {
        id: 'mx', title: 'Management by cause',
        blocks: [
          { table: { head: ['Cause', 'Treatment'], rows: [
            ['Heart failure', 'Loop diuretic (furosemide 40-80 mg IV, titrate); therapeutic tap if symptomatic'],
            ['Hepatic hydrothorax', 'Salt restriction, spironolactone + furosemide; repeat taps; TIPS or transplant if refractory; avoid chest drain'],
            ['Simple parapneumonic', 'Antibiotics for pneumonia; re-image and re-tap if fever or effusion persists'],
            ['Complicated parapneumonic / empyema', 'Small-bore chest drain (12-14 F) + antibiotics: community - amoxicillin-clavulanate, or 3rd-generation cephalosporin + metronidazole; hospital - piperacillin-tazobactam or carbapenem; usually 2-6 weeks. Poor drainage: intrapleural tPA 10 mg + DNase 5 mg twice daily for 3 days; VATS if failure'],
            ['Tuberculous pleuritis', 'Standard anti-TB regimen 2HRZE / 4HR; therapeutic tap for large effusion; steroid not routinely needed'],
            ['Malignant effusion', 'Therapeutic thoracentesis for symptoms; recurrent: indwelling pleural catheter or talc pleurodesis if lung re-expands; trapped lung - indwelling catheter'],
            ['Chylothorax', 'Drain, low-fat diet with medium-chain triglycerides or nil by mouth with TPN, octreotide; treat lymphoma; thoracic duct ligation or embolization if high output'],
            ['Hemothorax', 'Large-bore chest drain; surgery if > 1500 mL initially or > 200 mL/h for 2-4 h'],
            ['Pulmonary embolism', 'Anticoagulation (bloody effusion is not a contraindication)'],
          ] } },
        ],
      },
      {
        id: 'cx', title: 'Complications and follow-up',
        blocks: [
          { sub: 'Thoracentesis complications' },
          { ul: [
            'Pneumothorax (lower with ultrasound guidance), bleeding, infection, vasovagal reaction',
            'Re-expansion pulmonary edema: remove no more than 1-1.5 L at a time unless pleural pressure is monitored; stop if chest discomfort or cough',
          ] },
          { sub: 'Disease complications' },
          { ul: [
            'Empyema: fibrothorax, trapped lung, bronchopleural fistula, sepsis',
            'TB: residual pleural thickening (reduce with complete drainage)',
            'Malignant: rapid recurrence, trapped lung',
          ] },
          { sub: 'Follow-up' },
          { ul: [
            'CXR or ultrasound after treatment; parapneumonic at 2-6 weeks',
            'Undiagnosed exudate: follow for 6-12 months, repeat biopsy if it persists (malignancy can present late)',
          ] },
        ],
      },
    ],
  };

  function render(el) {
    Topic.render(el, TOPIC);
    const form = el.querySelector('#peForm');
    Object.entries(EXAMPLE).forEach(([id, val]) => { el.querySelector('#' + id).value = val; });
    const update = () => {
      const v = {};
      FIELDS.forEach(([id]) => { const raw = el.querySelector('#' + id).value; v[id] = raw === '' ? null : Number(raw); });
      v.look = el.querySelector('#look').value;
      v.gram = el.querySelector('#gram').checked;
      v.cyto = el.querySelector('#cyto').checked;
      const res = analyze(v);
      const top = res.key ? ['', 'Top 5 differential diagnoses:', ...DDX[res.key].map((d, i) => `  ${i + 1}. ${d}`)] : [];
      el.querySelector('#peOut pre').textContent = [res.summary, '', ...res.lines, ...top].join('\n');
      Tree.highlight(el.querySelector('#peTree'), res.path);
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', e => e.preventDefault());
    update();
  }

  const api = { render, analyze, TOPIC };
  if (typeof window !== 'undefined') window.Pleural = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
