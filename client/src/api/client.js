/**
 * Thin fetch wrapper around the CineBook API.
 *
 * - attaches the bearer token when we have one
 * - unwraps the { data, meta } envelope
 * - turns { error: { code, message, details } } into a thrown ApiError
 */
const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'cinebook.token';

export class ApiError extends Error {
  constructor(status, body) {
    const info = (body && body.error) || {};
    super(info.message || `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = info.code || 'ERROR';
    this.details = info.details;
  }

  /** { fieldName: 'message' } for 422 responses, so forms can show inline errors. */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return this.details.reduce((acc, d) => ({ ...acc, [d.field]: d.message }), {});
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Called when the API reports the session is no longer valid. */
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function request(path, { method = 'GET', body, params, signal } = {}) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }

  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url.toString().replace(window.location.origin, ''), {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, {
      error: { code: 'NETWORK_ERROR', message: 'Cannot reach the server. Is the API running?' },
    });
  }

  if (res.status === 204) return null;

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new ApiError(res.status, payload);
    if (res.status === 401 && token) onUnauthorized(error);
    throw error;
  }

  return payload;
}

const unwrap = (p) => p.then((r) => (r ? r.data : null));

export const api = {
  raw: request,

  health: () => unwrap(request('/health')),

  auth: {
    register: (body) => unwrap(request('/auth/register', { method: 'POST', body })),
    login: (body) => unwrap(request('/auth/login', { method: 'POST', body })),
    me: () => unwrap(request('/auth/me')),
    updateMe: (body) => unwrap(request('/auth/me', { method: 'PATCH', body })),
    changePassword: (body) => unwrap(request('/auth/change-password', { method: 'POST', body })),
  },

  movies: {
    list: (params, signal) => request('/movies', { params, signal }),
    get: (idOrSlug) => unwrap(request(`/movies/${idOrSlug}`)),
    filters: () => unwrap(request('/movies/meta/filters')),
    create: (body) => unwrap(request('/movies', { method: 'POST', body })),
    update: (id, body) => unwrap(request(`/movies/${id}`, { method: 'PATCH', body })),
    remove: (id) => request(`/movies/${id}`, { method: 'DELETE' }),
    reviews: (id, params) => request(`/movies/${id}/reviews`, { params }),
    addReview: (id, body) => unwrap(request(`/movies/${id}/reviews`, { method: 'POST', body })),
  },

  reviews: {
    update: (id, body) => unwrap(request(`/reviews/${id}`, { method: 'PATCH', body })),
    remove: (id) => request(`/reviews/${id}`, { method: 'DELETE' }),
  },

  theaters: {
    list: (params) => unwrap(request('/theaters', { params })),
    get: (id) => unwrap(request(`/theaters/${id}`)),
    create: (body) => unwrap(request('/theaters', { method: 'POST', body })),
    update: (id, body) => unwrap(request(`/theaters/${id}`, { method: 'PATCH', body })),
    remove: (id) => request(`/theaters/${id}`, { method: 'DELETE' }),
    addScreen: (id, body) => unwrap(request(`/theaters/${id}/screens`, { method: 'POST', body })),
    removeScreen: (id, screenId) =>
      request(`/theaters/${id}/screens/${screenId}`, { method: 'DELETE' }),
  },

  showtimes: {
    list: (params, signal) => unwrap(request('/showtimes', { params, signal })),
    get: (id) => unwrap(request(`/showtimes/${id}`)),
    create: (body) => unwrap(request('/showtimes', { method: 'POST', body })),
    update: (id, body) => unwrap(request(`/showtimes/${id}`, { method: 'PATCH', body })),
    cancel: (id) => unwrap(request(`/showtimes/${id}/cancel`, { method: 'POST' })),
    remove: (id) => request(`/showtimes/${id}`, { method: 'DELETE' }),
  },

  bookings: {
    create: (body) => unwrap(request('/bookings', { method: 'POST', body })),
    mine: (params) => request('/bookings/me', { params }),
    all: (params) => request('/bookings', { params }),
    get: (id) => unwrap(request(`/bookings/${id}`)),
    cancel: (id, body = {}) => unwrap(request(`/bookings/${id}/cancel`, { method: 'PATCH', body })),
  },

  admin: {
    stats: () => unwrap(request('/admin/stats')),
    users: (params) => request('/admin/users', { params }),
    setRole: (id, role) => unwrap(request(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } })),
  },
};

export default api;
