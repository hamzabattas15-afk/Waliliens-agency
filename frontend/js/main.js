document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const links = document.querySelector('.nav-links');
  if (!header || !toggle || !links) return;
  window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 24));
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    toggle.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  });
  links.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    links.classList.remove('is-open');
    toggle.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
  }));

  // Scroll-spy: mark the nav link for whichever section is currently under
  // the fixed header as aria-current="page", so the one-page nav reflects
  // scroll position instead of a per-document "current page".
  const navLinks = [...links.querySelectorAll('a[href^="#"]')]
    .map(link => ({ link, section: document.querySelector(link.getAttribute('href')) }))
    .filter(entry => entry.section);

  if (navLinks.length && 'IntersectionObserver' in window) {
    const setActive = id => {
      navLinks.forEach(({ link }) => {
        if (id && link.getAttribute('href') === `#${id}`) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    };

    // A section counts as "current" once it's crossed just below the fixed
    // header and still sits in the upper part of the viewport (shrinking the
    // observed rect from the top by the header's height and from the bottom
    // by 60% of the viewport), rather than whenever any sliver of it is
    // visible — that naive version flickers between adjacent sections right
    // at their shared boundary.
    //
    // The observer only fires when a section's intersection state *changes*,
    // so tracking single entries in isolation breaks for a jump straight from
    // #contact to the very top: #services was already non-intersecting and
    // stays that way (no crossing event), so nothing would ever clear the
    // stale #contact match. Instead keep the full set of currently
    // intersecting ids and derive the active link from it every callback —
    // the bottom-most one in document order when several overlap, none when
    // the set is empty.
    const intersecting = new Set();
    const headerHeight = header.getBoundingClientRect().height;
    const spyObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) intersecting.add(entry.target.id);
        else intersecting.delete(entry.target.id);
      });
      const activeId = navLinks.map(({ section }) => section.id).filter(id => intersecting.has(id)).pop();
      setActive(activeId);
    }, { rootMargin: `-${headerHeight + 1}px 0px -60% 0px`, threshold: 0 });

    navLinks.forEach(({ section }) => spyObserver.observe(section));
  }
});
