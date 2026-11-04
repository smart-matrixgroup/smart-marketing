const BASE = 'http://127.0.0.1:4010';
export const getToken = () => localStorage.getItem('smart_token') || sessionStorage.getItem('smart_token');
export const setToken = (t, remember) => {
  localStorage.removeItem('smart_token'); sessionStorage.removeItem('smart_token');
  if (t) (remember ? localStorage : sessionStorage).setItem('smart_token', t);
};
async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const t = getToken(); if (t) headers.Authorization = 'Bearer ' + t;
  let body = opts.body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const r = await fetch(BASE + '/api' + path, { ...opts, headers, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Request failed'), { status: r.status });
  return j;
}
export const api = {
  get: (p) => req(p),
  post: (p, b) => req(p, { method: 'POST', body: b || {} }),
  put: (p, b) => req(p, { method: 'PUT', body: b }),
  del: (p) => req(p, { method: 'DELETE' }),
  upload: (files) => { const f = new FormData(); [...files].forEach((x) => f.append('files', x)); return req('/upload', { method: 'POST', body: f }); }
};
export const mediaUrl = (p) => BASE + '/uploads/' + p.split(/[\\/]/).pop();
