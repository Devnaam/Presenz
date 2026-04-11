import api from './api';


// ─────────────────────────────────────────────────────────────────
// Auth APIs — UNCHANGED
// ─────────────────────────────────────────────────────────────────
export const authService = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  register: async (name: string, email: string, password: string, phone: string) => {
    const response = await api.post('/auth/register', { name, email, password, phone });
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  changePassword: (userId: string, currentPassword: string, newPassword: string) =>
    api.patch('/auth/change-password', { userId, currentPassword, newPassword }),
};


// ─────────────────────────────────────────────────────────────────
// Session APIs — UNCHANGED
// ─────────────────────────────────────────────────────────────────
export const sessionService = {
  createSession: async (userId: string) => {
    const response = await api.post('/session/create', { userId });
    return response.data;
  },
  getQR: async (userId: string) => {
    const response = await api.get(`/session/qr?userId=${userId}`);
    return response.data;
  },
  getStatus: async (userId: string) => {
    const response = await api.get(`/session/status?userId=${userId}`);
    return response.data;
  },
  disconnect: async (userId: string) => {
    const response = await api.delete('/session/disconnect', { data: { userId } });
    return response.data;
  },
};


// ─────────────────────────────────────────────────────────────────
// Personality APIs — UNCHANGED
// ─────────────────────────────────────────────────────────────────
export const personalityService = {
  uploadChat: async (userId: string, contactId: string, studentName: string, file: File) => {
    const formData = new FormData();
    formData.append('chatFile', file);
    formData.append('userId', userId);
    formData.append('contactId', contactId);
    formData.append('studentName', studentName);
    const response = await api.post('/personality/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  getStatus: async (userId: string, contactId: string) => {
    const response = await api.get(`/personality/status?userId=${userId}&contactId=${contactId}`);
    return response.data;
  },
  testPersonality: async (userId: string, contactId: string, message: string) => {
    const response = await api.post('/personality/test', { userId, contactId, message });
    return response.data;
  },
  saveKnowledgeBase: async (userId: string, contactId: string, knowledgeBase: string) => {
    const response = await api.patch('/personality/knowledge-base', { userId, contactId, knowledgeBase });
    return response.data;
  },
  getKnowledgeBase: async (userId: string, contactId: string) => {
    const response = await api.get(`/personality/knowledge-base?userId=${userId}&contactId=${contactId}`);
    return response.data;
  },
  enhanceContext: async (roughText: string, contactName: string, relation: string) => {
    const response = await api.post('/personality/enhance-context', { roughText, contactName, relation });
    return response.data;
  },
};


// ─────────────────────────────────────────────────────────────────
// Contact APIs — UNCHANGED
// ─────────────────────────────────────────────────────────────────
export const contactService = {
  getAll: async (userId: string) => {
    const response = await api.get(`/contacts?userId=${userId}`);
    return response.data;
  },
  create: async (userId: string, name: string, phone: string, relation: string) => {
    const response = await api.post('/contacts', { userId, name, phone, relation });
    return response.data;
  },
  update: async (contactId: string, name: string, phone: string, relation: string) => {
    const response = await api.patch(`/contacts/${contactId}`, { name, phone, relation });
    return response.data;
  },
  toggle: async (contactId: string) => {
    const response = await api.patch(`/contacts/${contactId}/toggle`);
    return response.data;
  },
  delete: async (contactId: string) => {
    const response = await api.delete(`/contacts/${contactId}`);
    return response.data;
  },
};


// ─────────────────────────────────────────────────────────────────
// Status APIs — UNCHANGED
// ─────────────────────────────────────────────────────────────────
export const statusService = {
  get: async (userId: string) => {
    const response = await api.get(`/status?userId=${userId}`);
    return response.data;
  },
  setMode: async (userId: string, mode: 'available' | 'away') => {
    const response = await api.patch('/status/mode', { userId, mode });
    return response.data;
  },
  updateSettings: async (userId: string, autoAwayEnabled: boolean, autoAwayMinutes: number) => {
    const response = await api.patch('/status/settings', { userId, autoAwayEnabled, autoAwayMinutes });
    return response.data;
  },
  updateActivity: async (userId: string) => {
    const response = await api.post('/status/activity', { userId });
    return response.data;
  },
};


// ─────────────────────────────────────────────────────────────────
// Conversation APIs — UNCHANGED
// ─────────────────────────────────────────────────────────────────
export const conversationService = {
  getAll: async (userId: string) => {
    const response = await api.get(`/conversations?userId=${userId}`);
    return response.data;
  },
  getMessages: async (userId: string, contactId: string, limit = 50, skip = 0) => {
    const response = await api.get(`/conversations/${contactId}?userId=${userId}&limit=${limit}&skip=${skip}`);
    return response.data;
  },
  sendMessage: async (userId: string, contactId: string, message: string) => {
    const response = await api.post('/conversations/send', { userId, contactId, message });
    return response.data;
  },
  getAILog: async (userId: string, days = 1) => {
    const response = await api.get(`/conversations/ai-log/all?userId=${userId}&days=${days}`);
    return response.data;
  },
};


// ─────────────────────────────────────────────────────────────────
// Dashboard APIs — UNCHANGED
// ─────────────────────────────────────────────────────────────────
export const dashboardService = {
  getSummary: async (userId: string, period: 'today' | '7days' | '30days' = 'today') => {
    const response = await api.get(`/dashboard/summary?userId=${userId}&period=${period}`);
    return response.data;
  },
};


// ─────────────────────────────────────────────────────────────────
// Subscription APIs — UPDATED
// Method renames: get → getSubscription, cancel → cancelSubscription
// Plan type: 'basic' | 'pro' → 'pro' | 'business'
// New methods: activateTrial, getSubscription, cancelSubscription
// ─────────────────────────────────────────────────────────────────
export const subscriptionService = {

  // GET /api/v1/subscription?userId=...
  getSubscription: async (userId: string) => {
    const response = await api.get(`/subscription?userId=${userId}`);
    return response.data;
  },

  // POST /api/v1/subscription/activate-trial
  activateTrial: async (userId: string, referralCode?: string) => {
    const response = await api.post('/subscription/activate-trial', {
      userId,
      ...(referralCode ? { referralCode } : {}),
    });
    return response.data;
  },

  // POST /api/v1/subscription/create-order
  createOrder: async (userId: string, plan: 'pro' | 'business') => {
    const response = await api.post('/subscription/create-order', { userId, plan });
    return response.data;
  },

  // POST /api/v1/subscription/verify-payment
  verifyPayment: async (
    userId: string,
    orderId: string,
    paymentId: string,
    signature: string,
    plan: 'pro' | 'business'
  ) => {
    const response = await api.post('/subscription/verify-payment', {
      userId,
      orderId,
      paymentId,
      signature,
      plan,
    });
    return response.data;
  },

  // DELETE /api/v1/subscription/cancel
  cancelSubscription: async (userId: string) => {
    const response = await api.delete('/subscription/cancel', { data: { userId } });
    return response.data;
  },
};


// ─────────────────────────────────────────────────────────────────
// Profile APIs — UNCHANGED
// ─────────────────────────────────────────────────────────────────
export const profileService = {
  getProfile: (userId: string) =>
    api.get(`/profile?userId=${userId}`),

  updateBasic: (userId: string, data: { name: string; email: string; phone: string }) =>
    api.patch(`/profile/${userId}/basic`, data),

  updateProfile: (userId: string, data: {
    aboutMe: string;
    aiLanguage: string;
    aiTone: string;
    aiLength: string;
  }) =>
    api.patch(`/profile/${userId}`, data),
};


// ─────────────────────────────────────────────────────────────────
// Activity APIs — UPDATED
// ─────────────────────────────────────────────────────────────────
export const activityService = {
  getActivity: (userId: string, page = 1) =>
    api.get(`/activity?userId=${userId}&page=${page}&limit=20`),
};