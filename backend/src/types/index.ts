import { Document, Types } from 'mongoose';


// ─────────────────────────────────────────────────────────────────
// Subscription Enums — updated
// ─────────────────────────────────────────────────────────────────

export enum SubscriptionStatus {
  PENDING   = 'pending',    // registered, trial NOT yet activated
  TRIAL     = 'trial',      // trial activated, within 7 days
  ACTIVE    = 'active',     // paid plan active
  EXPIRED   = 'expired',    // trial over or paid plan lapsed
  GRACE     = 'grace',      // payment failed, 3-day grace window
  CANCELLED = 'cancelled',  // cancelled but stays active till period end
}

export enum SubscriptionPlan {
  TRIAL    = 'trial',
  PRO      = 'pro',
  BUSINESS = 'business',   // replaces old BASIC
}


// ─────────────────────────────────────────────────────────────────
// All other enums — UNCHANGED
// ─────────────────────────────────────────────────────────────────

export enum SessionStatus {
  PENDING_QR   = 'pending_qr',
  CONNECTED    = 'connected',
  DISCONNECTED = 'disconnected',
}

export enum MessageDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
}

export enum MessageType {
  TEXT       = 'text',
  VOICE_NOTE = 'voice_note',
}

export enum MessageStatus {
  RECEIVED = 'received',
  REPLIED  = 'replied',
  PENDING  = 'pending',
  FAILED   = 'failed',
}

export enum StudentMode {
  AVAILABLE = 'available',
  AWAY      = 'away',
}

export enum MessageSender {
  STUDENT = 'student',
  FAMILY  = 'family',
}

export enum AILanguage {
  AUTO     = 'auto',
  ENGLISH  = 'english',
  HINDI    = 'hindi',
  HINGLISH = 'hinglish',
  TAMIL    = 'tamil',
}

export enum AITone {
  CASUAL       = 'casual',
  FRIENDLY     = 'friendly',
  PROFESSIONAL = 'professional',
}

export enum AILength {
  SHORT  = 'short',
  MEDIUM = 'medium',
  MATCH  = 'match',
}


// ─────────────────────────────────────────────────────────────────
// IUser — updated with subscription + referral + usage fields
// ─────────────────────────────────────────────────────────────────

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  phone: string;

  // Subscription
  subscriptionStatus: SubscriptionStatus;
  plan: SubscriptionPlan;
  trialActivatedAt: Date | null;   // null until user clicks "Activate Trial"
  trialEndsAt: Date | null;        // set only when trial is activated

  // Daily reply usage counter
  repliesUsedToday: number;
  repliesResetAt: Date;            // when counter was last reset (midnight)

  // Referral system
  referralCode: string;            // auto-generated on register, unique
  referredBy: string | null;       // referral code entered at registration
  bonusDays: number;               // extra days earned via referrals

  createdAt: Date;
  updatedAt: Date;
}


// ─────────────────────────────────────────────────────────────────
// ISubscription — updated with cancellation + grace fields
// ─────────────────────────────────────────────────────────────────

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  plan: SubscriptionPlan;
  razorpaySubscriptionId?: string;
  razorpayCustomerId?: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt: Date | null;        // when user cancelled
  gracePeriodEndsAt: Date | null;  // for failed payments, 3-day window
  createdAt: Date;
  updatedAt: Date;
}


// ─────────────────────────────────────────────────────────────────
// All other interfaces — UNCHANGED
// ─────────────────────────────────────────────────────────────────

export interface IWhatsAppSession extends Document {
  userId: Types.ObjectId;
  sessionId: string;
  status: SessionStatus;
  qrCode?: string;
  connectedAt?: Date;
  lastSeenAt?: Date;
  authState?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFamilyContact extends Document {
  userId: Types.ObjectId;
  name: string;
  phone: string;
  relation: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRawMessage {
  timestamp: Date;
  sender: MessageSender;
  text: string;
  language: string;
}

export interface IPersonalityProfile extends Document {
  userId: Types.ObjectId;
  contactId: Types.ObjectId;
  rawMessages: IRawMessage[];
  processedAt?: Date;
  messageCount: number;
  dominantLanguages: string[];
  systemPrompt: string;
  knowledgeBase?: string;
  contactStyleSummary?: string;
  sensitiveTopics?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentStatus extends Document {
  userId: Types.ObjectId;
  mode: StudentMode;
  autoAwayEnabled: boolean;
  autoAwayMinutes: number;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage extends Document {
  userId: Types.ObjectId;
  contactId: Types.ObjectId;
  direction: MessageDirection;
  type: MessageType;
  originalContent: string;
  transcribedText?: string;
  finalText?: string;
  generatedByAI: boolean;
  studentOverride: boolean;
  language?: string;
  status: MessageStatus;
  whatsappMessageId?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserProfile extends Document {
  userId: Types.ObjectId;
  aboutMe: string;
  aiLanguage: AILanguage;
  aiTone: AITone;
  aiLength: AILength;
  createdAt: Date;
  updatedAt: Date;
}