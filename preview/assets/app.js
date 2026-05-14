/* PetStockPro shared interactivity */

document.addEventListener('click', function(e) {
  // Drawer open via [data-open-drawer="#id"]
  const opener = e.target.closest('[data-open-drawer]');
  if (opener) {
    const sel = opener.getAttribute('data-open-drawer');
    const back = document.querySelector(sel);
    if (back) {
      back.classList.add('open');
      const draw = back.nextElementSibling;
      if (draw && draw.classList.contains('drawer')) draw.classList.add('open');
    }
    return;
  }
  // Drawer close
  const closer = e.target.closest('[data-close-drawer]');
  if (closer || e.target.classList.contains('drawer-back')) {
    document.querySelectorAll('.drawer-back.open').forEach(b => b.classList.remove('open'));
    document.querySelectorAll('.drawer.open').forEach(d => d.classList.remove('open'));
    return;
  }
  // Tabs
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    const group = tab.closest('[data-tabs]');
    if (group) {
      group.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const id = tab.getAttribute('data-tab');
      const panes = document.querySelectorAll('[data-pane]');
      panes.forEach(p => {
        if (p.closest('[data-tabs-host]') === group.closest('[data-tabs-host]')) {
          p.style.display = (p.getAttribute('data-pane') === id) ? '' : 'none';
        }
      });
    }
    return;
  }
  // Toggle
  const tog = e.target.closest('.toggle');
  if (tog && !tog.classList.contains('disabled')) {
    tog.classList.toggle('on');
    const cb = tog.getAttribute('data-toggle-cb');
    if (cb && window[cb]) window[cb](tog);
    return;
  }
  // Subtab pills
  const sub = e.target.closest('[data-subtab]');
  if (sub) {
    const group = sub.closest('[data-subtabs]');
    if (group) {
      group.querySelectorAll('[data-subtab]').forEach(t => t.classList.remove('active'));
      sub.classList.add('active');
      const id = sub.getAttribute('data-subtab');
      document.querySelectorAll('[data-subpane]').forEach(p => {
        if (p.closest('[data-subtabs-host]') === group.closest('[data-subtabs-host]')) {
          p.style.display = (p.getAttribute('data-subpane') === id) ? '' : 'none';
        }
      });
    }
  }
});

// ESC closes drawers
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.drawer-back.open').forEach(b => b.classList.remove('open'));
    document.querySelectorAll('.drawer.open').forEach(d => d.classList.remove('open'));
  }
});

// Live clock for activity feed "şimdi"
function relTime(min) {
  if (min < 1) return 'şimdi';
  if (min < 60) return min + 'd önce';
  const h = Math.floor(min / 60);
  if (h < 24) return h + 's önce';
  return Math.floor(h / 24) + 'g önce';
}
window.relTime = relTime;
