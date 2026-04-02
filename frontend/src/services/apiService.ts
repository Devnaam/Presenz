import api from './api';


// Auth APIs — UNCHANGED
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
};


// Session APIs — UNCHANGED
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


// Personality APIs — UNCHANGED
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


// Contact APIs — CHANGED: update method added
export const contactService = {
  getAll: async (userId: string) => {
    const response = await api.get(`/contacts?userId=${userId}`);
    return response.data;
  },
  create: async (userId: string, name: string, phone: string, relation: string) => {
    const response = await api.post('/contacts', { userId, name, phone, relation });
    return response.data;
  },
  // NEW
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


// Status APIs — UNCHANGED
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


// Conversation APIs — UNCHANGED
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


// Dashboard APIs — UNCHANGED
export const dashboardService = {
  getSummary: async (userId: string) => {
    const response = await api.get(`/dashboard/summary?userId=${userId}`);
    return response.data;
  },
};


// Subscription APIs — UNCHANGED
export const subscriptionService = {
  get: async (userId: string) => {
    const response = await api.get(`/subscription?userId=${userId}`);
    return response.data;
  },
  createOrder: async (userId: string, plan: 'basic' | 'pro') => {
    const response = await api.post('/subscription/create-order', { userId, plan });
    return response.data;
  },
  verifyPayment: async (
    userId: string,
    orderId: string,
    paymentId: string,
    signature: string,
    plan: 'basic' | 'pro'
  ) => {
    const response = await api.post('/subscription/verify-payment', {
      userId, orderId, paymentId, signature, plan,
    });
    return response.data;
  },
  cancel: async (userId: string) => {
    const response = await api.delete('/subscription/cancel', { data: { userId } });
    return response.data;
  },
};