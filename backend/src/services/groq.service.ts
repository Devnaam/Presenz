import { groq, GROQ_MODELS, GROQ_CONFIG } from '../config/groq';
import { PersonalityProfile, Message, FamilyContact } from '../models';
import fs from 'fs';


class GroqService {


  /**
   * Generate AI reply based on personality profile and conversation context
   * CHANGED: allows KB-only profiles, passes knowledgeBase to buildSystemPrompt
   */
  async generateReply(
    userId: string,
    contactId: string,
    incomingMessage: string,
    incomingLanguage: string
  ): Promise<string> {
    try {
      const profile = await PersonalityProfile.findOne({ userId, contactId });

      // ── CHANGED: KB-only profiles are valid — no chat upload required ────
      const hasKnowledgeBase = !!((profile as any)?.knowledgeBase?.trim());
      const hasStyleSummary  = !!(profile?.systemPrompt?.trim());

      if (!profile || (!hasKnowledgeBase && !hasStyleSummary)) {
        throw new Error('No profile found. Please add a knowledge base or upload chat history first.');
      }

      const contact = await FamilyContact.findById(contactId);

      if (!contact) {
        throw new Error('Family contact not found');
      }

      const recentMessages = await Message.find({ userId, contactId })
        .sort({ timestamp: -1 })
        .limit(15)
        .lean();

      // Build real conversation turns for the API (excludes current message)
      const chatHistory = recentMessages
        .reverse()
        .map((msg: any) => ({
          role: msg.direction === 'incoming' ? 'user' : 'assistant',
          content: msg.finalText || msg.originalContent || ''
        }))
        .filter((m: any) => m.content.trim().length > 0) as any[];

      // Build conversationContext string for the system prompt (for context awareness)
      const conversationContext = recentMessages
        .map(msg => {
          const sender = msg.direction === 'incoming' ? contact.name : 'You';
          return `${sender}: ${msg.finalText || msg.originalContent}`;
        })
        .join('\n');

      // ── CHANGED: passes knowledgeBase as the new 3rd layer ───────────────
      const systemPrompt = this.buildSystemPrompt(
        profile.systemPrompt || '',
        contact.name,
        contact.relation,
        conversationContext,
        incomingMessage,
        incomingLanguage,
        (profile as any).knowledgeBase || ''  // ← NEW
      );

      const completion = await groq.chat.completions.create({
        model: GROQ_MODELS.CHAT,
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory,
          { role: 'user', content: incomingMessage }
        ],
        temperature: GROQ_CONFIG.temperature,
        max_tokens: GROQ_CONFIG.maxTokens,
        top_p: GROQ_CONFIG.topP
      });

      const reply = completion.choices[0]?.message?.content?.trim();

      if (!reply) {
        throw new Error('No reply generated from AI');
      }

      return this.cleanReply(reply);

    } catch (error: any) {
      console.error('Error generating AI reply:', error);
      throw new Error(`Failed to generate reply: ${error.message}`);
    }
  }


  /**
   * Transcribe audio file using Groq Whisper
   * UNCHANGED
   */
  async transcribeAudio(audioFilePath: string): Promise<{
    text: string;
    language: string;
  }> {
    try {
      console.log('🎤 Transcribing audio with Groq Whisper...');

      const audioFile = fs.createReadStream(audioFilePath);

      const transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model: GROQ_MODELS.WHISPER,
        response_format: 'verbose_json'
      });

      const text = transcription.text?.trim();

      if (!text) {
        throw new Error('No transcription returned');
      }

      const language = (transcription as any).language || 'unknown';

      console.log(`✅ Transcription complete: "${text.substring(0, 50)}..."`);
      console.log(`🌐 Detected language: ${language}`);

      return {
        text,
        language: this.mapWhisperLanguage(language)
      };

    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }


  /**
   * Map Whisper language codes to readable names
   * UNCHANGED
   */
  private mapWhisperLanguage(code: string): string {
    const languageMap: { [key: string]: string } = {
      'en': 'English',
      'hi': 'Hindi',
      'te': 'Telugu',
      'ta': 'Tamil',
      'mr': 'Marathi',
      'bn': 'Bengali',
      'gu': 'Gujarati',
      'kn': 'Kannada',
      'ml': 'Malayalam',
      'pa': 'Punjabi',
      'ur': 'Urdu',
      'or': 'Oriya'
    };

    return languageMap[code.toLowerCase()] || 'English';
  }


  /**
   * Split a reply into 1–3 natural parts like a human texting.
   * UNCHANGED
   */
  public splitLikeHuman(reply: string): string[] {
    const trimmed = reply.trim();

    if (trimmed.length < 55) return [trimmed];

    const breakPattern = /(?<=[,।])\s+|(?<=\s)(aur|par|lekin|waise|btw|but|and|oh|haan)\s/gi;
    const parts = trimmed
      .split(breakPattern)
      .map(p => p.trim())
      .filter(p => p.length > 4 && !['aur','par','lekin','waise','btw','but','and','oh','haan'].includes(p.toLowerCase()));

    if (parts.length >= 2) {
      return parts.slice(0, 3);
    }

    const sentences = trimmed
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 3);

    if (sentences.length >= 2) {
      return sentences.slice(0, 3);
    }

    return [trimmed];
  }


  /**
   * Detect Hinglish — Roman script Hindi that language detectors misclassify as English
   * UNCHANGED
   */
  private isHinglish(message: string): boolean {
    const hinglishMarkers = [
      'kya', 'kar', 'rha', 'rhi', 'rhe', 'hai', 'hain', 'ho', 'tha', 'thi',
      'the', 'kha', 'piya', 'aya', 'ayi', 'gaya', 'gayi', 'karo', 'karna',
      'nahi', 'nhi', 'haan', 'acha', 'theek', 'thik', 'bhai', 'yaar', 'kal',
      'aaj', 'abhi', 'sab', 'mera', 'meri', 'tera', 'teri', 'kaise', 'kaisa',
      'kab', 'kahan', 'kyun', 'kyunki', 'lekin', 'aur', 'matlab', 'bilkul',
      'zaroor', 'accha', 'bata', 'beta', 'beti', 'maa', 'papa', 'didi',
      'bhaiya', 'khana', 'peena', 'uth', 'dekh', 'sun', 'bol', 'hun',
      'hoon', 'bas', 'thoda', 'bahut', 'zyada', 'kam', 'hogya', 'hogaya',
      'aa', 'ja', 'ruk', 'bolo', 'suno', 'dekho', 'sb', 'toh', 'bhi', 'sirf',
      'tumhara', 'tumhari', 'apna', 'apni', 'kaisi', 'batao', 'batao'
    ];

    const lower = message.toLowerCase();
    const words = lower.split(/\s+/);
    const matchCount = words.filter(word =>
      hinglishMarkers.includes(word.replace(/[^a-z]/g, ''))
    ).length;

    return matchCount >= 2 || (words.length <= 4 && matchCount >= 1);
  }


  /**
   * Build the complete system prompt
   * UNCHANGED
   */
  private buildSystemPrompt(
    styleSummary: string,
    contactName: string,
    relation: string,
    conversationContext: string,
    incomingMessage: string,
    incomingLanguage: string,
    knowledgeBase: string
  ): string {

    const detectedLanguage = this.isHinglish(incomingMessage) ? 'Hinglish' : incomingLanguage;

    const languageInstruction = detectedLanguage === 'Hinglish'
      ? `Reply in HINGLISH — Hindi words in Roman script, the way Indians actually text (e.g. "bas free hun", "haan sab thik hai", "kha liya thoda"). NOT formal Hindi. NOT pure English.`
      : detectedLanguage === 'English'
        ? `Reply in ENGLISH ONLY. Even if past messages were in Hindi or Hinglish, this message is in English — match that.`
        : `Reply in ${detectedLanguage} only — same language and script as the incoming message.`;

    const layer1 = knowledgeBase.trim()
      ? `═══ CONTEXT ABOUT THIS CONTACT & YOUR RELATIONSHIP ═══
${knowledgeBase.trim()}
══════════════════════════════════════════════════════`
      : '';

    const layer2 = styleSummary.trim()
      ? `═══ YOUR TEXTING STYLE ═══
${styleSummary.trim()}
══════════════════════════`
      : '';

    const layer3 = `═══ RECENT CONVERSATION ═══
${conversationContext || 'This is the start of the conversation.'}
═══════════════════════════`;

    return `You are replying to your ${relation} (${contactName}) on WhatsApp. Pretend to be the person they are texting.


${layer1}


${layer2}


${layer3}


STRICT RULES — FOLLOW ALL OF THESE:
1. ${languageInstruction}
2. Match the TONE and VOCABULARY from your style and chat history — casual, warm texting
3. Every reply MUST be a complete coherent thought — never reply with a single disconnected word
4. Keep replies SHORT — 1 to 2 sentences like real casual texting, but always make sense in context
5. NEVER invent specific facts: do NOT say a specific time, date, exact location, what you just ate, what you're watching — you don't know these right now
6. If asked "what are you doing" or "what time is it" — give a warm vague reply: "bas free hun", "ghar pe hun", "kuch khaas nahi"
7. NEVER reply with a random word fragment from the training data — your reply must respond to what was actually asked
8. Vary your responses — do NOT end every message with "aur tu?" or "tu bata"
9. Do NOT start with a greeting if the conversation is already ongoing
10. Use the context above to give relevant, informed replies


${contactName}: ${incomingMessage}
You:`;
  }


  /**
   * Clean and validate AI reply
   * UNCHANGED
   */
  private cleanReply(reply: string): string {
    let cleaned = reply.replace(/[*"]/g, '').trim();

    const words = cleaned.split(/\s+/);
    if (words.length === 1 && cleaned.length < 6) {
      return 'Bas free hun, bata kya hua?';
    }

    const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length > 3) {
      cleaned = sentences.slice(0, 3).join('. ') + '.';
    }

    if (cleaned.length > 300) {
      cleaned = cleaned.substring(0, 297) + '...';
    }

    return cleaned;
  }


  /**
   * Test the personality profile with a sample question
   * UNCHANGED
   */
  async testPersonality(userId: string, contactId: string, testMessage: string): Promise<string> {
    return this.generateReply(userId, contactId, testMessage, 'English');
  }


  /**
   * Enhance rough user notes into a rich knowledge base paragraph
   * NEW — used by the "✨ Enhance" button in Step 2 of Add Contact modal
   */
  async enhanceContext(
    roughText: string,
    contactName: string,
    relation: string
  ): Promise<string> {
    try {
      console.log(`✨ Enhancing knowledge base context for ${contactName}...`);

      const completion = await groq.chat.completions.create({
        model: GROQ_MODELS.CHAT,
        messages: [
          {
            role: 'system',
            content: `You are helping someone describe their relationship with a person to an AI assistant that will reply on their behalf via WhatsApp.

Your job: take rough, short notes and expand them into a clear, natural paragraph (4-6 sentences) that an AI can use to reply authentically.

STRICT RULES:
1. Write in FIRST PERSON — as if the user is describing the relationship themselves
2. ONLY expand what is already implied in the notes — never invent new facts
3. Cover: who they are, the nature of the relationship, communication style, topics you discuss, things to be careful about
4. Write as a plain paragraph — NO bullet points, NO headers, NO formatting
5. Keep it natural and warm — this is personal context, not a formal profile
6. Output ONLY the paragraph — nothing else, no intro, no explanation`
          },
          {
            role: 'user',
            content: `Contact name: ${contactName}
Relation: ${relation}
My rough notes: ${roughText}

Expand this into a clear 4-6 sentence paragraph:`
          }
        ],
        temperature: 0.6,
        max_tokens: 300,
        top_p: 1
      });

      const enhanced = completion.choices[0]?.message?.content?.trim();

      if (!enhanced) {
        throw new Error('No enhanced context returned');
      }

      console.log(`✅ Context enhanced for ${contactName}`);
      return enhanced;

    } catch (error: any) {
      console.error('Error enhancing context:', error);
      throw new Error(`Failed to enhance context: ${error.message}`);
    }
  }
}


export default new GroqService();