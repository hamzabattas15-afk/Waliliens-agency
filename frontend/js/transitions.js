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
    if (url.pathname === window.location.pathname && url.hash) return false;
    return url.origin === window.location.origin && /\.html$/i.test(url.pathname) && url.href !== window.location.href;
  };

  // 3. Fetch and parse the next document, returning only its main page content.
  const fetchPage = async url => {
    const response = await fetch(url, { headers: { 'X-Requested-With': 'WaliliensTransition' } });
    if (!response.ok) throw new Error(`Unable to load ${url}`);
    const documentNext = new DOMParser().parseFromString(await response.text(), 'text/html');
    const mainNext = documentNext.querySelector('main');
    if (!mainNext) throw new Error('The requested page does not contain a <main> element.');
    return { mainNext, title: documentNext.title, documentNext };
  };

  // PJAX keeps the current document head, so load target-only styles before
  // revealing its main content (for example css/services.css).
  const syncStylesheets = async documentNext => {
    const targetHrefs = [...documentNext.querySelectorAll('link[rel="stylesheet"]')]
      .map(link => new URL(link.href, window.location.href).href);
    const existingHrefs = new Set([...document.querySelectorAll('link[rel="stylesheet"]')]
      .map(link => link.href));
    const pending = targetHrefs.filter(href => !existingHrefs.has(href));

    await Promise.all(pending.map(href => new Promise(resolve => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.pjaxStylesheet = 'true';
      link.addEventListener('load', resolve, { once: true });
      link.addEventListener('error', resolve, { once: true });
      document.head.appendChild(link);
    })));

    document.querySelectorAll('link[data-pjax-stylesheet="true"]').forEach(link => {
      if (!targetHrefs.includes(link.href)) link.remove();
    });
  };

  // PJAX keeps the current document head, so scripts declared only by the
  // target page (js/config.js, js/contact.js, Turnstile…) never run on their
  // own. Inject the missing ones with fresh <script> elements — nodes copied
  // from a DOMParser document are inert and would never execute.
  const syncScripts = async documentNext => {
    const loadedSrcs = new Set([...document.querySelectorAll('script[src]')]
      .map(script => script.src));
    const missing = [...documentNext.querySelectorAll('script[src]')]
      .map(script => ({ href: new URL(script.getAttribute('src'), window.location.href).href, async: script.async }))
      .filter(script => !loadedSrcs.has(script.href));

    for (const { href, async } of missing) {
      const script = document.createElement('script');
      script.src = href;
      script.async = async;
      if (async) {
        // async scripts (Turnstile) self-initialise on load; don't block the reveal.
        document.head.appendChild(script);
        continue;
      }
      // Sequential await keeps document order (config.js before contact.js).
      await new Promise(resolve => {
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', resolve, { once: true });
        document.head.appendChild(script);
      });
    }
  };

  // Keep the persistent header's current-page state in sync after a PJAX swap.
  const updateActiveNavigation = url => {
    const targetPath = new URL(url, window.location.href).pathname;
    document.querySelectorAll('.navbar a[aria-current="page"]').forEach(link => link.removeAttribute('aria-current'));
    document.querySelectorAll('.navbar a[href]').forEach(link => {
      if (new URL(link.href, window.location.href).pathname === targetPath) link.setAttribute('aria-current', 'page');
    });
  };

  // The intro animation only runs on a real page load. Remove only the
  // incoming home gate during PJAX so it cannot cover the swapped content.
  const preparePjaxMain = main => {
    const introGate = main.querySelector('#intro-gate.intro-gate');
    if (!introGate) return;
    introGate.remove();
    try { window.sessionStorage.setItem('waliliens-intro-seen', 'true'); } catch (error) {}
  };

  // 4. Run a cover → swap → reveal timeline, then update browser history.
  const navigate = async (url, pushState = true) => {
    if (isTransitioning) return;
    isTransitioning = true;
    const currentMain = document.querySelector('main');

    try {
      // The wipe covers the old page before any DOM change is visible.
      await gsap.to(wipe, { yPercent: 0, duration: .65, ease: 'power4.inOut' });
      const { mainNext, title, documentNext } = await fetchPage(url);

      // Make target CSS and body-scoped styles available before the new main is visible.
      await syncStylesheets(documentNext);
      preparePjaxMain(mainNext);
      currentMain.replaceWith(mainNext);
      document.body.className = documentNext.body.className;
      document.title = title;
      updateActiveNavigation(url);
      window.scrollTo(0, 0);
      if (pushState) window.history.pushState({ url }, '', url);

      // Run the target page's own scripts, then tell already-loaded page
      // scripts to re-initialise against the freshly swapped <main>.
      await syncScripts(documentNext);
      document.dispatchEvent(new CustomEvent('waliliens:pjax'));
      window.WaliliensAnimations?.refreshPage?.();

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
