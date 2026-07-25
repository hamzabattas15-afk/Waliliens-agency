window.APP_CONFIG = {
  // Use relative path for same-domain deployment, or absolute URL for external API
  API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3001' 
    : '' // In production, we assume the API is at /api via reverse proxy, or set to 'https://api.waliliens.com'
};
