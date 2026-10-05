document.documentElement.classList.remove('no-js');

document.addEventListener('change', (event) => {
  const select = event.target.closest('[data-variant-select]');
  if (!select) return;
  const option = select.options[select.selectedIndex];
  const url = option?.dataset?.url;
  if (url && window.history?.replaceState) window.history.replaceState({}, '', url);
});