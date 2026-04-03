import { groq, GROQ_MODELS, GROQ_CONFIG } from '../config/groq';
import { PersonalityProfile, Message, FamilyContact, UserProfile, User } from '../models'; // ← added User
import fs from 'fs';


class GroqService {


  /**
   * Generate AI reply based on personality profile and conversation context
   */
  async generateReply(
    userId: string,
    contactId: string,
    incomingMessage: string,
    incomingLanguage: string
  ): Promise<string> {
    try {
      const profile = await PersonalityProfile.findOne({ userId, contactId });

      const hasKnowledgeBase = !!((profile as any)?.knowledgeBase?.trim());
      const hasStyleSummary = !!(profile?.systemPrompt?.trim());

      if (!profile || (!hasKnowledgeBase && !hasStyleSummary)) {
        throw new Error('No profile found. Please add a knowledge base or upload chat history first.');
      }

      const contact = await FamilyContact.findById(contactId);
      if (!contact) {
        throw new Error('Family contact not found');
      }

      // ✅ Fetch UserProfile (aboutMe + AI preferences) — use lean()+any to bypass TS interface
      const userProfile = await UserProfile.findOne({ userId }).lean() as any;
      const aboutMe = userProfile?.aboutMe?.trim() || '';
      const aiLang = userProfile?.aiLanguage || 'auto';
      const aiTone = userProfile?.aiTone || 'friendly';
      const aiLength = userProfile?.aiLength || 'match';

      // ✅ Fetch user name from User model (name lives there, not on UserProfile)
      const userDoc = await User.findById(userId).lean() as any;
      const userName = userDoc?.name?.trim() || '';

      const recentMessages = await Message.find({ userId, contactId })
        .sort({ timestamp: -1 })
        .limit(15)
        .lean();

      const chatHistory = recentMessages
        .reverse()
        .map((msg: any) => ({
          role: msg.direction === 'incoming' ? 'user' : 'assistant',
          content: msg.finalText || msg.originalContent || ''
        }))
        .filter((m: any) => m.content.trim().length > 0) as any[];

      const conversationContext = recentMessages
        .map(msg => {
          const sender = msg.direction === 'incoming' ? contact.name : 'You';
          return `${sender}: ${msg.finalText || msg.originalContent}`;
        })
        .join('\n');

      const systemPrompt = this.buildSystemPrompt(
        profile.systemPrompt || '',
        contact.name,
        contact.relation,
        conversationContext,
        incomingMessage,
        incomingLanguage,
        (profile as any).knowledgeBase || '',
        aboutMe,
        userName,
        aiLang,
        aiTone,
        aiLength
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
   * FIXED: .filter(Boolean) prevents crash from undefined regex capture groups
   */
  public splitLikeHuman(reply: string): string[] {
    const trimmed = reply.trim();

    if (trimmed.length < 55) return [trimmed];

    const breakPattern = /(?<=[,।])\s+|(?<=\s)(aur|par|lekin|waise|btw|but|and|oh|haan)\s/gi;
    const parts = trimmed
      .split(breakPattern)
      .filter(Boolean)
      .map(p => p.trim())
      .filter(p =>
        p.length > 4 &&
        !['aur', 'par', 'lekin', 'waise', 'btw', 'but', 'and', 'oh', 'haan'].includes(p.toLowerCase())
      );

    if (parts.length >= 2) {
      return parts.slice(0, 3);
    }

    const sentences = trimmed
      .split(/(?<=[.!?])\s+/)
      .filter(s => s && s.trim().length > 3);

    if (sentences.length >= 2) {
      return sentences.slice(0, 3);
    }

    return [trimmed];
  }


  /**
   * Detect Hinglish — Roman script Hindi that language detectors misclassify as English
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
      'tumhara', 'tumhari', 'apna', 'apni', 'kaisi', 'batao'
    ];

    const lower = message.toLowerCase();
    const words = lower.split(/\s+/);
    const matchCount = words.filter(word =>
      hinglishMarkers.includes(word.replace(/[^a-z]/g, ''))
    ).length;

    return matchCount >= 2 || (words.length <= 4 && matchCount >= 1);
  }


  /**
   * Build the complete system prompt with all 4 context layers + user preferences
   */
  private buildSystemPrompt(
    styleSummary: string,
    contactName: string,
    relation: string,
    conversationContext: string,
    incomingMessage: string,
    incomingLanguage: string,
    knowledgeBase: string,
    aboutMe: string = '',
    userName: string = '',
    aiLang: string = 'auto',
    aiTone: string = 'friendly',
    aiLength: string = 'match'
  ): string {

    // ─────────────────────────────────────────────────────────────────────
    // TIER 2 — USER PREFERENCES
    // ─────────────────────────────────────────────────────────────────────

    // Language
    let detectedLanguage: string;
    if (aiLang === 'auto') {
      detectedLanguage = this.isHinglish(incomingMessage) ? 'Hinglish' : incomingLanguage;
    } else {
      const langMap: Record<string, string> = {
        english: 'English',
        hindi: 'Hindi',
        hinglish: 'Hinglish',
        tamil: 'Tamil'
      };
      detectedLanguage = langMap[aiLang] || 'Hinglish';
    }

    const rule1 =
      detectedLanguage === 'Hinglish'
        ? `LANGUAGE: Reply in Hinglish only — Hindi words in Roman script, exactly how Indians text casually (e.g. "bas free hun", "haan sab thik hai", "kya chal rha hai"). Never formal Hindi. Never switch to English even for emotional or difficult topics — if you can't say it in Hinglish, say it simply.`
        : detectedLanguage === 'Hindi'
          ? `LANGUAGE: Reply in Hindi using Devanagari script only. Never switch to English or Roman script.`
          : detectedLanguage === 'English'
            ? `LANGUAGE: Reply in English only. Never mix Hindi, Hinglish, or any other language — even if past messages were in Hindi.`
            : detectedLanguage === 'Tamil'
              ? `LANGUAGE: Reply in Tamil script only. Never switch to English or any other language.`
              : `LANGUAGE: Reply in ${detectedLanguage} only — match the language of the incoming message exactly.`;

    // Tone
    const rule2 =
      aiTone === 'professional'
        ? `TONE: Formal and polite. Use complete sentences. No slang, abbreviations, or casual shortcuts.`
        : aiTone === 'casual'
          ? `TONE: Casual and relaxed — informal, like texting a close friend. Abbreviations, short replies, and dropped punctuation are fine.`
          : `TONE: Warm and natural — like texting someone you genuinely care about. Conversational but not sloppy.`;

    // Length
    const rule3 =
      aiLength === 'short'
        ? `LENGTH: Keep replies SHORT — 1 to 2 sentences maximum. Real casual texting is brief.`
        : aiLength === 'medium'
          ? `LENGTH: Write 3–4 sentences. Give a bit more detail but never write paragraphs.`
          : `LENGTH: Match the length of the incoming message — if they wrote 3 words, reply with 3–6 words. If they wrote 3 sentences, reply with 2–3 sentences. Mirror their energy.`;

    // ─────────────────────────────────────────────────────────────────────
    // TIER 3 — CONTEXT BLOCKS (only injected if data exists)
    // ─────────────────────────────────────────────────────────────────────

    const identityBlock = (aboutMe || userName)
      ? `━━━ WHO YOU ARE ━━━
${userName ? `Name: ${userName}\n` : ''}${aboutMe}
These are confirmed facts about yourself. ALWAYS stay consistent with them. Never contradict them. If asked about something not mentioned here — deflect naturally rather than guessing.
━━━━━━━━━━━━━━━━━━`
      : '';

    const contactBlock = knowledgeBase.trim()
      ? `━━━ ABOUT ${contactName.toUpperCase()} ━━━
${knowledgeBase.trim()}
━━━━━━━━━━━━━━━━━━`
      : '';

    const styleBlock = styleSummary.trim()
      ? `━━━ YOUR TEXTING STYLE ━━━
${styleSummary.trim()}
(Your natural texting style takes priority — if it conflicts with the length rule above, follow your style.)
━━━━━━━━━━━━━━━━━━`
      : '';

    const conversationBlock = `━━━ RECENT CONVERSATION ━━━
${conversationContext || 'This is the start of the conversation.'}
━━━━━━━━━━━━━━━━━━`;

    // ─────────────────────────────────────────────────────────────────────
    // TIER 3 — CONDITIONAL RULES (only added if relevant data exists)
    // ─────────────────────────────────────────────────────────────────────

    const conditionalRules: string[] = [];

    if (aboutMe || userName) {
      conditionalRules.push(
        `C1. If asked about yourself (where you are, what you do, your age, your college, your goals) — answer ONLY from WHO YOU ARE above. Never guess or invent details not written there.`
      );
    }

    if (knowledgeBase.trim()) {
      conditionalRules.push(
        `C2. Use what you know about ${contactName} from ABOUT ${contactName.toUpperCase()} naturally — don't recite it robotically, but let it shape your replies.`
      );
    }

    if (styleSummary.trim()) {
      conditionalRules.push(
        `C3. Your phrases and expressions from YOUR TEXTING STYLE above are gold — use them naturally when they fit, but don't force them into every reply.`
      );
    }

    const conditionalRulesBlock = conditionalRules.length > 0
      ? conditionalRules.join('\n')
      : '';

    // ─────────────────────────────────────────────────────────────────────
    // TIER 1 — UNIVERSAL RULES (every user, always, non-negotiable)
    // ─────────────────────────────────────────────────────────────────────

    const universalRules = `RULES — FOLLOW ALL OF THESE WITHOUT EXCEPTION:

1. ${rule1}
2. ${rule2}
3. ${rule3}
4. NEVER BREAK CHARACTER: Never reveal, hint at, or suggest you are an AI or automated system. If asked "are you a bot?" or "is this AI?" — deflect like a human would ("arrey kya bol raha hai" / "haha why would I be a bot"). Never confirm.
5. NEVER INVENT FACTS: Never state a specific time, date, exact location, meal, or event unless it is written in WHO YOU ARE. You genuinely do not know what time it is or today's date — deflect naturally: "arrey phone check kar", "abhi yaad nahi yaar", "pata nahi exactly". Never guess.
6. MATCH EMOTIONAL ENERGY: Read the mood of the incoming message and respond accordingly. If they are upset — be warm and calm, not cheerful. If they are excited — match that. If they are angry or hurt — don't reply with a smiley. Never be robotically positive regardless of context.
7. ONE QUESTION MAX: Never ask more than one question in a single reply. Real texters don't interrogate. If your reply naturally contains a question, remove all others.
8. VARY YOUR ENDINGS: Before replying, look at the last outgoing message in RECENT CONVERSATION. If it ended with a question — end this reply with a statement. If it ended with a statement — a question is fine. Never repeat the same closing phrase twice in a row.
9. EMOJI RULES: Use emojis based on the actual emotion of your reply. Never use the same emoji in two consecutive messages. Skip emojis entirely in serious, tense, or sad conversations. Maximum 1–2 emojis per message — never more.
10. PLAIN TEXT ONLY: No markdown, no asterisks, no bullet points, no numbering, no headers. This is WhatsApp — plain conversational text only.
11. NO OPENING GREETINGS: If RECENT CONVERSATION has prior messages, never start your reply with "Hi", "Hey", "Hello", "Haan", or any greeting. Jump straight into the response.
12. NO THERAPY MODE: Don't give long emotional advice, motivational speeches, or counselling-style responses. Real people keep it short and real — "arrey chill kar yaar" beats a 4-sentence pep talk every time.
${conditionalRulesBlock ? `\n${conditionalRulesBlock}` : ''}`;

    // ─────────────────────────────────────────────────────────────────────
    // FINAL PROMPT ASSEMBLY
    // ─────────────────────────────────────────────────────────────────────

    const contextBlocks = [identityBlock, contactBlock, styleBlock, conversationBlock]
      .filter(Boolean)
      .join('\n\n');

    return `You are ${userName || 'someone'} replying to your ${relation} (${contactName}) on WhatsApp. You are not an AI — you are the actual person on the other end of this chat.

${contextBlocks}

${universalRules}

${contactName}: ${incomingMessage}
You:`;
  }


  /**
   * Clean and validate AI reply
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
   */
  async testPersonality(userId: string, contactId: string, testMessage: string): Promise<string> {
    return this.generateReply(userId, contactId, testMessage, 'English');
  }


  /**
   * Enhance rough user notes into a rich knowledge base paragraph
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