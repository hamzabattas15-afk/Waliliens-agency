// Opening these files directly as file:// (no local server) leaves
// window.location.hostname empty, so API_BASE_URL below would resolve to ''
// and every fetch would hit a nonexistent relative path on disk.
if (window.location.protocol === 'file:') {
  console.warn(
    'Waliliens: this page was opened via file://, so API calls will fail. ' +
    'Serve the frontend/ directory over HTTP (e.g. `npx http-server` or `python3 -m http.server`) instead.'
  );
}

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
