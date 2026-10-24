const API_BASE = import.meta.env.VITE_API_URL || '';

let cachedCsrfToken = null;

export async function fetchCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/csrf-token`, { credentials: 'include' });
    const data = await res.json();
    if (data.success && data.csrfToken) {
      cachedCsrfToken = data.csrfToken;
      return data.csrfToken;
    }
  } catch (err) {
    console.warn('Could not fetch CSRF token:', err);
  }
  return null;
}

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  const headers = { ...options.headers };

  // Attach CSRF token on mutating requests
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    if (!cachedCsrfToken) {
      await fetchCsrfToken();
    }
    if (cachedCsrfToken) {
      headers['x-csrf-token'] = cachedCsrfToken;
    }
  }

  // If body is NOT FormData, set JSON Content-Type
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// Auth API
export const authApi = {
  getCsrf: fetchCsrfToken,
  signup: (payload) => apiRequest('/api/auth/signup', { method: 'POST', body: payload }),
  verifyEmail: (payload) => apiRequest('/api/auth/verify-email', { method: 'POST', body: payload }),
  resendVerification: (payload) => apiRequest('/api/auth/resend-verification', { method: 'POST', body: payload }),
  login: async (payload) => {
    const res = await apiRequest('/api/auth/login', { method: 'POST', body: payload });
    if (res.data?.csrfToken) cachedCsrfToken = res.data.csrfToken;
    return res;
  },
  logout: async () => {
    const res = await apiRequest('/api/auth/logout', { method: 'POST' });
    cachedCsrfToken = null;
    return res;
  },
  getMe: () => apiRequest('/api/auth/me'),
  forgotPassword: (payload) => apiRequest('/api/auth/forgot-password', { method: 'POST', body: payload }),
  resetPassword: (payload) => apiRequest('/api/auth/reset-password', { method: 'POST', body: payload }),
};

// Workspaces API
export const workspaceApi = {
  list: () => apiRequest('/api/workspaces'),
  create: (payload) => apiRequest('/api/workspaces', { method: 'POST', body: payload }),
  get: (id) => apiRequest(`/api/workspaces/${id}`),
};

// Campaigns API
export const campaignApi = {
  list: () => apiRequest('/api/campaigns'),
  get: (id) => apiRequest(`/api/campaigns/${id}`),
  create: (payload) => apiRequest('/api/campaigns', { method: 'POST', body: payload }),
  update: (id, payload) => apiRequest(`/api/campaigns/${id}`, { method: 'PATCH', body: payload }),
  invite: (id, payload) => apiRequest(`/api/campaigns/${id}/invitations`, { method: 'POST', body: payload }),
  getActivity: (id) => apiRequest(`/api/campaigns/${id}/activity`),
  consentShowcase: (id, payload) => apiRequest(`/api/campaigns/${id}/consent-showcase`, { method: 'POST', body: payload }),
};

// Briefs API
export const briefApi = {
  list: (campaignId) => apiRequest(`/api/campaigns/${campaignId}/briefs`),
  get: (campaignId, briefId) => apiRequest(`/api/campaigns/${campaignId}/briefs/${briefId}`),
  upload: (campaignId, formData) => apiRequest(`/api/campaigns/${campaignId}/briefs`, { method: 'POST', body: formData }),
  ask: (campaignId, query, revisionNumber) =>
    apiRequest(`/api/campaigns/${campaignId}/briefs/ask`, {
      method: 'POST',
      body: { query, revisionNumber },
    }),
};

// Assets API
export const assetApi = {
  list: (campaignId, type) =>
    apiRequest(`/api/campaigns/${campaignId}/assets${type ? `?type=${type}` : ''}`),
  search: (campaignId, params) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/api/campaigns/${campaignId}/assets/search?${q}`);
  },
  upload: (campaignId, formData) => apiRequest(`/api/campaigns/${campaignId}/assets`, { method: 'POST', body: formData }),
  get: (campaignId, assetId) => apiRequest(`/api/campaigns/${campaignId}/assets/${assetId}`),
  update: (campaignId, assetId, payload) =>
    apiRequest(`/api/campaigns/${campaignId}/assets/${assetId}`, { method: 'PATCH', body: payload }),
  downloadUrl: (campaignId, assetId) => `${API_BASE}/api/campaigns/${campaignId}/assets/${assetId}/download`,
};

// Versions API
export const versionApi = {
  list: (campaignId) => apiRequest(`/api/campaigns/${campaignId}/versions`),
  get: (versionId) => apiRequest(`/api/versions/${versionId}`),
  create: (campaignId, payload) =>
    apiRequest(`/api/campaigns/${campaignId}/versions`, { method: 'POST', body: payload }),
  compare: (v1, v2) => apiRequest(`/api/versions/compare?v1=${v1}&v2=${v2}`),
  recordDecision: (versionId, payload) =>
    apiRequest(`/api/versions/${versionId}/decision`, { method: 'POST', body: payload }),
};

// Comments API
export const commentApi = {
  list: (versionId) => apiRequest(`/api/versions/${versionId}/comments`),
  add: (versionId, payload) => apiRequest(`/api/versions/${versionId}/comments`, { method: 'POST', body: payload }),
};

// Tasks API
export const taskApi = {
  list: (campaignId) => apiRequest(`/api/campaigns/${campaignId}/tasks`),
  create: (campaignId, payload) => apiRequest(`/api/campaigns/${campaignId}/tasks`, { method: 'POST', body: payload }),
  update: (taskId, payload) => apiRequest(`/api/tasks/${taskId}`, { method: 'PATCH', body: payload }),
  batchApplyProposed: (campaignId, proposedTasks) =>
    apiRequest(`/api/campaigns/${campaignId}/tasks/batch-apply-proposed`, {
      method: 'POST',
      body: { proposedTasks },
    }),
};

// Chat & AI Production Agent API
export const aiApi = {
  sendChat: (campaignId, message, conversationId) =>
    apiRequest('/api/campaign-chat', {
      method: 'POST',
      body: { campaignId, message, conversationId },
    }),
  getChatHistory: (campaignId) => apiRequest(`/api/campaign-chat/${campaignId}/history`),
  runProductionAgent: (campaignId, query, targetDate) =>
    apiRequest('/api/production-agent', {
      method: 'POST',
      body: { campaignId, query, targetDate },
    }),
};

// Showcase API (Public)
export const showcaseApi = {
  list: () => apiRequest('/api/showcase'),
  get: (slug) => apiRequest(`/api/showcase/${slug}`),
};

// Invitations API
export const invitationApi = {
  list: () => apiRequest('/api/invitations'),
  accept: (token) => apiRequest(`/api/invitations/${token}/accept`, { method: 'POST' }),
};
