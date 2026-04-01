import WhatsAppChatParser from 'whatsapp-chat-parser';
import { detectLanguage, isHinglish } from './language';
import { MessageSender, IRawMessage } from '../types';


export interface ParsedMessage {
  date: Date;
  author: string;
  message: string;
}


/**
 * Parse WhatsApp chat export file
 */
export const parseWhatsAppChat = async (fileContent: string): Promise<ParsedMessage[]> => {
  try {
    const messages = await WhatsAppChatParser.parseString(fileContent);
    
    return messages
      .filter((msg: any) => msg.message && msg.message.trim().length > 0)
      .map((msg: any) => ({
        date: new Date(msg.date),
        author: msg.author,
        message: msg.message.trim()
      }));
  } catch (error) {
    console.error('Error parsing WhatsApp chat:', error);
    throw new Error('Failed to parse chat file. Please ensure it is a valid WhatsApp export.');
  }
};


/**
 * Separate messages by sender
 */
export const separateMessagesBySender = (
  messages: ParsedMessage[],
  studentName: string
): {
  studentMessages: ParsedMessage[];
  familyMessages: ParsedMessage[];
} => {
  const studentMessages: ParsedMessage[] = [];
  const familyMessages: ParsedMessage[] = [];

  for (const msg of messages) {
    const normalizedAuthor = msg.author.toLowerCase().trim();
    const normalizedStudent = studentName.toLowerCase().trim();

    if (normalizedAuthor === normalizedStudent || normalizedAuthor.includes(normalizedStudent)) {
      studentMessages.push(msg);
    } else {
      familyMessages.push(msg);
    }
  }

  return { studentMessages, familyMessages };
};


/**
 * Clean and filter messages
 */
export const cleanMessages = (messages: ParsedMessage[]): ParsedMessage[] => {
  const systemPhrases = [
    'messages and calls are end-to-end encrypted',
    'media omitted',
    'image omitted',
    'video omitted',
    'audio omitted',
    'sticker omitted',
    'document omitted',
    'contact card omitted',
    'location omitted',
    'you deleted this message',
    'this message was deleted',
    'missed voice call',
    'missed video call'
  ];

  return messages.filter(msg => {
    const lowerMsg = msg.message.toLowerCase();
    
    if (systemPhrases.some(phrase => lowerMsg.includes(phrase))) {
      return false;
    }

    if (msg.message.length < 3) {
      return false;
    }

    if (/^[\u{1F300}-\u{1F9FF}\s]+$/u.test(msg.message)) {
      return false;
    }

    return true;
  });
};


/**
 * Convert to IRawMessage format with language detection
 */
export const convertToRawMessages = (
  messages: ParsedMessage[],
  sender: MessageSender
): IRawMessage[] => {
  return messages.map(msg => {
    let language = detectLanguage(msg.message);
    
    if (isHinglish(msg.message)) {
      language = 'Hinglish';
    }

    return {
      timestamp: msg.date,
      sender,
      text: msg.message,
      language
    };
  });
};


/**
 * Select representative messages for personality building
 */
export const selectRepresentativeMessages = (
  messages: IRawMessage[],
  maxCount: number = 150
): IRawMessage[] => {
  if (messages.length <= maxCount) {
    return messages;
  }

  const byLanguage: { [key: string]: IRawMessage[] } = {};
  
  for (const msg of messages) {
    if (!byLanguage[msg.language]) {
      byLanguage[msg.language] = [];
    }
    byLanguage[msg.language].push(msg);
  }

  const selected: IRawMessage[] = [];
  const totalMessages = messages.length;

  // ✅ Only change — _language prefix to suppress unused variable error
  for (const [_language, langMessages] of Object.entries(byLanguage)) {
    const proportion = langMessages.length / totalMessages;
    const targetCount = Math.ceil(proportion * maxCount);
    
    const step = Math.max(1, Math.floor(langMessages.length / targetCount));
    
    for (let i = 0; i < langMessages.length && selected.length < maxCount; i += step) {
      selected.push(langMessages[i]);
    }
  }

  return selected.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};