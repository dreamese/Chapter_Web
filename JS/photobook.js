(() => {
  const dataElement = document.querySelector('#photobookData');
  if (!dataElement) return;
  const data = JSON.parse(dataElement.textContent);
  const pages = [...document.querySelectorAll('.book-sheet')];
  const select = document.querySelector('#bookPage');
  const previousPage = document.querySelector('#bookPrevious');
  const nextPage = document.querySelector('#bookNext');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = document.querySelector('#bookLightbox');
  const image = document.querySelector('#lightboxImage');
  let currentPage = 0;
  let currentPhoto = 0;
  let opener = null;
  let scheduled = false;
  let touchStart = null;

  function updatePage() {
    const marker = innerHeight * .3;
    let distance = Infinity;
    pages.forEach((page, index) => {
      const rect = page.getBoundingClientRect();
      const d = rect.top <= marker && rect.bottom > marker ? 0 : Math.min(Math.abs(rect.top - marker), Math.abs(rect.bottom - marker));
      if (d < distance) { distance = d; currentPage = index; }
    });
    select.value = pages[currentPage].id;
    previousPage.disabled = currentPage === 0;
    nextPage.disabled = currentPage === pages.length - 1;
    document.querySelector('#bookProgress').style.width = `${(currentPage + 1) / pages.length * 100}%`;
  }
  function goToPage(index) {
    const page = pages[Math.max(0, Math.min(pages.length - 1, index))];
    page.scrollIntoView({behavior: reducedMotion.matches ? 'instant' : 'smooth', block:'start'});
    history.replaceState(null, '', '#' + page.id);
  }
  previousPage.addEventListener('click', () => goToPage(currentPage - 1));
  nextPage.addEventListener('click', () => goToPage(currentPage + 1));
  document.querySelector('#bookTop').addEventListener('click', () => goToPage(0));
  select.addEventListener('change', () => goToPage(pages.findIndex(page => page.id === select.value)));
  addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; updatePage(); });
  }, {passive:true});
  addEventListener('resize', updatePage, {passive:true});

  function showPhoto(index) {
    currentPhoto = (index + data.photos.length) % data.photos.length;
    const photo = data.photos[currentPhoto];
    image.src = photo.src;
    image.alt = photo.title || `${data.title} — Hình ${currentPhoto + 1}`;
    document.querySelector('#lightboxCounter').textContent = `${String(currentPhoto + 1).padStart(2,'0')} / ${data.photos.length}`;
    document.querySelector('#lightboxTitle').textContent = photo.title || data.title;
    const description = document.querySelector('#lightboxDescription');
    description.textContent = photo.description || '';
    description.hidden = !photo.description;
    document.querySelector('#lightboxOriginal').href = photo.src;
  }
  document.querySelectorAll('.book-photo').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !dialog.showModal) return;
      event.preventDefault();
      opener = link;
      showPhoto(Number(link.dataset.photoIndex));
      document.body.classList.add('lightbox-open');
      dialog.showModal();
    });
  });
  function closePhoto() { dialog.close(); }
  document.querySelector('#lightboxClose').addEventListener('click', closePhoto);
  document.querySelector('#lightboxPrevious').addEventListener('click', () => showPhoto(currentPhoto - 1));
  document.querySelector('#lightboxNext').addEventListener('click', () => showPhoto(currentPhoto + 1));
  dialog.addEventListener('close', () => {
    document.body.classList.remove('lightbox-open');
    image.removeAttribute('src');
    opener?.focus({preventScroll:true});
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') {event.preventDefault();showPhoto(currentPhoto + 1);}
    if (event.key === 'ArrowLeft') {event.preventDefault();showPhoto(currentPhoto - 1);}
  });
  image.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) {touchStart = null;return;}
    touchStart = {x:event.touches[0].clientX, y:event.touches[0].clientY};
  }, {passive:true});
  image.addEventListener('touchend', event => {
    if (!touchStart || event.touches.length) return;
    const deltaX = event.changedTouches[0].clientX - touchStart.x;
    const deltaY = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) showPhoto(currentPhoto + (deltaX < 0 ? 1 : -1));
    touchStart = null;
  }, {passive:true});
  updatePage();
})();
