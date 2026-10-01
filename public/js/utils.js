const Utils = (() => {
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
  function getInitials(name) {
    if (!name || !name.trim()) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
  }
  return { escapeHtml, getInitials };
})();
