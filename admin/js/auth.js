const Auth = (() => {
  let accessToken = null;

  const setToken = (token) => {
    accessToken = token;
  };

  const getToken = () => accessToken;

  // Generic fetch wrapper with auth
  const fetchWithAuth = async (url, options = {}) => {
    if (!accessToken) {
      // Try to refresh token if we don't have one
      const refreshed = await refreshToken();
      if (!refreshed) {
        window.location.href = 'index.html';
        throw new Error('Not authenticated');
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      'Authorization': `Bearer ${accessToken}`
    };

    let response = await fetch(url, { ...options, headers });
    
    // If token expired, try to refresh once
    if (response.status === 401) {
      const refreshed = await refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        response = await fetch(url, { ...options, headers });
      } else {
        window.location.href = 'index.html';
        throw new Error('Session expired');
      }
    }
    
    return response;
  };

  const refreshToken = async () => {
    try {
      const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // include credentials to send the httpOnly cookie
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success && data.data && data.data.accessToken) {
        accessToken = data.data.accessToken;
        return true;
      }
    } catch (err) {
      console.error('Refresh token failed', err);
    }
    accessToken = null;
    return false;
  };

  return { setToken, getToken, fetchWithAuth, refreshToken };
})();

// Login Form Handler (only on index.html)
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  // On load, try to refresh token. If success, redirect to dashboard
  Auth.refreshToken().then(success => {
    if (success) {
      window.location.href = 'dashboard.html';
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');
    
    try {
      const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        Auth.setToken(data.data.accessToken);
        window.location.href = 'dashboard.html';
      } else {
        errorEl.textContent = data.error?.message || 'Invalid credentials';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      errorEl.textContent = 'Server error. Please try again.';
      errorEl.style.display = 'block';
    }
  });
}

// Global Logout function
window.logout = async () => {
  try {
    await fetch(`${window.APP_CONFIG.API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (err) {}
  Auth.setToken(null);
  window.location.href = 'index.html';
};
