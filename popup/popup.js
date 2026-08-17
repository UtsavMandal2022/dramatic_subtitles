const toggleEl = document.getElementById('toggle');
const statusEl = document.getElementById('status');
const { storage } = window.__dramaticSubs;

function renderStatus(enabled) {
  statusEl.textContent = enabled ? 'ON — drama engaged 🎬' : 'OFF — back to boring';
  statusEl.classList.toggle('on', enabled);
}

storage.getEnabled().then((enabled) => {
  toggleEl.checked = enabled;
  renderStatus(enabled);
});

toggleEl.addEventListener('change', () => {
  storage.setEnabled(toggleEl.checked);
  renderStatus(toggleEl.checked);
});
