// Shared form and output helpers
(function () {
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

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

  // Number box + horizontal slider kept in sync
  function sliderField(f) {
    return `
      <div class="field slider-field">
        <label for="${f.id}">${f.label} <span class="unit">${f.unit || ''}</span></label>
        <div class="dual">
          <input type="range" id="${f.id}-range" min="${f.min}" max="${f.max}" step="${f.step}" value="${f.value}" aria-label="${f.label} slider">
          <input type="number" id="${f.id}" min="${f.min}" max="${f.max}" step="${f.step}" value="${f.value}" inputmode="decimal">
        </div>
      </div>`;
  }

  function bindSliders(root, fields, onChange) {
    fields.forEach(f => {
      const box = root.querySelector('#' + f.id);
      const range = root.querySelector('#' + f.id + '-range');
      range.addEventListener('input', () => { box.value = range.value; onChange(); });
      box.addEventListener('input', () => {
        if (box.value !== '') range.value = box.value;
        onChange();
      });
    });
  }

  function resetSliders(root, fields) {
    fields.forEach(f => {
      root.querySelector('#' + f.id).value = f.value;
      root.querySelector('#' + f.id + '-range').value = f.value;
    });
  }

  const api = { esc, fieldHtml, sliderField, bindSliders, resetSliders };
  if (typeof window !== 'undefined') window.UI = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
