// ABG interpretation — formulas to be added after discussion
window.ABG = {
  fields: [
    { group: 'Blood gas', id: 'ph',    label: 'pH',    unit: '',      step: '0.01' },
    { group: 'Blood gas', id: 'paco2', label: 'PaCO2', unit: 'mmHg',  step: '0.1' },
    { group: 'Blood gas', id: 'hco3',  label: 'HCO3-', unit: 'mEq/L', step: '0.1' },
    { group: 'Blood gas', id: 'pao2',  label: 'PaO2',  unit: 'mmHg',  step: '0.1' },
    { group: 'Blood gas', id: 'fio2',  label: 'FiO2',  unit: '%',     step: '1' },
    { group: 'Electrolytes', id: 'na',  label: 'Na+',     unit: 'mEq/L', step: '0.1' },
    { group: 'Electrolytes', id: 'cl',  label: 'Cl-',     unit: 'mEq/L', step: '0.1' },
    { group: 'Electrolytes', id: 'alb', label: 'Albumin', unit: 'g/dL',  step: '0.1' },
  ],

  render(el) {
    const groups = [...new Set(this.fields.map(f => f.group))];
    el.innerHTML = `
      <div class="card">
        <h2>ABG interpretation</h2>
        <p class="muted">Critical care</p>
        <form id="abgForm">
          ${groups.map(g => `
            <fieldset>
              <legend>${g}</legend>
              <div class="form-grid">
                ${this.fields.filter(f => f.group === g).map(f => `
                  <div class="field">
                    <label for="${f.id}">${f.label} <span class="unit">${f.unit}</span></label>
                    <input type="number" id="${f.id}" step="${f.step}" inputmode="decimal">
                  </div>`).join('')}
              </div>
            </fieldset>`).join('')}
          <button type="submit" class="btn">Interpret</button>
          <button type="reset" class="btn secondary">Clear</button>
        </form>
      </div>
      <div class="card" id="abgResult" hidden></div>`;

    el.querySelector('#abgForm').addEventListener('submit', e => {
      e.preventDefault();
      this.showResult(this.readInputs(el));
    });
  },

  readInputs(el) {
    const v = {};
    this.fields.forEach(f => {
      const raw = el.querySelector('#' + f.id).value;
      v[f.id] = raw === '' ? null : Number(raw);
    });
    return v;
  },

  interpret(v) {
    return [];
  },

  showResult(v) {
    const out = document.getElementById('abgResult');
    const lines = this.interpret(v);
    out.hidden = false;
    out.innerHTML = lines.length
      ? `<h3>Result</h3><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>`
      : `<p class="muted">Interpretation logic not yet implemented.</p>`;
  },
};
