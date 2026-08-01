window.addEventListener('load', () => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion;

  const globeDots = document.querySelector('.globe-dots');
  if (globeDots) {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 26; index += 1) {
      const latitude = (-58 + (index * 37) % 116) * Math.PI / 180;
      const longitude = (index * 137.5) * Math.PI / 180;
      const radius = Math.cos(latitude) * 174;
      const x = Math.cos(longitude) * radius;
      const y = Math.sin(latitude) * 174;
      const z = Math.sin(longitude) * radius;
      const dot = document.createElement('b');
      dot.className = 'globe-dot';
      dot.style.setProperty('--dot-transform', `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px)`);
      dot.style.setProperty('--dot-size', `${(2 + (index % 3) * .7).toFixed(1)}px`);
      dot.style.opacity = (0.32 + ((z + 174) / 348) * .62).toFixed(2);
      dot.style.animationDelay = `${-(index * .17).toFixed(2)}s`;
      fragment.appendChild(dot);
    }
    globeDots.appendChild(fragment);
  }

  // Keep the page usable when the GSAP CDN is unavailable.
  if (!window.gsap) {
    document.querySelector('.preloader')?.classList.add('is-hidden');
    const header = document.querySelector('.site-header');
    if (header) { header.style.opacity = '1'; header.style.pointerEvents = 'auto'; }
    return;
  }

  // Custom cursor and magnetic hero CTA.
  const cursor = document.querySelector('.cursor-dot');
  if (cursor && canHover) {
    let x = -50, y = -50, targetX = -50, targetY = -50;
    const followCursor = () => {
      x += (targetX - x) * .18;
      y += (targetY - y) * .18;
      cursor.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      requestAnimationFrame(followCursor);
    };
    window.addEventListener('pointermove', event => { targetX = event.clientX; targetY = event.clientY; });
    followCursor();
    document.querySelectorAll('a, button, select').forEach(element => {
      element.addEventListener('pointerenter', () => cursor.classList.add('is-hovering'));
      element.addEventListener('pointerleave', () => cursor.classList.remove('is-hovering'));
    });
  }

  document.querySelectorAll('.hero .button').forEach(button => {
    button.addEventListener('pointermove', event => {
      if (!canHover) return;
      const bounds = button.getBoundingClientRect();
      const x = (event.clientX - bounds.left - bounds.width / 2) * .18;
      const y = (event.clientY - bounds.top - bounds.height / 2) * .22;
      button.style.transform = `translate(${x}px, ${y}px)`;
    });
    button.addEventListener('pointerleave', () => { button.style.transform = ''; });
  });

  // Build a lightweight starfield once. CSS handles every twinkle afterwards;
  // pointer movement updates only the layer transform rather than every star.
  const starfields = document.querySelectorAll('.starfield');
  if (starfields.length && !reducedMotion) {
    const stars = document.createDocumentFragment();
    const colors = ['#F1F3F9', '#5EEAD4', '#3B5FE0'];
    for (let index = 0; index < 130; index += 1) {
      const star = document.createElement('i');
      star.style.setProperty('--x', `${Math.random() * 100}%`);
      star.style.setProperty('--y', `${Math.random() * 100}%`);
      star.style.setProperty('--size', `${(Math.random() * 1.8 + .7).toFixed(2)}px`);
      star.style.setProperty('--opacity', (Math.random() * .55 + .22).toFixed(2));
      star.style.setProperty('--duration', `${(Math.random() * 7 + 7).toFixed(1)}s`);
      star.style.setProperty('--delay', `${-(Math.random() * 10).toFixed(1)}s`);
      star.style.setProperty('--star-color', colors[index % colors.length]);
      stars.appendChild(star);
    }
    starfields.forEach(starfield => starfield.appendChild(stars.cloneNode(true)));
    if (canHover && !isMobile) {
      const scene = document.querySelector('.intro-gate');
      scene.addEventListener('pointermove', event => {
        const bounds = scene.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - .5;
        const y = (event.clientY - bounds.top) / bounds.height - .5;
        starfields.forEach(starfield => { starfield.style.transform = `translate3d(${x * -13}px, ${y * -10}px, 0)`; });
      });
      scene.addEventListener('pointerleave', () => starfields.forEach(starfield => { starfield.style.transform = ''; }));
    }
  }

  // Legacy canvas particles are optional; the hero now uses the CSS starfield.
  const canvas = document.querySelector('.hero-particles');
  if (canvas && canHover && !isMobile) {
    const context = canvas.getContext('2d');
    let particles = [];
    const createParticles = () => {
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = bounds.width * scale;
      canvas.height = bounds.height * scale;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      particles = Array.from({ length: Math.max(30, Math.floor(bounds.width / 22)) }, () => ({
        x: Math.random() * bounds.width, y: Math.random() * bounds.height,
        size: Math.random() * 2 + .4, speed: Math.random() * .22 + .04,
        drift: (Math.random() - .5) * .18, color: Math.random() > .5 ? '94,234,212' : '59,95,224'
      }));
    };
    const renderParticles = () => {
      const bounds = canvas.getBoundingClientRect();
      context.clearRect(0, 0, bounds.width, bounds.height);
      particles.forEach(particle => {
        particle.y = particle.y < -5 ? bounds.height + 5 : particle.y - particle.speed;
        particle.x += particle.drift;
        if (particle.x < -5) particle.x = bounds.width + 5;
        if (particle.x > bounds.width + 5) particle.x = -5;
        context.beginPath();
        context.fillStyle = `rgba(${particle.color}, .5)`;
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      });
      requestAnimationFrame(renderParticles);
    };
    createParticles();
    renderParticles();
    window.addEventListener('resize', createParticles);
  }

  if (reducedMotion) {
    document.querySelector('.preloader')?.classList.add('is-hidden');
    const header = document.querySelector('.site-header');
    if (header) { header.style.opacity = '1'; header.style.pointerEvents = 'auto'; }
    return;
  }

  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  // Lenis and ScrollTrigger share the same animation frame/ticker.
  if (window.Lenis) {
    const lenis = new Lenis({ lerp: .09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const preloader = document.querySelector('.preloader');
  const counter = { value: 0 };
  const introGate = document.querySelector('.intro-gate');
  const introSkipButton = document.querySelector('.intro-gate__skip');
  let introTimeline = null;
  let introAlreadySeen = false;
  try {
    introAlreadySeen = window.sessionStorage.getItem('waliliens-intro-seen') === 'true';
  } catch (error) {
    introAlreadySeen = false;
  }
  const introShouldPlay = !introAlreadySeen && !reducedMotion;
  const finishIntro = () => {
    try { window.sessionStorage.setItem('waliliens-intro-seen', 'true'); } catch (error) {}
    introGate?.classList.add('is-hidden');
    preloader?.classList.add('is-hidden');
    document.querySelector('.site-header')?.style.setProperty('opacity', '1');
    document.querySelector('.site-header')?.style.setProperty('pointer-events', 'auto');
    ScrollTrigger.refresh();
  };

  if (introSkipButton) {
    introSkipButton.addEventListener('click', () => {
      if (introTimeline) introTimeline.kill();
      finishIntro();
    });
  }

  if (!introShouldPlay) {
    if (preloader) preloader.classList.add('is-hidden');
    introGate?.classList.add('is-hidden');
    document.querySelector('.site-header')?.style.setProperty('opacity', '1');
    document.querySelector('.site-header')?.style.setProperty('pointer-events', 'auto');
    ScrollTrigger.refresh();
  } else {
    introTimeline = gsap.timeline();
    gsap.from('.intro-gate__caption', { y: 10, opacity: 0, duration: .45, delay: .15, ease: 'power3.out' });
    introTimeline
      .from('.preloader__logo', { scale: .7, opacity: 0, duration: .3, ease: 'back.out(1.8)' })
      .from('.preloader__wordmark, .preloader__counter', { y: 10, opacity: 0, duration: .24, stagger: .05 }, '-=.08')
      .to(counter, { value: 100, duration: .55, ease: 'power2.inOut', onUpdate: () => { document.querySelector('.preloader__counter span').textContent = Math.round(counter.value); } }, '-=.07')
      .to(preloader, { autoAlpha: 0, yPercent: -100, duration: .5, ease: 'power4.inOut', onComplete: () => preloader.classList.add('is-hidden') })
      .to({}, { duration: .2 })
      .to('.intro-gate__door-mask--left', { xPercent: -100, duration: .7, ease: 'power4.inOut' })
      .to('.intro-gate__door-mask--right', { xPercent: 100, duration: .7, ease: 'power4.inOut' }, '<')
      .to('.intro-gate', {
        autoAlpha: 0,
        scale: .96,
        duration: .55,
        transformOrigin: '50% 50%',
        ease: 'power4.inOut',
        onComplete: finishIntro
      })
      .to('.site-header', { autoAlpha: 1, pointerEvents: 'auto', duration: .25, ease: 'power3.out' })
      .from('.hero__eyebrow', { y: 20, opacity: 0, duration: .35, ease: 'power3.out' }, '-=.12')
      .from('.hero-title__word', { yPercent: 115, rotate: 3, opacity: 0, duration: .5, stagger: .08, ease: 'power4.out' }, '-=.15')
      .from('.hero__copy, .hero__bottom', { y: 28, opacity: 0, duration: .4, stagger: .08, ease: 'power3.out' }, '-=.2');
  }

  const initPageAnimations = () => {
    // Split section headings into word spans without changing their accessible text.
    const splitHeading = heading => {
      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(node => {
        if (!node.nodeValue.trim()) return;
        const fragment = document.createDocumentFragment();
        node.nodeValue.split(/(\s+)/).forEach(token => {
          if (/\s+/.test(token)) fragment.appendChild(document.createTextNode(token));
          else { const word = document.createElement('span'); word.className = 'heading-word'; word.textContent = token; fragment.appendChild(word); }
        });
        node.parentNode.replaceChild(fragment, node);
      });
      return heading.querySelectorAll('.heading-word');
    };

    document.querySelectorAll('.section-heading h2, .process h2, .contact h2').forEach(heading => {
      const words = splitHeading(heading);
      gsap.from(words, { yPercent: 110, opacity: 0, stagger: .055, duration: .72, ease: 'power4.out', scrollTrigger: { trigger: heading, start: 'top 84%', once: true } });
    });

    const serviceGrid = document.querySelector('.service-grid');
    if (serviceGrid) gsap.from('.service-card', { y: 70, opacity: 0, stagger: .18, duration: .85, ease: 'power3.out', scrollTrigger: { trigger: serviceGrid, start: 'top 82%', once: true } });

    gsap.utils.toArray('.project__visual').forEach(visual => {
      gsap.fromTo(visual, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.05, ease: 'power4.inOut', scrollTrigger: { trigger: visual, start: 'top 84%', once: true } });
    });
    const workGrid = document.querySelector('.work-grid');
    if (workGrid) gsap.from('.project__meta', { y: 22, opacity: 0, stagger: .12, duration: .55, ease: 'power3.out', scrollTrigger: { trigger: workGrid, start: 'top 76%', once: true } });

    if (canHover && !reducedMotion) {
      document.querySelectorAll('.service-card').forEach(card => {
        card.style.transformStyle = 'preserve-3d';
        card.addEventListener('pointermove', event => {
          const bounds = card.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width - .5;
          const y = (event.clientY - bounds.top) / bounds.height - .5;
          gsap.to(card, { rotationY: x * 8, rotationX: y * -8, transformPerspective: 900, duration: .35, ease: 'power2.out', overwrite: 'auto' });
        });
        card.addEventListener('pointerleave', () => gsap.to(card, { rotationX: 0, rotationY: 0, duration: .6, ease: 'elastic.out(1, .45)' }));
      });
    }

    gsap.utils.toArray('.process__intro, .steps article, .contact__grid > *').forEach(element => {
      gsap.from(element, { y: 35, opacity: 0, duration: .75, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 88%', once: true } });
    });
    ScrollTrigger.refresh();
  };

  window.WaliliensAnimations = {
    refreshPage: () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
      initPageAnimations();
    }
  };
  initPageAnimations();
});
