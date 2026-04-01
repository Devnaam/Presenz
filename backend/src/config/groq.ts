import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY is not defined in environment variables');
}

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Model configurations
export const GROQ_MODELS = {
  CHAT: 'llama-3.3-70b-versatile',
  WHISPER: 'whisper-large-v3-turbo'
};

export const GROQ_CONFIG = {
  temperature: 0.7,
  maxTokens: 150,
  topP: 1
};