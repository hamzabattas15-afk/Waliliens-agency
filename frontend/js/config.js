window.APP_CONFIG = {
  // Use relative path for same-domain deployment, or absolute URL for external API
  API_BASE_URL:
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port !== '8080'
      ? 'http://localhost:3001'
      : '' // Docker/prod use same-origin /api through nginx.
};
