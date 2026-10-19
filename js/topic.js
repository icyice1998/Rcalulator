// Topic page renderer: sections of paragraphs, lists, tables and decision trees
(function () {
  const Tree = typeof window !== 'undefined' && window.Tree ? window.Tree : require('./tree.js');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function block(b) {
    if (b.p) return `<p>${esc(b.p)}</p>`;
    if (b.note) return `<p class="muted small">${esc(b.note)}</p>`;
    if (b.sub) return `<h4 class="topic-sub">${esc(b.sub)}</h4>`;
    if (b.ul) return `<ul class="topic-list">${b.ul.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
    if (b.table) return Tree.table(b.table.head, b.table.rows);
    if (b.tree) return Tree.render(b.tree);
    if (b.html) return b.html;
    return '';
  }

  // topic = { title, subtitle, lead, sections: [{ id, title, blocks }] }
  function render(el, topic) {
    el.innerHTML = `
      <div class="page-grid topic">
        <div class="card">
          <h2>${esc(topic.title)}</h2>
          <p class="muted">${esc(topic.subtitle)}</p>
          ${topic.lead ? `<p>${esc(topic.lead)}</p>` : ''}
          <nav class="toc">${topic.sections.map(s =>
            `<button type="button" class="chip" data-target="sec-${s.id}">${esc(s.title)}</button>`).join('')}</nav>
        </div>
        ${topic.sections.map(s => `
          <section class="card" id="sec-${s.id}">
            <h3 class="section-title">${esc(s.title)}</h3>
            ${s.blocks.map(block).join('')}
          </section>`).join('')}
      </div>`;
    el.querySelectorAll('.toc .chip').forEach(btn => btn.addEventListener('click', () => {
      el.querySelector('#' + btn.dataset.target).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  const api = { render };
  if (typeof window !== 'undefined') window.Topic = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
