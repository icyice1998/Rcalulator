// Asthma topic: diagnosis, assessment, stepwise treatment, difficult-to-treat and severe asthma, exacerbation
(function () {
  const Topic = typeof window !== 'undefined' && window.Topic ? window.Topic : require('../topic.js');

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

  const DTT_TREE = {
    id: 'u', text: 'Uncontrolled on GINA step 4-5', note: 'Symptoms or exacerbations despite medium- or high-dose ICS-LABA',
    children: [{
      id: 'dx', text: 'Confirm the diagnosis', note: 'Variable airflow, BHR, airway inflammation (FeNO, BEC, sputum)',
      children: [
        { id: 'alt', edge: 'Not confirmed', text: 'Consider alternative diagnosis', note: 'VCD / ILO, COPD, bronchiectasis, HF' },
        {
          id: 'adh', edge: 'Confirmed', text: 'Check inhaler technique and adherence', note: 'History, dose counter, pharmacy refill',
          children: [
            { id: 'fix', edge: 'Poor', text: 'Educate, correct, review in 3-6 months' },
            {
              id: 'com', edge: 'Satisfactory', text: 'Treat comorbidities and risk factors',
              note: 'CRS / nasal polyps, obesity, GERD, OSA, ILO, anxiety-depression, smoking, allergen, EGPA, ABPA',
              children: [
                { id: 'ctl', edge: 'Controlled', text: 'Difficult-to-treat asthma', note: 'Step down slowly' },
                {
                  id: 'sev', edge: 'Still uncontrolled', text: 'Severe asthma', note: 'Refer; assess phenotype',
                  children: [
                    {
                      id: 't2', edge: 'BEC >= 150, FeNO >= 20, allergen-driven or OCS-dependent', text: 'Type 2 high',
                      note: 'Biologic by phenotype; add-on LAMA',
                    },
                    {
                      id: 'nont2', edge: 'No type 2 marker', text: 'Type 2 low',
                      note: 'Add-on LAMA, azithromycin, anti-TSLP; repeat biomarkers on lowest OCS',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }],
  };

  const EX_TREE = {
    id: 'ex', text: 'Asthma exacerbation', note: 'Assess ABC, triage by worst feature',
    children: [
      { id: 'lt', edge: 'Drowsy, confused, silent chest', text: 'Life-threatening', note: 'ICU, SABA, O2, prepare intubation' },
      { id: 'sv', edge: 'Words, RR > 30, HR > 120, SpO2 < 90, PEF <= 50%', text: 'Severe', note: 'SABA + ipratropium, O2, steroid, IV Mg' },
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

  const TOPIC = {
    title: 'Asthma',
    subtitle: 'Chest',
    lead: 'A heterogeneous disease with chronic airway inflammation, defined by variable respiratory symptoms (wheeze, dyspnea, chest tightness, cough) together with variable expiratory airflow limitation.',
    sections: [
      {
        id: 'patho', title: 'Pathophysiology',
        blocks: [
          { ul: [
            'Airway inflammation: mast cells, eosinophils, Th2 lymphocytes, IgE, leukotrienes; neutrophils in some phenotypes',
            'Airway hyperresponsiveness: exaggerated bronchoconstriction to triggers',
            'Remodeling from chronic injury-repair: smooth muscle hypertrophy, goblet cell metaplasia, collagen deposition, mucus hypersecretion; can lead to fixed obstruction',
            'Endotypes: type 2 high (allergic, eosinophilic; steroid responsive) and type 2 low (neutrophilic or paucigranulocytic; obesity, smoking)',
          ] },
        ],
      },
      {
        id: 'clinical', title: 'Clinical features',
        blocks: [
          { sub: 'Symptoms that support asthma' },
          { ul: [
            'More than one of wheeze, shortness of breath, chest tightness, cough',
            'Vary over time and in intensity; often worse at night or on waking',
            'Triggered by exercise, laughter, allergens, cold air; worsening after exercise ends is very distinctive',
            'Appear or worsen with viral infections',
          ] },
          { sub: 'Risk factors and triggers' },
          { table: { head: ['Endogenous', 'Environmental', 'Triggers'], rows: [
            ['Atopy, airway hyperresponsiveness', 'Indoor and outdoor allergens', 'House dust mite, animal dander, cockroach, pollen, fungi'],
            ['Genetics, sex, ethnicity', 'Occupational sensitizers', 'Drugs: aspirin, NSAIDs, beta-blockers, ACE inhibitors'],
            ['', 'Obesity, early viral infection, tobacco smoke', 'Exercise, cold air, emotion, irritants, pollution, infection'],
          ] } },
          { sub: 'Examination' },
          { ul: [
            'Chest: wheeze on normal breathing or prolonged expiration; often normal between episodes',
            'Upper airway: rhinitis, nasal polyps',
            'Skin: eczema, urticaria, atopic dermatitis',
          ] },
        ],
      },
      {
        id: 'diagnosis', title: 'Diagnostic criteria (GINA)',
        blocks: [
          { p: 'Diagnosis needs both a history of variable respiratory symptoms and confirmed variable expiratory airflow. Airflow limitation need not be present at the time of testing; test during symptoms or in the morning when possible, and before starting ICS.' },
          { table: { head: ['Test (adults)', 'Positive result'], rows: [
            ['Bronchodilator responsiveness', 'FEV1 or FVC increase >= 12% and >= 200 mL (more confident if >= 15% and >= 400 mL) 10-15 min after salbutamol 200-400 mcg; or PEF increase >= 20%'],
            ['PEF variability', 'Average daily diurnal variability > 10% over 2 weeks; variability = (max - min) / mean x 100'],
            ['Trial of ICS', 'FEV1 increase >= 12% and >= 200 mL (or PEF >= 20%) after 4 weeks of ICS-containing treatment'],
            ['Bronchial challenge', 'FEV1 fall >= 20% with methacholine; >= 15% with mannitol, hypertonic saline or hyperventilation; > 10% and > 200 mL with exercise'],
            ['Variation between visits', 'FEV1 change >= 12% and >= 200 mL (or PEF >= 20%); specific but not sensitive'],
          ] } },
          { note: 'Bronchial challenge contraindications (SMUK): severe airflow limitation (FEV1 < 50% or < 1 L), MI or stroke within 3 months, uncontrolled hypertension, known aortic aneurysm. A negative challenge may be false if tested out of season, long after occupational exposure, or on recent steroid.' },
          { sub: 'Levels of diagnostic certainty' },
          { tree: DX_TREE },
          { sub: 'Type 2 biomarkers' },
          { table: { head: ['Biomarker', 'High', 'Higher in', 'Lower in'], rows: [
            ['Blood eosinophils', '>= upper limit of normal; on high-dose ICS >= 150/uL suggests type 2, >= 300/uL common biologic threshold',
              'Men, morning, smokers, parasites, allergy, EGPA', 'OCS, inhaled or nasal steroid'],
            ['FeNO', 'ICS-naive > 50 ppb; medium-dose ICS >= 25 ppb; high-dose ICS >= 20 ppb',
              'Men, afternoon, atopic dermatitis, allergic rhinitis, after allergen', 'Smokers, bronchoconstriction, ICS or OCS'],
          ] } },
          { note: 'Raised FeNO or eosinophils support type 2 asthma in a patient with typical symptoms; low values do not exclude asthma.' },
        ],
      },
      {
        id: 'ddx', title: 'Differential diagnosis',
        blocks: [
          { table: { head: ['Group', 'Conditions'], rows: [
            ['Upper airway', 'Foreign body, postnasal drip, upper airway obstruction, vocal cord dysfunction (inducible laryngeal obstruction), tracheobronchomalacia'],
            ['Pulmonary', 'COPD, bronchiectasis, ABPA, EGPA, cystic fibrosis, ILD, lung cancer, pneumonia, pneumothorax, sarcoidosis'],
            ['Cardiac', 'Left ventricular failure, mitral valve disease, angina'],
            ['Other', 'GERD, obesity, anemia, hyperventilation, carcinoid, mastocytosis, functional'],
          ] } },
          { sub: 'Asthma vs COPD' },
          { table: { head: ['Feature', 'Asthma', 'COPD'], rows: [
            ['Onset', 'Childhood or early adulthood', 'Usually > 40 years, smoking, biomass, post-TB'],
            ['Reversibility', 'Largely reversible', 'Partially reversible, progressive'],
            ['Inflammation', 'Type 2 eosinophilic', 'Neutrophilic'],
            ['Associations', 'Allergy, eczema, rhinitis', 'Chronic bronchitis, emphysema'],
            ['Lung function', 'May be normal between episodes', 'Persistently obstructive, declines'],
            ['Symptoms', 'Variable, night or early morning', 'Persistent, exertional'],
            ['ICS response', 'Good', 'Inconsistent'],
          ] } },
        ],
      },
      {
        id: 'assess', title: 'Assessment of control and risk',
        blocks: [
          { table: { head: ['In the past 4 weeks', 'Well controlled', 'Partly controlled', 'Uncontrolled'], rows: [
            ['Daytime symptoms > 2/week; any night waking; reliever > 2/week; any activity limitation', 'None of these', '1-2 of these', '3-4 of these'],
          ] } },
          { sub: 'Risk factors for exacerbation (any one increases risk)' },
          { ul: [
            'High SABA use (>= 3 canisters/year; mortality rises with > 1 canister/month); no ICS; poor adherence or technique',
            '>= 1 severe exacerbation in the last year; ever intubated or ICU for asthma',
            'FEV1 < 60% predicted, high bronchodilator responsiveness, raised eosinophils or FeNO',
            'Obesity, chronic rhinosinusitis, GERD, food allergy, pregnancy; smoking, e-cigarettes, allergen or pollution exposure',
            'Major psychological or socioeconomic problems',
          ] },
          { note: 'Persistent airflow limitation risk: no ICS after severe exacerbation, smoke or occupational exposure, low initial FEV1, sputum or blood eosinophilia. Medication side-effect risk: frequent OCS, high-dose or potent ICS, P450 inhibitors.' },
        ],
      },
      {
        id: 'treat', title: 'Stepwise treatment (GINA, adults and adolescents)',
        blocks: [
          { table: { head: ['Step', 'Track 1 (preferred): reliever ICS-formoterol', 'Track 2 (alternative): reliever SABA or ICS-SABA'], rows: [
            ['1', 'As-needed low-dose ICS-formoterol (AIR-only)', 'Take ICS whenever SABA is taken'],
            ['2', 'As-needed low-dose ICS-formoterol (AIR-only)', 'Low-dose maintenance ICS'],
            ['3', 'Low-dose ICS-formoterol maintenance and reliever (MART)', 'Low-dose ICS-LABA'],
            ['4', 'Medium-dose ICS-formoterol MART', 'Medium-dose ICS-LABA'],
            ['5', 'Add-on LAMA; refer for phenotype; consider high-dose ICS-formoterol; biologic', 'Add-on LAMA; refer; high-dose ICS-LABA; biologic'],
          ] } },
          { sub: 'Starting treatment' },
          { table: { head: ['Presentation', 'Start at'], rows: [
            ['Symptoms < 3-5 days/week, normal or mildly reduced lung function', 'Step 1-2'],
            ['Symptoms most days, or night waking >= 1/week, or low lung function', 'Step 3'],
            ['Daily symptoms or night waking >= 1/week with low lung function or recent exacerbation', 'Step 4 (short OCS course may be needed)'],
          ] } },
          { p: 'Avoid SABA-only treatment: apparently mild asthma still accounts for 30-37% of acute asthma and 15-27% of asthma deaths. Review 1-3 months after any change; before stepping up, check inhaler technique, adherence, comorbidities and triggers. Step down after 3 months of good control.' },
          { sub: 'ICS daily dose (mcg)' },
          { table: { head: ['Inhaled corticosteroid', 'Low', 'Medium', 'High'], rows: [
            ['Beclometasone dipropionate (HFA)', '100-200', '> 200-400', '> 400'],
            ['Budesonide (DPI)', '200-400', '> 400-800', '> 800'],
            ['Ciclesonide (HFA)', '80-160', '> 160-320', '> 320'],
            ['Fluticasone furoate (DPI)', '100', '-', '200'],
            ['Fluticasone propionate (DPI or HFA)', '100-250', '> 250-500', '> 500'],
            ['Mometasone furoate', '110-220', '> 220-440', '> 440'],
          ] } },
          { sub: 'Bronchodilators' },
          { table: { head: ['Drug', 'Onset', 'Duration', 'Usual dose'], rows: [
            ['Salbutamol (SABA)', '< 5 min', '3-6 h', '100-200 mcg as needed'],
            ['Formoterol (LABA)', '~7 min', '12 h', '12-24 mcg twice daily; reliever with budesonide in MART'],
            ['Salmeterol (LABA)', '~15 min', '12 h', '50 mcg twice daily'],
            ['Vilanterol, indacaterol', '~5 min', '24 h', 'Once daily (with ICS)'],
            ['Tiotropium (LAMA)', 'Slow', '24 h', 'Add-on at step 5 (soft mist 2.5 mcg x 2 puffs daily)'],
          ] } },
          { note: 'Side effects: ICS - dysphonia, oral candidiasis (rinse mouth), skin bruising, cataract and osteoporosis at high dose; beta-agonist - tremor, tachycardia, hypokalemia; LAMA - dry mouth, urinary retention.' },
        ],
      },
      {
        id: 'dtt', title: 'Difficult-to-treat and severe asthma',
        blocks: [
          { table: { head: ['Term', 'Definition'], rows: [
            ['Uncontrolled asthma', 'Poor symptom control and/or frequent exacerbations; may be mild asthma that is not being treated properly'],
            ['Difficult-to-treat asthma', 'Uncontrolled despite medium- or high-dose ICS-LABA (or maintenance OCS), or needs high-dose treatment to stay controlled. Often due to wrong diagnosis, poor technique or adherence, comorbidities, SABA overuse'],
            ['Severe asthma', 'Uncontrolled despite adherence to maximal optimized high-dose ICS-LABA and treatment of contributory factors, or worsens when high-dose treatment is reduced. A retrospective label'],
          ] } },
          { note: 'Severity by treatment needed once controlled for several months: mild = step 1-2, moderate = step 3, severe = step 4-5 still needed or still uncontrolled.' },
          { sub: 'Approach' },
          { tree: DTT_TREE },
          { sub: 'Contributory factors to correct before labelling severe' },
          { table: { head: ['Factor', 'What to do'], rows: [
            ['Incorrect diagnosis', 'Repeat spirometry with BDR, PEF monitoring, challenge; look for VCD/ILO, COPD, bronchiectasis, HF'],
            ['Inhaler technique', 'Watch the patient use the device; switch device if needed'],
            ['Adherence', 'Ask non-judgmentally, check dose counter and refills; simplify regimen (MART)'],
            ['Comorbidities', 'Chronic rhinosinusitis and nasal polyps, obesity, GERD, OSA, anxiety and depression, ILO, ABPA, EGPA'],
            ['Exposures', 'Smoking, vaping, allergens, occupational agents; NSAID, beta-blocker'],
            ['SABA overuse', 'Switch to ICS-formoterol reliever'],
          ] } },
          { sub: 'Biologics for severe type 2 asthma' },
          { table: { head: ['Target', 'Drug and dose', 'Choose when', 'Watch for'], rows: [
            ['Anti-IgE', 'Omalizumab SC every 2-4 weeks, dose by IgE and weight', 'Allergic: sensitized to perennial allergen, total IgE in dosing range, exacerbations', 'Anaphylaxis (rare), injection site'],
            ['Anti-IL5 / IL5R', 'Mepolizumab 100 mg SC every 4 weeks; benralizumab 30 mg SC every 4 weeks x 3 then every 8 weeks', 'Eosinophilic: BEC >= 150-300/uL, exacerbations, OCS-dependent, nasal polyps', 'Headache, injection site; check helminths'],
            ['Anti-IL4R alpha', 'Dupilumab 400-600 mg SC load, then 200-300 mg every 2 weeks', 'BEC >= 150 or FeNO >= 25 ppb, OCS-dependent, atopic dermatitis, polyps', 'Transient eosinophilia, conjunctivitis'],
            ['Anti-TSLP', 'Tezepelumab 210 mg SC every 4 weeks', 'Severe asthma regardless of type 2 markers', 'Pharyngitis, injection site'],
          ] } },
          { p: 'Review response after about 4 months. Complete response: continue, taper OCS then ICS (watch for adrenal insufficiency), follow every 3-6 months. Partial response: continue 6-9 more months or switch biologic. No response: stop, re-check contributory factors, switch to another biologic.' },
          { note: 'Type 2 low options: add-on LAMA, azithromycin 250-500 mg three times weekly (check QTc and sputum for NTM), anti-TSLP, treat obesity; bronchial thermoplasty only in selected centres.' },
          { sub: 'Special groups' },
          { table: { head: ['Group', 'Key points'], rows: [
            ['Obesity', 'Lower lung function, more comorbidity (GERD, OSA, depression), weaker ICS response; weight loss improves control'],
            ['ABPA', 'Central bronchiectasis, fleeting infiltrates, finger-in-glove, high total IgE and Aspergillus-specific IgE; treat with OCS and/or itraconazole'],
            ['Exercise-induced', 'Bronchoconstriction peaks 10-15 min after starting exercise, resolves by 60 min; SABA or ICS-formoterol 10 min before exercise; daily ICS if frequent'],
            ['Work-related', 'Better on weekends and holidays; serial PEF at and away from work; remove exposure'],
            ['Pregnancy', 'One third improve, one third worsen, one third unchanged; continue ICS; uncontrolled asthma is riskier than treatment'],
          ] } },
        ],
      },
      {
        id: 'exac', title: 'Exacerbation',
        blocks: [
          { p: 'A progressive increase in shortness of breath, cough, wheeze or chest tightness with a fall in lung function from the patient\'s usual status. Common triggers: viral infection, allergen, pollution, poor ICS adherence.' },
          { tree: EX_TREE },
          { table: { head: ['Severity', 'Features (worst feature decides)', 'Treatment'], rows: [
            ['Mild to moderate', 'Talks in phrases, prefers sitting, not agitated, RR raised, HR 100-120, SpO2 90-95%, PEF > 50%',
              'Salbutamol 4-10 puffs by pMDI and spacer every 20 min for 1 h; consider ipratropium; O2 to SpO2 93-95%; prednisolone 40-50 mg'],
            ['Severe', 'Talks in words, hunched, agitated, RR > 30, accessory muscles, HR > 120, SpO2 < 90%, PEF <= 50%',
              'SABA + ipratropium, O2 93-95%, oral or IV corticosteroid, consider IV magnesium sulfate 2 g over 20 min, consider high-dose ICS'],
            ['Life-threatening', 'Drowsy, confused, silent chest', 'ICU, SABA and O2, prepare for intubation'],
          ] } },
          { sub: 'Risk factors for asthma-related death' },
          { ul: [
            'Previous intubation or ICU; >= 2 admissions or >= 3 ED visits in the past year; admission or ED visit in the past month',
            'Using > 2 SABA canisters per month; poor perception of severity; no written action plan',
            'Low socioeconomic status, illicit drugs, psychosocial problems; cardiovascular, chronic lung or psychiatric disease',
          ] },
          { sub: 'Discharge' },
          { ul: [
            'Good response: no tachypnea, minimal wheeze, able to speak, PEF > 80% (60-80% may be discharged with close follow-up), SpO2 > 94% on room air',
            'Prednisolone 40-50 mg/day for 5-7 days',
            'Start ICS if not already on it; step up ICS for 2-4 weeks; move reliever back to as-needed',
            'Review triggers and inhaler technique, give a written action plan; follow up within 2-7 days',
          ] },
        ],
      },
      {
        id: 'fu', title: 'Complications and follow-up',
        blocks: [
          { ul: [
            'Complications: fixed airflow obstruction from remodeling, pneumothorax and pneumomediastinum during attacks, respiratory failure, OCS toxicity (diabetes, osteoporosis, cataract, adrenal suppression)',
            'Follow-up: 1-3 months after starting or changing treatment, then every 3-12 months; within 1 week after an exacerbation',
            'Each visit: symptom control, exacerbations, inhaler technique, adherence, side effects, lung function every 1-2 years (more often if unstable), action plan',
          ] },
        ],
      },
    ],
  };

  function render(el) { Topic.render(el, TOPIC); }

  const api = { render, TOPIC };
  if (typeof window !== 'undefined') window.Asthma = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
