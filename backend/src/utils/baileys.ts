import { proto } from '@whiskeysockets/baileys';
import P from 'pino';


// Minimal logger (Baileys requires one)
export const logger = P({ level: 'silent' }); // Set to 'debug' for troubleshooting


// Helper to format phone numbers for WhatsApp
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If it starts with +, remove it
  if (phone.startsWith('+')) {
    cleaned = phone.substring(1).replace(/\D/g, '');
  }
  
  // Add @s.whatsapp.net suffix
  return `${cleaned}@s.whatsapp.net`;
};


// Helper to extract phone number from JID
export const extractPhoneNumber = (jid: string): string => {
  return jid.split('@')[0];
};


// Helper to check if message is from user themselves
export const isMessageFromMe = (message: proto.IWebMessageInfo): boolean => {
  return message.key?.fromMe || false;
};


// Helper to get message text content
export const getMessageText = (message: proto.IWebMessageInfo): string | null => {
  const messageContent = message.message;
  if (!messageContent) return null;


  // Text message
  if (messageContent.conversation) {
    return messageContent.conversation;
  }


  // Extended text message
  if (messageContent.extendedTextMessage?.text) {
    return messageContent.extendedTextMessage.text;
  }


  return null;
};


// Helper to check if message is a voice note
export const isVoiceMessage = (message: proto.IWebMessageInfo): boolean => {
  return !!message.message?.audioMessage?.ptt;
};


// Helper to get message type
export const getMessageType = (message: proto.IWebMessageInfo): 'text' | 'voice' | 'other' => {
  if (isVoiceMessage(message)) return 'voice';
  if (getMessageText(message)) return 'text';
  return 'other';
};