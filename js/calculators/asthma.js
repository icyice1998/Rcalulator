// Asthma topic following the Thai Asthma Guideline in Adults 2025 (TAC)
(function () {
  const Topic = typeof window !== 'undefined' && window.Topic ? window.Topic : require('../topic.js');

  const DX_TREE = {
    id: 'ad', text: 'Suspected asthma', note: 'Key: cough, wheeze, dyspnea, chest tightness',
    children: [{
      id: 'sym', text: 'Supportive features?', note: 'Night or early morning; triggered by allergen, cold air, exercise or viral infection; variable over time',
      children: [{
        id: 'lf', edge: 'Yes', text: 'Confirm with lung function', note: 'Serial PEFR or spirometry with BDR',
        children: [
          { id: 'conf', edge: 'PEFR variability >= 10% or BDR positive', text: 'Asthma confirmed' },
          {
            id: 'chal', edge: 'Not confirmed', text: 'Airway responsiveness test',
            children: [
              { id: 'pos', edge: 'Methacholine FEV1 fall >= 20% or exercise >= 10%', text: 'Asthma confirmed' },
              { id: 'neg', edge: 'Negative', text: 'Look for alternative diagnosis' },
            ],
          },
        ],
      }],
    }],
  };

  const ADJUST_TREE = {
    id: 'rev', text: 'Assess control and risk', note: 'Assess - Adjust - Review cycle',
    children: [
      {
        id: 'ok', edge: 'Controlled >= 12 months', text: 'Major exacerbation risk factor?',
        children: [
          { id: 'keep', edge: 'Yes', text: 'Keep treatment 12 more months' },
          {
            id: 'down', edge: 'No', text: 'Step down',
            children: [{ id: 'cr', edge: 'Controlled, no exacerbation, normal FEV1 >= 1 year', text: 'Clinical remission',
              children: [{ id: 'comp', edge: 'Normal FeNO and methacholine', text: 'Complete remission' }] }],
          },
        ],
      },
      { id: 'up', edge: 'Not controlled within 1-3 months', text: 'Step up', note: 'After checking technique, adherence, triggers, comorbidities' },
    ],
  };

  const ED_TREE = {
    id: 'ed', text: 'Acute asthma in ED', note: 'Assess airway, breathing, circulation',
    children: [
      { id: 'icu', edge: 'Drowsy, confused, air hunger or cyanosis', text: 'ICU admission', note: 'Consider intubation; treat as severe' },
      {
        id: 'grade', edge: 'None of these', text: 'Grade severity',
        children: [
          { id: 'mm', edge: 'Not agitated, PR 100-120, SpO2 90-95%', text: 'Mild to moderate', note: 'RABA + SCS + O2' },
          { id: 'sv', edge: 'Agitated, RR > 30, accessory muscles, PR > 120, SpO2 < 90%', text: 'Severe', note: 'RABA + ipratropium + SCS + O2, IV MgSO4' },
          {
            id: 'resp', edge: 'Reassess at 1 h', text: 'Symptoms and signs',
            children: [
              { id: 'home', edge: 'Improved, stable', text: 'Discharge', note: 'Controller + prednisolone 30-50 mg <= 5 days + RABA' },
              { id: 'adm', edge: 'Not improved', text: 'Admit', note: 'Continue treatment, close monitoring' },
            ],
          },
        ],
      },
    ],
  };

  const DTT_TREE = {
    id: 'u', text: 'Uncontrolled on step 4', note: 'Medium-high dose ICS/LABA plus other controllers = difficult-to-treat',
    children: [{
      id: 'chk', text: 'Review and correct', note: 'Confirm diagnosis; adherence; inhaler technique; avoid triggers; diagnose and treat comorbidities',
      children: [
        { id: 'ctl', edge: 'Controlled', text: 'Difficult-to-treat asthma', note: 'Not severe; step down slowly' },
        {
          id: 'sev', edge: 'Still uncontrolled', text: 'Severe asthma', note: 'Consult or refer specialist',
          children: [
            { id: 't2', edge: 'BEC >= 150, SPT or sIgE positive, FeNO >= 20 or sputum eos >= 2%', text: 'Type 2 high', note: 'Add-on biologic' },
            { id: 'nt2', edge: 'None of these', text: 'Non-type 2', note: 'LAMA, low-dose macrolide, thermoplasty, anti-TSLP' },
          ],
        },
      ],
    }],
  };

  const BIO_TREE = {
    id: 'b', text: 'Severe asthma despite medium-high ICS/LABA + other controllers', note: 'Check BEC, FeNO; atopic dermatitis, CRSwNP, AR, eosinophilic pneumonia, EGPA',
    children: [
      {
        id: 'e1', edge: 'BEC < 150', text: 'FeNO',
        children: [
          {
            id: 'f1', edge: '< 25 ppb', text: 'Allergic with perennial allergy?',
            children: [
              { id: 'f1y', edge: 'Yes', text: 'Anti-IgE or anti-TSLP' },
              { id: 'f1n', edge: 'No', text: 'Anti-TSLP' },
            ],
          },
          {
            id: 'f2', edge: '>= 25 ppb', text: 'Allergic with perennial allergy?',
            children: [
              { id: 'f2y', edge: 'Yes', text: 'Anti-IgE, anti-IL4R alpha or anti-TSLP' },
              { id: 'f2n', edge: 'No', text: 'Anti-IL4R alpha or anti-TSLP' },
            ],
          },
        ],
      },
      { id: 'e2', edge: 'BEC 150-1500', text: 'Integrate clinical features and comorbidity', note: 'Anti-IgE, anti-IL4R alpha, anti-IL5, anti-IL5R or anti-TSLP' },
      { id: 'e3', edge: 'BEC > 1500', text: 'Exclude parasites, hematologic and other hypereosinophilic disease', note: 'Anti-IL5 or anti-IL5R' },
    ],
  };

  const TOPIC = {
    title: 'Asthma',
    subtitle: 'Chest - Thai Asthma Guideline in Adults 2025 (TAC)',
    lead: 'A chronic disease with airway inflammation and narrowing that varies over time. About half of Thai patients with asthma are not yet well controlled, and many do not receive inhaled corticosteroid continuously. Good care needs correct diagnosis, appropriate symptom management, treatment of comorbidities and continuous follow-up.',
    sections: [
      {
        id: 'goal', title: '1  Treatment goal: remission',
        blocks: [
          { p: 'The long-term goal is remission: no asthma symptoms for at least 12 months.' },
          { table: { head: ['Level', 'Criteria'], rows: [
            ['Clinical remission', 'Asthma controlled, no exacerbation, and normal lung function for at least 1 year'],
            ['Complete remission', 'Clinical remission plus normal airway responsiveness and inflammation: methacholine challenge normal (TAC threshold PC20 8 mg/mL) and FeNO < 25 ppb'],
          ] } },
          { sub: 'Pathophysiology in brief' },
          { ul: [
            'Airway inflammation (mast cells, eosinophils, Th2 cells, IgE; neutrophils in some), airway hyperresponsiveness, and remodeling that may become fixed',
            'Most Thai patients with severe asthma are type 2 high with raised blood eosinophils',
          ] },
        ],
      },
      {
        id: 'assess', title: 'Assessment of control and risk',
        blocks: [
          { table: { head: ['In the last 4 weeks, has the patient had', 'Controlled'], rows: [
            ['Daytime asthma symptoms', 'None of the 4 items for 1 month'],
            ['Night waking due to asthma', ''],
            ['RABA use for symptom relief', ''],
            ['Activity limitation due to asthma', ''],
          ] } },
          { note: 'Any one item present: review and assess to adjust treatment.' },
          { sub: 'Major risk factors for future exacerbation' },
          { ul: [
            'Severe exacerbation in the past year',
            'Ever intubated for asthma',
            'FEV1 < 60% predicted',
            'High bronchodilator responsiveness > 20%',
            'Comorbidities: allergic rhinitis or chronic rhinosinusitis, GERD, obesity, stress and depression',
          ] },
        ],
      },
      {
        id: 'dx', title: '2  Diagnosis in adults',
        blocks: [
          { table: { head: ['Key symptoms', 'Supportive features'], rows: [
            ['Cough, wheeze, dyspnea, chest tightness', 'Symptoms at night or early morning; triggered by allergen, cold air, exercise or viral infection; symptoms and severity vary over time'],
          ] } },
          { p: 'Plus abnormal lung function shown by one of the following:' },
          { table: { head: ['Test', 'Positive'], rows: [
            ['Serial PEFR (twice daily for 2 weeks)', 'PEFR variability >= 10%'],
            ['PEF bronchodilator response', 'Increase >= 20%'],
            ['Spirometry with bronchodilator', 'FEV1 increase >= 12% and >= 200 mL 10-15 min after salbutamol 200-400 mcg'],
            ['Spirometry after treatment', 'FEV1 increase >= 12% and >= 200 mL after 4 weeks of treatment'],
            ['Methacholine challenge', 'FEV1 fall >= 20%'],
            ['Exercise challenge', 'FEV1 fall >= 10% and >= 200 mL'],
          ] } },
          { tree: DX_TREE },
          { sub: 'Differential diagnosis' },
          { table: { head: ['Group', 'Conditions'], rows: [
            ['Upper airway', 'Foreign body, postnasal drip, upper airway obstruction, vocal cord dysfunction, tracheobronchomalacia'],
            ['Pulmonary', 'COPD, bronchiectasis, ABPA, EGPA, cystic fibrosis, ILD, lung cancer, pneumonia, pneumothorax, sarcoidosis'],
            ['Cardiac', 'Left ventricular failure, mitral valve disease, angina'],
            ['Other', 'GERD, obesity, anemia, hyperventilation, carcinoid, mastocytosis'],
          ] } },
          { sub: 'Asthma vs COPD' },
          { table: { head: ['Feature', 'Asthma', 'COPD'], rows: [
            ['Onset', 'Childhood or early adulthood', 'Usually > 40 years, smoking, biomass, post-TB'],
            ['Reversibility', 'Largely reversible', 'Partially reversible, progressive'],
            ['Inflammation', 'Type 2 eosinophilic', 'Neutrophilic'],
            ['Lung function', 'May be normal between episodes', 'Persistently obstructive, declines'],
            ['Symptoms', 'Variable, night or early morning', 'Persistent, exertional'],
          ] } },
        ],
      },
      {
        id: 'cycle', title: 'Principles of care: Assess - Adjust - Review',
        blocks: [
          { table: { head: ['Step', 'What to do'], rows: [
            ['Assess', 'Diagnosis, comorbidities, level of control and major risk factors; inhaler technique, adherence, patient goals; clinical and complete remission'],
            ['Adjust', 'Treatment by level of control; non-drug measures; education about asthma and self-care'],
            ['Review', 'Treatment response, lung function, side effects, comorbidity control'],
          ] } },
        ],
      },
      {
        id: 'start', title: '3  Starting treatment',
        blocks: [
          { table: { head: ['Severity / frequency', 'Start with'], rows: [
            ['Mild: symptoms < 3 times/week and lung function > 80%', 'Daily low-dose ICS'],
            ['Moderate: symptoms > 4-5 days/week or night symptoms > once/week', 'Low-dose ICS/LABA or medium-dose ICS'],
            ['Severe: daily symptoms, or night symptoms > once/week, or FEV1 < 60%', 'Medium-high dose ICS/LABA'],
          ] } },
          { note: 'Every patient should have a RABA for symptom relief.' },
          { sub: 'ICS daily dose (mcg)' },
          { table: { head: ['ICS', 'Low dose', 'Medium to high dose'], rows: [
            ['Beclomethasone dipropionate', '200-500', '> 500'],
            ['Budesonide', '200-400', '> 400'],
            ['Fluticasone propionate', '100-250', '> 250'],
            ['Fluticasone furoate', '100', '200'],
          ] } },
        ],
      },
      {
        id: 'adjust', title: '4  Adjusting treatment in patients already treated',
        blocks: [
          { table: { head: ['Step', 'Controller', 'Reliever'], rows: [
            ['1', 'Daily low-dose ICS', 'As-needed short-acting bronchodilator, or as-needed low-dose ICS/RABA'],
            ['2', 'Daily low-dose ICS/LABA', ''],
            ['3', 'Medium-dose ICS/LABA', ''],
            ['4', 'Medium-high dose ICS/LABA plus other: SR xanthine, LTRA, LAMA or biologic; low-dose OCS (< 7.5 mg prednisolone/day); consider specialist consultation', ''],
          ] } },
          { tree: ADJUST_TREE },
          { note: 'Step up if not controlled within 1-3 months. Step down only when controlled for at least 12 months; if a major exacerbation risk factor is present, keep treatment for 12 months first.' },
          { note: 'GINA 2025 differs: it prefers as-needed ICS-formoterol (AIR-only) at steps 1-2 and maintenance-and-reliever therapy (MART) at steps 3-5.' },
          { sub: 'Drug notes' },
          { table: { head: ['Drug', 'Onset', 'Duration', 'Notes'], rows: [
            ['Salbutamol (RABA)', '< 5 min', '3-6 h', '100-200 mcg as needed; tremor, tachycardia, hypokalemia'],
            ['Formoterol (LABA)', '~7 min', '12 h', 'Rapid onset; usable as reliever with ICS'],
            ['Salmeterol (LABA)', '~15 min', '12 h', 'Not a reliever'],
            ['ICS', '', '', 'Dysphonia, oral candidiasis (rinse mouth); bruising, cataract, osteoporosis at high dose'],
            ['LAMA (tiotropium)', 'Slow', '24 h', 'Add-on at step 4; dry mouth, urinary retention'],
          ] } },
        ],
      },
      {
        id: 'nondrug', title: '5  Non-pharmacological treatment',
        blocks: [
          { table: { head: ['Measure', 'Recommendation'], rows: [
            ['Smoking cessation', 'Stop cigarettes and e-cigarettes'],
            ['Exercise and breathing training', 'Regular exercise 20-30 min/session, 5-7 days/week (150 min/week); RABA 15 min before exercise if exercise-induced bronchospasm'],
            ['Environmental control', 'Adjust home and work environment; avoid allergens and air pollution'],
            ['Weight reduction', 'In obesity, losing 10% of weight improves lung function and control'],
            ['Vaccination', 'See below'],
            ['Bronchial thermoplasty', 'Option for severe asthma not controlled on step 4'],
          ] } },
          { sub: 'Vaccines for adults with asthma' },
          { table: { head: ['Vaccine', 'Recommendation'], rows: [
            ['Influenza', 'Once yearly'],
            ['RSV (adjuvanted)', '1 dose for age >= 60 years, or >= 50 years with comorbidity such as asthma'],
            ['Pneumococcal', 'PCV13 or PCV15 1 dose, then PPSV23 1 dose at least 1 year later'],
            ['COVID-19', '1 additional dose for age > 65 years; can be given with influenza vaccine'],
            ['Pertussis', 'Tdap 1 dose every 10 years'],
            ['Herpes zoster (age >= 50)', 'Recombinant vaccine 2 doses 2-6 months apart (efficacy 88.8% in asthma), or live vaccine 1 dose from age 60'],
          ] } },
        ],
      },
      {
        id: 'ed', title: '6  Acute exacerbation in the emergency room',
        blocks: [
          { tree: ED_TREE },
          { table: { head: ['Severity', 'Features', 'Treatment'], rows: [
            ['Mild to moderate', 'Not agitated, RR increased, accessory muscles not used, PR 100-120, SpO2 90-95%',
              'RABA nebulized every 20 min for 1 h; prednisolone or dexamethasone; O2 to SpO2 93-95%'],
            ['Severe', 'Agitated, RR > 30, accessory muscles used, PR > 120, SpO2 < 90%',
              'RABA + ipratropium nebulized every 20 min for 1 h; dexamethasone IV; O2 to SpO2 93-95%; consider IV magnesium sulfate (usually 2 g over 20 min); consider add-on high-dose ICS nebulization'],
            ['Life-threatening', 'Drowsy, confused, air hunger or cyanosis', 'ICU admission, consider intubation, treat as severe'],
          ] } },
          { p: 'Reassess symptoms and signs 1 hour after treatment. If improved and stable: discharge with clinic follow-up, start or adjust controller, prednisolone 30-50 mg/day for no more than 5 days, and RABA. If not improved: admit, continue treatment and monitor closely.' },
          { sub: 'Risk factors for asthma-related death' },
          { ul: [
            'Previous intubation or ICU; >= 2 admissions or >= 3 ED visits in the past year; recent admission or ED visit',
            'High SABA use (> 1-2 canisters/month); no ICS; no written action plan; poor perception of severity',
            'Psychosocial problems, illicit drugs; cardiovascular or psychiatric comorbidity',
          ] },
        ],
      },
      {
        id: 'severe', title: '7  Difficult-to-treat and severe asthma',
        blocks: [
          { table: { head: ['Term', 'Definition (TAC)'], rows: [
            ['Difficult-to-treat asthma', 'Not controlled on step 4 (medium-high dose ICS/LABA plus other controllers). Includes severe asthma and patients whose contributory factors have not yet been reviewed and corrected'],
            ['Severe asthma', 'Still hard to control after: confirming the diagnosis, checking adherence, checking inhaler technique, avoiding triggers, and diagnosing and treating comorbidities. Consider specialist consultation or referral'],
          ] } },
          { tree: DTT_TREE },
          { p: 'In Thailand 44.7% of patients are not controlled despite an ICS-containing regimen, and most severe asthma is type 2 high with raised blood eosinophils.' },
          { sub: 'Type 2 high severe asthma: any one of' },
          { ul: [
            'Blood eosinophils >= 150/uL',
            'Positive skin prick test or serum specific IgE to an aeroallergen',
            'FeNO >= 20 ppb or sputum eosinophils >= 2%',
          ] },
          { table: { head: ['Add-on for type 2 severe asthma', 'Action', 'Add-on for non-type 2 severe asthma', 'Action'], rows: [
            ['Omalizumab', 'Anti-IgE', 'Tiotropium / umeclidinium', 'LAMA'],
            ['Mepolizumab, reslizumab', 'Anti-IL5', 'Low-dose macrolide', 'Immunomodulation'],
            ['Benralizumab', 'Anti-IL5R', 'Bronchial thermoplasty', 'Reduces airway smooth muscle'],
            ['Dupilumab', 'Anti-IL4R alpha', 'Non-type 2 biologic (tezepelumab)', 'Non-type 2 pathway'],
            ['Tezepelumab', 'Anti-TSLP', '', ''],
          ] } },
          { note: 'Bronchial thermoplasty is also considered in type 2 severe asthma that cannot receive a biologic.' },
          { sub: 'Choosing a biologic' },
          { tree: BIO_TREE },
          { sub: 'Biologic summary' },
          { table: { head: ['', 'Omalizumab', 'Mepolizumab', 'Benralizumab', 'Dupilumab', 'Tezepelumab', 'Bronchial thermoplasty'], rows: [
            ['Mechanism', 'Anti-IgE', 'IL-5 antagonist', 'IL-5 receptor antagonist', 'IL-4R alpha (blocks IL-4 and IL-13)', 'Anti-TSLP', 'Heat reduces airway smooth muscle'],
            ['Formulation', '150 mg prefilled syringe', '100 mg/mL prefilled pen', '30 mg/mL prefilled syringe', '200 mg/1.14 mL, 300 mg/2 mL', '210 mg/1.91 mL', '65 C for 10 s, 50-150 activations per session'],
            ['Dose', '1-2 vials SC by IgE level, every 4 weeks', '1 injection SC every 4 weeks', '3 doses every 4 weeks, then every 8 weeks', 'Loading 2 injections, then 1 every 2 weeks', 'SC every 4 weeks', '3 bronchoscopic sessions'],
            ['Approved age', '>= 6', '>= 12', '>= 18', '>= 6', '>= 18', '>= 18'],
            ['Comorbidity', 'CSU, CRSwNP', 'CRSwNP, EGPA', 'CRSwNP', 'Atopic dermatitis, CRSwNP', '-', '-'],
          ] } },
          { p: 'Assess response after about 4 months by control, exacerbations, OCS use and biomarkers: continue if responding (taper OCS, watch for adrenal insufficiency); switch biologic if no response.' },
        ],
      },
      {
        id: 'comorbid', title: '8  Comorbidities and special situations',
        blocks: [
          { table: { head: ['Condition', 'Management'], rows: [
            ['Allergic rhinitis (86% of Thai asthma patients, AROCOT)', 'Intranasal steroid and non-sedating antihistamine; refer if severe; consider SLIT in house dust mite allergy with FEV1 >= 70%'],
            ['Chronic rhinosinusitis', 'Intranasal steroid, saline rinse; in AERD avoid aspirin, use selective COX-2 inhibitor or paracetamol'],
            ['Obstructive sleep apnea', 'Positive airway pressure: reduces exacerbations and improves control, lung function and quality of life'],
            ['Obesity', 'Weight loss 5-10% improves control, lung function and quality of life; 37% of severe asthma patients are obese'],
            ['GERD', 'Proton pump inhibitor or prokinetic'],
            ['Depression and anxiety', 'Refer to psychiatry'],
            ['Pregnancy', 'Keep control continuous; advise that medication benefit outweighs the risk of stopping'],
            ['Long-term or frequent systemic steroid, or high-dose ICS', '>= 2 short OCS courses/year: give calcium and vitamin D; screen for diabetes, osteoporosis, glaucoma and HPA axis effects; refer'],
            ['Surgery', 'Assess symptoms and lung function before; if FEV1 below target (< 80%) give prednisone 1 mg/kg/day (max 40 mg) for 5 days before surgery; if high-dose or OCS > 2 weeks in the past 6 months, give IV hydrocortisone to prevent adrenal crisis'],
            ['Exercise-induced bronchoconstriction', 'Warm up and use bronchodilator before exercise; regular controller if symptoms persist'],
          ] } },
          { sub: 'Allergic rhinitis in adults' },
          { ul: [
            'Intermittent (< 4 days/week or < 4 weeks) with VAS < 5: saline rinse plus second-generation antihistamine or LTRA',
            'Intermittent with VAS >= 5, or persistent: saline rinse plus intranasal steroid (INS)',
            'Reassess at 2 weeks: if better, continue and consider stepping down; if not, review diagnosis, comorbidity and adherence, then add on (e.g. antihistamine with INS, short decongestant <= 5 days)',
            'Not better after 2 more weeks: consider immunotherapy or surgery',
          ] },
          { sub: 'Chronic rhinosinusitis in adults' },
          { ul: [
            '2 symptoms for >= 12 weeks, one being nasal blockage or discharge, with or without facial pain and reduced smell',
            'Initial: saline rinse, intranasal steroid, avoid triggers and unnecessary antibiotics; reassess at 6-12 weeks; CT paranasal sinus or refer if not better',
            'Alarm symptoms (refer urgently): unilateral symptoms, bleeding, crusting; periorbital swelling, displaced globe, double vision, reduced vision; severe headache, frontal swelling, neurological signs',
          ] },
          { sub: 'Obstructive sleep apnea' },
          { ul: [
            'Suspected or at risk: sleep study, interpreted by a specialist',
            'OSA if AHI or RDI > 15, or > 5 with symptoms: explain and offer CPAP; if declined, behaviour change, oral appliance or surgery',
          ] },
        ],
      },
      {
        id: 'edu', title: '9  Patient education',
        blocks: [
          { ul: [
            'Asthma and its course',
            'Medicines and side effects: use the controller regularly and the reliever when symptomatic',
            'Self-management of exacerbation with a written asthma action plan',
            'Correct inhaler technique',
            'Treatment of comorbidities: allergic rhinitis, sinusitis, OSA, GERD, obesity',
            'Avoid allergens, smoke and pollution: wear a mask against PM2.5 and avoid outdoor activity on poor air quality days',
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
