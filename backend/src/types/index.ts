import { Document, Types } from 'mongoose';


// Enums
export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  EXPIRED = 'expired'
}


export enum SessionStatus {
  PENDING_QR = 'pending_qr',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected'
}


export enum MessageDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing'
}


export enum MessageType {
  TEXT = 'text',
  VOICE_NOTE = 'voice_note'
}


export enum MessageStatus {
  RECEIVED = 'received',
  REPLIED = 'replied',
  PENDING = 'pending',
  FAILED = 'failed'
}


export enum StudentMode {
  AVAILABLE = 'available',
  AWAY = 'away'
}


export enum MessageSender {
  STUDENT = 'student',
  FAMILY = 'family'
}


export enum SubscriptionPlan {
  TRIAL = 'trial',
  BASIC = 'basic',
  PRO = 'pro'
}


// Interfaces
export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  phone: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}


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


export interface ISubscription extends Document {
  userId: Types.ObjectId;
  plan: SubscriptionPlan;
  razorpaySubscriptionId?: string;
  razorpayCustomerId?: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}