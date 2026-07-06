const BASE = "";

async function request(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

export const api = {
  get: (path, token) => request("GET", path, null, token),
  post: (path, body, token) => request("POST", path, body, token),
  put: (path, body, token) => request("PUT", path, body, token),
  delete: (path, token) => request("DELETE", path, null, token),

  // Auth
  register: (body) => request("POST", "/auth/register", body),
  login: (body) => request("POST", "/auth/login", body),
  adminLogin: (body) => request("POST", "/auth/admin/login", body),
  refreshToken: (token) => request("POST", "/auth/refresh", null, token),
  getMe: (token) => request("GET", "/auth/me", null, token),
  getAdminMe: (token) => request("GET", "/auth/admin/me", null, token),

  // Conferences
  upcomingConferences: () => request("GET", "/api/conferences/upcoming"),
  getConference: (id) => request("GET", `/api/conferences/${id}`),
  myConferences: (token) => request("GET", "/api/conferences/", null, token),
  createConference: (body, token) => request("POST", "/api/conferences/", body, token),
  updateConference: (id, body, token) => request("PUT", `/api/conferences/${id}`, body, token),
  deleteConference: (id, token) => request("DELETE", `/api/conferences/${id}`, null, token),

  // Attendees
  registerAttendee: (confId, body) => request("POST", `/api/attendees/${confId}`, body),
  listAttendees: (confId, token) => request("GET", `/api/attendees/${confId}`, null, token),

  // Organizer profile
  updateProfile: (body, token) => request("PUT", "/api/organizers/me", body, token),
  changePassword: (body, token) => request("PUT", "/api/organizers/me/password", body, token),

  // Feedback
  submitFeedback: (body, token) => request("POST", "/api/feedback/", body, token),
  myFeedback: (token) => request("GET", "/api/feedback/mine", null, token),

  // Admin
  adminStats: (token) => request("GET", "/api/admin/stats", null, token),
  adminOrganizers: (token) => request("GET", "/api/admin/organizers", null, token),
  suspendOrganizer: (id, token) => request("PUT", `/api/admin/organizers/${id}/suspend`, null, token),
  unsuspendOrganizer: (id, token) => request("PUT", `/api/admin/organizers/${id}/unsuspend`, null, token),
  deleteOrganizer: (id, token) => request("DELETE", `/api/admin/organizers/${id}`, null, token),
  adminConferences: (token) => request("GET", "/api/admin/conferences", null, token),
  adminFeedback: (token) => request("GET", "/api/admin/feedback", null, token),
  replyFeedback: (id, body, token) => request("PUT", `/api/admin/feedback/${id}/reply`, body, token),
  resolveFeedback: (id, token) => request("PUT", `/api/admin/feedback/${id}/resolve`, null, token),
  activityLog: (token) => request("GET", "/api/admin/activity", null, token),
};
