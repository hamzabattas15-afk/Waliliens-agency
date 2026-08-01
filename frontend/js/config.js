window.APP_CONFIG = {
  // Use relative path for same-domain deployment, or absolute URL for external API
  API_BASE_URL:
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port !== '8080'
      ? 'http://localhost:3001'
      : '', // Docker/prod use same-origin /api through nginx.

  // Cloudflare Turnstile site key (public, safe to expose client-side).
  // Leave as '' to disable CAPTCHA on the contact form. Must stay in sync with
  // the backend's TURNSTILE_SECRET_KEY — set both together, or leave both blank.
  TURNSTILE_SITE_KEY: '',
};
