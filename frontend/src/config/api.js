const rawBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();

export const API_BASE = (rawBase || '/api').replace(/\/+$/, '');

export const apiUrl = (path = '') => {
  const safePath = String(path || '').startsWith('/') ? path : `/${String(path || '')}`;
  return `${API_BASE}${safePath}`;
};
