const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem('ms_auth') || 'null');
  } catch {
    return null;
  }
}

export function setAuth(auth) {
  if (auth) localStorage.setItem('ms_auth', JSON.stringify(auth));
  else localStorage.removeItem('ms_auth');
}

export function getToken() {
  return getAuth()?.token || null;
}

export function getRole() {
  return getAuth()?.role || null;
}

export function getUser() {
  return getAuth()?.user || null;
}

async function request(path, { method = 'GET', body, isForm = false, auth = true } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

// Fetches a binary response (SVG/ZIP) with the auth header and triggers a
// browser download, since these routes are admin-protected and can't be
// linked to directly with a plain <a href>.
async function downloadBlob(path, filenameHint) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data?.message || message;
    } catch {
      // ignore — body wasn't JSON
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || filenameHint || 'download';

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  // Auth
  loginAdmin: (username, password) =>
    request('/auth/admin/login', { method: 'POST', body: { username, password }, auth: false }),
  loginSupervisor: (phone, password) =>
    request('/auth/supervisor/login', { method: 'POST', body: { phone, password }, auth: false }),
  loginContractor: (username, password) =>
    request('/auth/contractor/login', { method: 'POST', body: { username, password }, auth: false }),

  // Contractor dashboard
  getContractorMe: () => request('/contractor/me'),
  getContractorSupervisors: () => request('/contractor/supervisors'),
  createContractorSupervisor: (payload) => request('/contractor/supervisors', { method: 'POST', body: payload }),
  updateContractorSupervisor: (id, payload) => request(`/contractor/supervisors/${id}`, { method: 'PATCH', body: payload }),
  deactivateContractorSupervisor: (id) => request(`/contractor/supervisors/${id}/deactivate`, { method: 'PATCH' }),
  getContractorWorkOrders: () => request('/contractor/work-orders'),

  // Work orders
  createWorkOrder: (body) => request('/work-orders', { method: 'POST', body }),
  getWorkOrders: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return request(`/work-orders${qs ? `?${qs}` : ''}`);
  },
  getWorkOrder: (id) => request(`/work-orders/${id}`),
  updateWorkOrder: (id, body) => request(`/work-orders/${id}`, { method: 'PATCH', body }),
  deleteWorkOrder: (id) => request(`/work-orders/${id}`, { method: 'DELETE' }),

  // Reference data
  getReferenceContractors: () => request('/reference/contractors'),
  getReferenceManholes: (ward) => request(`/reference/manholes${ward ? `?ward=${encodeURIComponent(ward)}` : ''}`),
  getReferenceSupervisors: (contractorId) =>
    request(`/reference/supervisors${contractorId ? `?contractor_id=${contractorId}` : ''}`),
  updateManholeLocation: (id, lat, lng) =>
    request(`/admin/manholes/${id}/location`, { method: 'PATCH', body: { lat, lng } }),

  // Permit (supervisor)
  openPermit: (formData) => request('/supervisor/permit/open', { method: 'POST', body: formData, isForm: true }),
  exitPermit: (formData) => request('/supervisor/permit/exit', { method: 'POST', body: formData, isForm: true }),
  resolvePermit: (id, admin_resolution_note) =>
    request(`/supervisor/permit/${id}/resolve`, { method: 'POST', body: { admin_resolution_note } }),
  getPermitByWorkOrder: (workOrderId) => request(`/supervisor/permit/by-work-order/${workOrderId}`),

  // QR scan resolution — pure identity lookup, no auth, no permit-opening
  // authority. Real authorization happens server-side inside openPermit/exitPermit.
  resolveScan: (qrToken) => request(`/scan/${encodeURIComponent(qrToken)}`, { auth: false }),

  // Admin QR generation — these are protected routes returning binary
  // (SVG/ZIP) rather than JSON, so they go through a raw authenticated
  // fetch + blob download instead of the JSON `request` helper.
  downloadQrLabel: (manholeId, filenameHint) => downloadBlob(`/admin/qr/manhole/${manholeId}`, filenameHint),
  downloadQrBulk: () => downloadBlob('/admin/qr/bulk', 'manhole-qr-labels.zip'),

  // Public
  getPermitPreview: (token) => request(`/public/permit/confirm/${token}`, { method: 'GET', auth: false }),
  confirmPermit: (token) =>
    request(`/public/permit/confirm/${token}`, { method: 'POST', auth: false }),
};

export { API_URL };
