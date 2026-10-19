const routes = {
  abg: window.ABG,
};

function renderHome(el) {
  el.innerHTML = `
    <div class="card">
      <h2>Welcome</h2>
      <p class="muted">Select a calculator from the menu.</p>
    </div>`;
}

function router() {
  const key = location.hash.slice(1);
  const el = document.getElementById('content');
  const calc = routes[key];

  document.querySelectorAll('[data-route]').forEach(a =>
    a.classList.toggle('active', a.dataset.route === key));

  if (calc) calc.render(el);
  else renderHome(el);

  document.getElementById('sidebar').classList.remove('open');
}

document.querySelectorAll('.menu-header').forEach(btn =>
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
  }));

document.getElementById('menuToggle').addEventListener('click', () =>
  document.getElementById('sidebar').classList.toggle('open'));

window.addEventListener('hashchange', router);
router();
