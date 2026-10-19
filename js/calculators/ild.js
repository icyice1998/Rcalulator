// Interstitial lung disease topic: classification, approach, risk-specific causes, management
(function () {
  const Topic = typeof window !== 'undefined' && window.Topic ? window.Topic : require('../topic.js');

  const CLASS_TREE = {
    id: 'ild', text: 'Interstitial lung disease', note: '> 200 diffuse parenchymal lung diseases',
    children: [
      {
        id: 'iip', edge: 'No cause found', text: 'Idiopathic interstitial pneumonia',
        children: [
          { id: 'ch', edge: 'Chronic fibrosing', text: 'IPF, idiopathic NSIP' },
          { id: 'ac', edge: 'Acute / subacute', text: 'COP, AIP' },
          { id: 'sm', edge: 'Smoking-related', text: 'RB-ILD, DIP' },
          { id: 'ra', edge: 'Rare', text: 'Idiopathic LIP, PPFE' },
        ],
      },
      {
        id: 'known', edge: 'Known cause', text: 'ILD with known etiology',
        children: [
          { id: 'ctd', text: 'Connective tissue disease', note: 'RA, SSc, myositis, Sjogren, SLE, MCTD, IPAF' },
          { id: 'exp', text: 'Inhalational exposure', note: 'Hypersensitivity pneumonitis; silicosis, asbestosis' },
          { id: 'drug', text: 'Drug or radiation', note: 'Amiodarone, methotrexate, nitrofurantoin, bleomycin, ICI' },
          { id: 'gran', text: 'Granulomatous', note: 'Sarcoidosis' },
          { id: 'oth', text: 'Other', note: 'LAM, PLCH, BHD; PAP; DAH' },
        ],
      },
    ],
  };

  const APPROACH_TREE = {
    id: 'susp', text: 'Suspected ILD', note: 'Dyspnea, dry cough, Velcro crackles, restrictive PFT, low DLCO',
    children: [{
      id: 'eval', text: 'History, examination, CXR, laboratory', note: 'Tempo, smoking, exposures, drugs, CTD features, serology',
      children: [{
        id: 'hrct', text: 'HRCT + multidisciplinary discussion',
        children: [
          { id: 'conf', edge: 'Confident', text: 'Specific ILD diagnosis', note: 'e.g. UIP + no cause = IPF' },
          {
            id: 'indet', edge: 'Indeterminate', text: 'Is bronchoscopy likely to help?',
            children: [
              {
                id: 'bronch', edge: 'Yes', text: 'Bronchoscopy',
                children: [
                  { id: 'bal', text: 'Bronchoalveolar lavage', note: 'HP, sarcoidosis, infection, EP, DAH, PAP' },
                  { id: 'tblb', text: 'Transbronchial biopsy', note: 'Sarcoidosis, OP, cancer, infection' },
                ],
              },
              {
                id: 'bx', edge: 'No', text: 'Lung tissue',
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

  const TOPIC = {
    title: 'Interstitial lung disease',
    subtitle: 'Chest',
    lead: 'Inflammation or fibrosis of the interstitium that impairs gas exchange. More than 200 diseases; the clinical task is to find the cause or risk group, because treatment depends on it.',
    sections: [
      {
        id: 'class', title: 'Classification',
        blocks: [{ tree: CLASS_TREE }],
      },
      {
        id: 'risk', title: 'Risk-specific causes',
        blocks: [
          { p: 'Work through each risk group in the history. The last two columns show what confirms the cause and how it changes management.' },
          { table: { head: ['Risk group', 'Who is at risk / clues', 'HRCT and tests', 'Management'], rows: [
            { group: 'Idiopathic' },
            ['Idiopathic pulmonary fibrosis', 'Age > 60, men, ex-smoker, family history, GERD; insidious dyspnea over years, Velcro crackles, clubbing',
              'UIP: basal subpleural reticulation, honeycombing, traction bronchiectasis. UIP or probable UIP with no known cause = IPF without biopsy',
              'Antifibrotic: nintedanib 150 mg twice daily (diarrhea, liver enzymes) or pirfenidone 801 mg three times daily (photosensitivity, nausea); O2, rehabilitation, vaccination, transplant referral; no steroid'],
            ['Idiopathic NSIP', 'Middle-aged, often women, non-smoker; must exclude CTD and drug',
              'Basal GGO and reticulation with subpleural sparing', 'Corticosteroid with MMF or azathioprine; better prognosis than IPF'],
            ['Cryptogenic organizing pneumonia', 'Flu-like illness then cough and dyspnea for weeks; fails to respond to antibiotics',
              'Patchy peripheral or peribronchovascular consolidation, reverse halo', 'Prednisolone 0.5-1 mg/kg, taper over 6-12 months; relapse common'],
            { group: 'Connective tissue disease' },
            ['Systemic sclerosis', 'Raynaud, skin thickening, digital ulcers; diffuse cutaneous form', 'Anti-Scl-70; NSIP > UIP; esophageal dilatation',
              'MMF first line; cyclophosphamide, rituximab, tocilizumab; nintedanib if progressive; avoid high-dose steroid (renal crisis)'],
            ['Rheumatoid arthritis', 'Men, smokers, high RF / anti-CCP titre', 'UIP most common (worse prognosis), NSIP',
              'Control RA; MMF, rituximab; nintedanib if progressive fibrosis; review methotrexate'],
            ['Inflammatory myopathy / antisynthetase', 'Mechanic\'s hands, Raynaud, arthritis, myositis, fever', 'Jo-1, PL-7, PL-12, EJ, OJ; NSIP or OP; CK',
              'Steroid + MMF, azathioprine or tacrolimus; rituximab or cyclophosphamide if severe'],
            ['Anti-MDA5 dermatomyositis', 'Skin ulcers, palmar papules, little muscle weakness', 'Rapidly progressive ILD, high ferritin',
              'Urgent triple therapy: high-dose steroid + calcineurin inhibitor + cyclophosphamide'],
            ['Sjogren, SLE, MCTD', 'Sicca, rash, serositis, Raynaud', 'Ro/SSA, La/SSB, ANA, RNP; LIP or NSIP (Sjogren), cysts in LIP', 'Treat underlying disease; steroid, MMF'],
            ['IPAF', 'Autoimmune features that do not meet a CTD definition', 'One feature each from clinical, serologic, morphologic domains', 'Treat as CTD-ILD; follow for evolving CTD'],
            { group: 'Inhalational exposure' },
            ['Hypersensitivity pneumonitis', 'Birds or feathers (pillows, duvets), visible mold, farm, hot tubs; symptoms better away from source',
              'Centrilobular nodules, GGO, mosaic attenuation with air trapping (three-density sign); fibrotic HP may look like UIP; BAL lymphocytes > 30-50%',
              'Antigen identification and avoidance (key); prednisolone for non-fibrotic; MMF; nintedanib if progressive fibrosis'],
            ['Silicosis', 'Sandblasting, stone cutting, construction, tunnelling, mining; years of exposure',
              'Upper zone centrilobular and perilymphatic nodules, eggshell calcified nodes, progressive massive fibrosis',
              'Stop exposure; no specific therapy; screen for TB (high risk), lung cancer; notify occupational health'],
            ['Asbestosis', 'Shipyard, insulation, brake and construction work; latency 20-30 years',
              'Lower zone UIP-like fibrosis with pleural plaques', 'Stop exposure, smoking cessation; watch for mesothelioma and lung cancer'],
            { group: 'Drug and radiation' },
            ['Drug-induced ILD', 'Amiodarone (high attenuation liver and lung), methotrexate, nitrofurantoin, bleomycin, immune checkpoint inhibitors, other chemotherapy',
              'Any pattern (NSIP, OP, HP-like, DAD); exclude infection', 'Stop the drug; prednisolone if moderate or severe; ICI pneumonitis graded and treated by grade'],
            ['Radiation pneumonitis', '4-12 weeks after chest radiotherapy', 'Opacity matching the radiation field with straight edges', 'Prednisolone 0.5-1 mg/kg with slow taper; later fibrosis'],
            { group: 'Smoking-related' },
            ['RB-ILD, DIP', 'Current heavy smokers', 'Centrilobular nodules, GGO; DIP diffuse basal GGO', 'Smoking cessation; steroid in DIP'],
            ['Pulmonary Langerhans cell histiocytosis', 'Young adult smokers; pneumothorax', 'Upper zone nodules and bizarre cysts sparing costophrenic angles', 'Smoking cessation'],
            { group: 'Granulomatous' },
            ['Sarcoidosis', 'Age 20-50, uveitis, erythema nodosum, lymphadenopathy, hypercalcemia', 'Bilateral hilar nodes, perilymphatic nodules, upper zone; BAL CD4/CD8 > 4; non-caseating granuloma',
              'Observe if asymptomatic; prednisolone 20-40 mg if symptomatic or organ-threatening; methotrexate as steroid-sparing'],
            { group: 'Cystic and other' },
            ['Lymphangioleiomyomatosis', 'Women of childbearing age, tuberous sclerosis; pneumothorax, chylous effusion', 'Diffuse thin-walled round cysts; serum VEGF-D > 800 pg/mL', 'Sirolimus if declining lung function'],
            ['Birt-Hogg-Dube', 'Family history, skin fibrofolliculomas, renal tumours', 'Basal paramediastinal cysts', 'Screen for renal cancer'],
            ['Pulmonary alveolar proteinosis', 'Dyspnea out of proportion to signs', 'Crazy paving; milky PAS-positive BAL; anti-GM-CSF antibody', 'Whole-lung lavage; inhaled GM-CSF'],
            ['Diffuse alveolar hemorrhage', 'Hemoptysis (may be absent), falling hemoglobin', 'Diffuse GGO; BAL increasingly bloody', 'Treat vasculitis or cause: pulse steroid, cyclophosphamide or rituximab, plasma exchange'],
          ] } },
        ],
      },
      {
        id: 'approach', title: 'Clinical approach',
        blocks: [
          { tree: APPROACH_TREE },
          { sub: 'History: tempo of illness' },
          { table: { head: ['Tempo', 'Consider'], rows: [
            ['Acute (< 2 weeks)', 'AIP, acute eosinophilic pneumonia, COP, acute HP, rapidly progressive anti-MDA5 ILD, exclude infection and heart failure'],
            ['Subacute (2 weeks - months)', 'CTD-ILD, COP, drug-induced ILD, subacute HP'],
            ['Chronic (months - years)', 'IPF, idiopathic NSIP, chronic HP, pneumoconiosis, CTD-ILD'],
          ] } },
          { sub: 'Examination' },
          { ul: [
            'Velcro crackles at the bases: fibrotic ILD',
            'Clubbing: IPF, asbestosis, chronic HP (uncommon in sarcoidosis and CTD)',
            'CTD signs: Raynaud, mechanic\'s hands, Gottron papules, heliotrope rash, sclerodactyly, synovitis, sicca',
          ] },
        ],
      },
      {
        id: 'ix', title: 'Investigations and interpretation',
        blocks: [
          { sub: 'Chest X-ray clues' },
          { table: { head: ['Finding', 'Suggests'], rows: [
            ['Low lung volume', 'Fibrotic ILD: IPF, NSIP, CTD-ILD, asbestosis, chronic drug'],
            ['Preserved or high volume', 'LAM, PLCH, respiratory bronchiolitis, bronchiolitis obliterans, coexisting COPD'],
            ['Upper zone', 'Sarcoidosis, silicosis, PLCH, ankylosing spondylitis'],
            ['Lower zone', 'IPF, NSIP, CTD-ILD, asbestosis'],
            ['Peripheral', 'Organizing pneumonia, chronic eosinophilic pneumonia, CTD-ILD'],
            ['Pleural plaque / effusion', 'Asbestosis / CTD (SLE, RA), LAM (chylous)'],
            ['Hilar or mediastinal nodes', 'Sarcoidosis, berylliosis, lymphoma or cancer'],
            ['Pneumothorax', 'Cystic lung disease'],
          ] } },
          { sub: 'HRCT patterns' },
          { table: { head: ['Feature', 'UIP', 'NSIP', 'Organizing pneumonia'], rows: [
            ['Ground glass', '+/-', '+++', '+ / crazy paving'],
            ['Consolidation', '-', '-', '+++ / reverse halo'],
            ['Reticulation', '++', '++', '+/-'],
            ['Traction bronchiectasis', '++', '+ (central)', '-'],
            ['Honeycombing', '+++', '+/-', '-'],
            ['Distribution', 'Basal, subpleural', 'Basal, subpleural sparing', 'Focal or multifocal, peribronchovascular'],
            ['Clinical diagnoses', 'IPF, RA or SSc, chronic HP, asbestosis, drug', 'CTD, drug, idiopathic NSIP', 'COP, infection, CTD'],
          ] } },
          { sub: 'Serology' },
          { table: { head: ['Antibody', 'Disease'], rows: [
            ['ANA', 'SLE 90-100%, SSc 97%, MCTD 100%, PM/DM 40-80%, RA 30-50%'],
            ['RF, anti-CCP', 'Rheumatoid arthritis'],
            ['Scl-70', 'Systemic sclerosis'],
            ['RNP', 'Mixed connective tissue disease'],
            ['Ro/SSA, La/SSB', 'Sjogren syndrome'],
            ['Jo-1, PL-7, PL-12, EJ, OJ', 'Antisynthetase syndrome with ILD'],
            ['MDA-5, Ro-52', 'Aggressive, rapidly progressive ILD'],
            ['PM-Scl', 'Polymyositis-scleroderma overlap'],
          ] } },
          { sub: 'Bronchoalveolar lavage' },
          { table: { head: ['Finding', 'Normal', 'Abnormal suggests'], rows: [
            ['Neutrophils', '< 3%', '> 3%: infection, aspiration, IPF, CTD, asbestosis, DAD; > 50%: acute lung injury, suppurative infection'],
            ['Lymphocytes', '10-15%', '> 15%: sarcoidosis, NSIP, HP, drug, CTD, radiation, COP; > 50%: HP or cellular NSIP'],
            ['CD4/CD8', '0.9-2.5', '> 4: sarcoidosis'],
            ['Eosinophils', '< 1%', '> 1%: drug, asthma, EGPA, ABPA; > 25%: eosinophilic pneumonia'],
            ['Bloody, rising on sequential aliquots', '', 'Diffuse alveolar hemorrhage'],
            ['Milky, PAS positive', '', 'Pulmonary alveolar proteinosis'],
          ] } },
          { sub: 'Pulmonary function' },
          { ul: [
            'Restrictive pattern (TLC < 80%) with low DLCO; FEV1/FVC normal or high',
            'Normal volumes with low DLCO: early ILD, emphysema with fibrosis (CPFE), pulmonary vascular disease',
            '6-minute walk test: desaturation and distance for severity and prognosis',
          ] },
        ],
      },
      {
        id: 'criteria', title: 'Diagnostic criteria',
        blocks: [
          { sub: 'IPF (ATS/ERS/JRS/ALAT)' },
          { ul: [
            'Exclude known causes: exposure, drug, CTD',
            'HRCT UIP or probable UIP in the right clinical setting = IPF without biopsy',
            'Indeterminate or alternative pattern: MDD, then BAL, cryobiopsy or surgical biopsy',
          ] },
          { sub: 'Progressive pulmonary fibrosis (any non-IPF fibrotic ILD)' },
          { p: 'At least 2 of 3 within the past year, with no other explanation:' },
          { ul: [
            'Worsening respiratory symptoms',
            'Physiological progression: absolute FVC decline >= 5% predicted or DLCO decline >= 10% predicted',
            'Radiological progression on HRCT',
          ] },
          { note: 'Progressive pulmonary fibrosis qualifies for antifibrotic therapy (nintedanib) in addition to treating the cause.' },
        ],
      },
      {
        id: 'mx', title: 'General management and follow-up',
        blocks: [
          { ul: [
            'Remove the cause: antigen avoidance, stop the drug, occupational change, smoking cessation',
            'Disease-specific therapy as in the risk table; antifibrotic for IPF and progressive pulmonary fibrosis',
            'Supportive: O2 if resting SpO2 <= 88% or exertional desaturation, pulmonary rehabilitation, influenza and pneumococcal vaccines, treat GERD and pulmonary hypertension',
            'Early transplant referral for progressive fibrotic ILD',
            'Follow-up every 3-6 months: symptoms, FVC and DLCO, 6-minute walk, HRCT if change; monitor drug toxicity (liver enzymes on antifibrotics, blood count on immunosuppressants)',
          ] },
          { sub: 'Complications' },
          { ul: [
            'Acute exacerbation of IPF: new bilateral GGO within 1 month, exclude infection and heart failure; high mortality',
            'Pulmonary hypertension, respiratory failure, lung cancer (IPF, asbestosis), TB (silicosis), pneumothorax (cystic disease)',
          ] },
        ],
      },
    ],
  };

  function render(el) { Topic.render(el, TOPIC); }

  const api = { render, TOPIC };
  if (typeof window !== 'undefined') window.ILD = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
