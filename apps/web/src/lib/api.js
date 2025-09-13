export const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

/**
 * POST JSON (auth by default)
 * usage: postJson('/auth/login', body, { auth: false })
 */
export async function postJson(path, body, opts = { auth: true }) {
  const headers = { 'Content-Type': 'application/json' };
  if (opts.auth !== false) {
    const t = localStorage.getItem('ps_token');
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

/** GET JSON (auth by default) */
export async function getJson(path, opts = { auth: true }) {
  const headers = {};
  if (opts.auth !== false) {
    const t = localStorage.getItem('ps_token');
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  const res = await fetch(`${API_URL}${path}`, { headers });
  return res.json();
}
