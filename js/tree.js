// Decision tree renderer: top-down flowchart on wide screens, indented outline on phones
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // node = { id, text, edge?, note?, children? }
  function nodeHtml(n, active) {
    const on = active.has(n.id) ? ' on' : '';
    const kids = n.children && n.children.length
      ? `<ul>${n.children.map(c => nodeHtml(c, active)).join('')}</ul>` : '';
    return `<li><div class="node${on}" data-node="${n.id}">` +
      (n.edge ? `<span class="edge">${esc(n.edge)}</span>` : '') +
      `<span class="ntext">${esc(n.text)}</span>` +
      (n.note ? `<span class="nnote">${esc(n.note)}</span>` : '') +
      `</div>${kids}</li>`;
  }

  function render(tree, active) {
    return `<div class="tree-wrap"><div class="tree"><ul>${nodeHtml(tree, active || new Set())}</ul></div></div>`;
  }

  // Mark the nodes on the path in an already rendered tree
  function highlight(root, active) {
    root.querySelectorAll('.tree .node').forEach(el => el.classList.toggle('on', active.has(el.dataset.node)));
  }

  function table(head, rows) {
    return `<div class="table-wrap"><table class="etio">
      <thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => r.group
        ? `<tr class="grp"><th colspan="${head.length}">${esc(r.group)}</th></tr>`
        : `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }

  const api = { render, highlight, table };
  if (typeof window !== 'undefined') window.Tree = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
