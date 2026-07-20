/*
 * Waliliens page transitions
 * Add this script tag to every page that should participate in the transition.
 * Each page must expose its swappable content inside a <main> element.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Stop gracefully if GSAP is unavailable; ordinary links will still work.
  if (!window.gsap) return;

  // 1. Create the full-screen navy panel used as the transition wipe.
  const wipe = document.createElement('div');
  wipe.className = 'page-wipe';
  wipe.setAttribute('aria-hidden', 'true');
  Object.assign(wipe.style, {
    position: 'fixed', inset: '0', zIndex: '1000',
    background: '#0A0F2C', transform: 'translateY(100%)', pointerEvents: 'none'
  });
  document.body.appendChild(wipe);

  let isTransitioning = false;

  // 2. Only intercept normal, same-origin navigations to another HTML document.
  const isTransitionLink = (link, event) => {
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    const url = new URL(link.href, window.location.href);
    return url.origin === window.location.origin && /\.html$/i.test(url.pathname) && url.href !== window.location.href;
  };

  // 3. Fetch and parse the next document, returning only its main page content.
  const fetchPage = async url => {
    const response = await fetch(url, { headers: { 'X-Requested-With': 'WaliliensTransition' } });
    if (!response.ok) throw new Error(`Unable to load ${url}`);
    const documentNext = new DOMParser().parseFromString(await response.text(), 'text/html');
    const mainNext = documentNext.querySelector('main');
    if (!mainNext) throw new Error('The requested page does not contain a <main> element.');
    return { mainNext, title: documentNext.title };
  };

  // 4. Run a cover → swap → reveal timeline, then update browser history.
  const navigate = async (url, pushState = true) => {
    if (isTransitioning) return;
    isTransitioning = true;
    const currentMain = document.querySelector('main');

    try {
      // The wipe covers the old page before any DOM change is visible.
      await gsap.to(wipe, { yPercent: 0, duration: .65, ease: 'power4.inOut' });
      const { mainNext, title } = await fetchPage(url);

      // Replace page-specific content while keeping the shared header and footer in place.
      currentMain.replaceWith(mainNext);
      document.title = title;
      window.scrollTo(0, 0);
      if (pushState) window.history.pushState({ url }, '', url);

      // Reveal the new page by moving the panel off the top of the viewport.
      await gsap.to(wipe, { yPercent: -100, duration: .7, ease: 'power4.inOut' });
      gsap.set(wipe, { yPercent: 100 });
    } catch (error) {
      // If fetch/parsing fails, use a normal navigation so the visitor is never trapped.
      window.location.assign(url);
      return;
    } finally {
      isTransitioning = false;
    }
  };

  // 5. Intercept clicks on index.html, about.html, portfolio.html, and contact.html links.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!isTransitionLink(link, event)) return;
    event.preventDefault();
    navigate(new URL(link.href, window.location.href).href);
  });

  // 6. Make browser Back/Forward use the same fetch and wipe sequence.
  window.addEventListener('popstate', () => navigate(window.location.href, false));
});
