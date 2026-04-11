// ─────────────────────────────────────────────────────────────────
// User — updated with subscription, usage, referral fields
// ─────────────────────────────────────────────────────────────────
export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;

  // Subscription
  subscriptionStatus: 'pending' | 'trial' | 'active' | 'expired' | 'grace' | 'cancelled';
  plan: 'trial' | 'pro' | 'business';
  trialActivatedAt: string | null;
  trialEndsAt: string | null;

  // Usage
  repliesUsedToday: number;

  // Referral
  referralCode: string;
  referredBy: string | null;
  bonusDays: number;
}


// ─────────────────────────────────────────────────────────────────
// All other interfaces — UNCHANGED
// ─────────────────────────────────────────────────────────────────

export interface FamilyContact {
  _id: string;
  userId: string;
  name: string;
  phone: string;
  relation: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  userId: string;
  contactId: string;
  direction: 'incoming' | 'outgoing';
  type: 'text' | 'voice_note';
  originalContent: string;
  transcribedText?: string;
  finalText?: string;
  generatedByAI: boolean;
  studentOverride: boolean;
  language?: string;
  status: 'received' | 'replied' | 'pending' | 'failed';
  timestamp: string;
  createdAt: string;
}

export interface StudentStatus {
  _id: string;
  userId: string;
  mode: 'available' | 'away';
  autoAwayEnabled: boolean;
  autoAwayMinutes: number;
  lastActiveAt: string;
}

export interface Conversation {
  contact: FamilyContact;
  lastMessage?: Message;
  unreadCount: number;
}

export interface DashboardSummary {
  today: {
    messagesReceived: number;
    aiRepliesSent: number;
    activeContacts: number;
  };
  status: {
    mode: 'available' | 'away';
    autoAwayEnabled: boolean;
    lastActiveAt: string;
  };
  recentActivity: Message[];
}