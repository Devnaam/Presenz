import { franc } from 'franc';

/**
 * Language code mappings
 */
const LANGUAGE_NAMES: { [key: string]: string } = {
  eng: 'English',
  hin: 'Hindi',
  tel: 'Telugu',
  tam: 'Tamil',
  mar: 'Marathi',
  ben: 'Bengali',
  guj: 'Gujarati',
  kan: 'Kannada',
  mal: 'Malayalam',
  pan: 'Punjabi',
  urd: 'Urdu',
  ori: 'Oriya',
  asm: 'Assamese',
  nep: 'Nepali',
  sin: 'Sinhala'
};

/**
 * Detect language of text
 */
export const detectLanguage = (text: string): string => {
  if (!text || text.trim().length < 3) {
    return 'English'; // Default fallback
  }

  try {
    const langCode = franc(text, { minLength: 3 });
    
    if (langCode === 'und') {
      // Undetermined - likely Hinglish or very short text
      return 'Hinglish';
    }

    return LANGUAGE_NAMES[langCode] || 'English';
  } catch (error) {
    return 'English';
  }
};

/**
 * Detect dominant languages from multiple messages
 */
export const detectDominantLanguages = (messages: string[]): string[] => {
  const languageCounts: { [key: string]: number } = {};

  for (const message of messages) {
    const lang = detectLanguage(message);
    languageCounts[lang] = (languageCounts[lang] || 0) + 1;
  }

  // Sort by frequency
  const sorted = Object.entries(languageCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([lang]) => lang);

  // Return top 3 languages
  return sorted.slice(0, 3);
};

/**
 * Check if text contains Hinglish (mix of Hindi and English)
 */
export const isHinglish = (text: string): boolean => {
  // Simple heuristic: contains both English letters and Hindi words
  const hasEnglish = /[a-zA-Z]/.test(text);
  const hasHindiWords = /(hai|hain|ka|ki|ke|ko|se|me|pe|par|kya|kaise|acha|thik|nahi|haan|yaar)/i.test(text);
  
  return hasEnglish && hasHindiWords;
};