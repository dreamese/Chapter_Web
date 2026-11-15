(() => {
  const journey = document.querySelector('.journey');
  const panels = [...journey.children];
  const desktop = matchMedia('(min-width:821px)');
  const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)');
  const links = [...document.querySelectorAll('.journey-footer nav a')];
  const previous = document.querySelector('#previous');
  const next = document.querySelector('#next');
  let active = 0;
  function update() {
    const center = desktop.matches ? journey.scrollLeft + Math.min(150, journey.clientWidth * .2) : innerHeight * .4;
    let distance = Infinity;
    panels.forEach((panel, i) => {
      const rect = panel.getBoundingClientRect();
      const value = desktop.matches ? panel.offsetLeft : rect.top + rect.height / 2;
      if (Math.abs(value - center) < distance) { active = i; distance = Math.abs(value - center); }
    });
    links.forEach((link, i) => { if (i === active) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current'); });
    previous.disabled = active === 0;
    next.disabled = active === panels.length - 1;
    document.querySelector('#position').textContent = active === 0 ? 'TỔNG QUAN' : active === panels.length - 1 ? 'LIÊN HỆ' : `BƯỚC ${String(active).padStart(2, '0')} / ${panels.length - 2}`;
  }
  function go(index) {
    const panel = panels[Math.max(0, Math.min(index, panels.length - 1))];
    panel.scrollIntoView({behavior: reduceMotion.matches ? 'instant' : 'smooth', block: desktop.matches ? 'nearest' : 'start', inline: 'start'});
  }
  previous.addEventListener('click', () => go(active - 1));
  next.addEventListener('click', () => go(active + 1));
  let scheduled = false;
  function onScroll() { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { update(); scheduled = false; }); }
  journey.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll, {passive:true});
  journey.addEventListener('wheel', (event) => {
    if (!desktop.matches || event.ctrlKey || event.target.closest('dialog') || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? journey.clientWidth : 1);
    if ((delta > 0 && journey.scrollLeft < journey.scrollWidth - journey.clientWidth - 1) || (delta < 0 && journey.scrollLeft > 0)) {
      event.preventDefault();journey.scrollLeft += delta;
    }
  }, {passive:false});
  journey.addEventListener('keydown', (event) => {
    if (event.target !== journey || !desktop.matches) return;
    if (event.key === 'ArrowRight') {event.preventDefault();go(active + 1);}
    if (event.key === 'ArrowLeft') {event.preventDefault();go(active - 1);}
    if (event.key === 'Home') {event.preventDefault();go(0);}
    if (event.key === 'End') {event.preventDefault();go(panels.length - 1);}
  });
  document.querySelectorAll('[data-dialog]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.dialog).showModal());
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
  });
  desktop.addEventListener('change', () => {go(active);update();});
  update();
})();
