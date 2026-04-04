import { groq, GROQ_MODELS, GROQ_CONFIG } from '../config/groq';
import { PersonalityProfile, Message, FamilyContact, UserProfile, User, ConversationMeta } from '../models';
import fs from 'fs';


class GroqService {


  /**
   * Generate AI reply based on personality profile and conversation context
   * CHANGED: wires in contactStyleSummary, sensitiveTopics,
   *          conversationState, and timeContext
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
      const hasStyleSummary  = !!(profile?.systemPrompt?.trim());

      if (!profile || (!hasKnowledgeBase && !hasStyleSummary)) {
        throw new Error('No profile found. Please add a knowledge base or upload chat history first.');
      }

      const contact = await FamilyContact.findById(contactId);
      if (!contact) throw new Error('Family contact not found');

      // Fetch UserProfile (aboutMe + AI preferences)
      const userProfile = await UserProfile.findOne({ userId }).lean() as any;
      const aboutMe  = userProfile?.aboutMe?.trim() || '';
      const aiLang   = userProfile?.aiLanguage || 'auto';
      const aiTone   = userProfile?.aiTone     || 'friendly';
      const aiLength = userProfile?.aiLength   || 'match';

      // Fetch user name from User model
      const userDoc  = await User.findById(userId).lean() as any;
      const userName = userDoc?.name?.trim() || '';

      // Fetch stored conversation summary from ConversationMeta
      const metaDoc = await ConversationMeta.findOne({ userId, contactId }).lean() as any;
      const conversationSummary = metaDoc?.summary?.trim() || '';

      // ✅ NEW — Extract contactStyleSummary and sensitiveTopics from profile
      const contactStyleSummary = (profile as any)?.contactStyleSummary?.trim() || '';
      const sensitiveTopics     = (profile as any)?.sensitiveTopics as string[] || [];

      // ✅ NEW — Compute conversation state (session freshness)
      const conversationState = await this.getConversationState(userId, contactId);

      // ✅ NEW — Compute current time context
      const timeContext = this.getTimeContext();

      // Fetch last 20 messages for chat history and context
      const recentMessages = await Message.find({ userId, contactId })
        .sort({ timestamp: -1 })
        .limit(20)
        .lean();

      const chatHistory = recentMessages
        .reverse()
        .map((msg: any) => ({
          role:    msg.direction === 'incoming' ? 'user' : 'assistant',
          content: msg.finalText || msg.originalContent || ''
        }))
        .filter((m: any) => m.content.trim().length > 0) as any[];

      const conversationContext = recentMessages
        .map(msg => {
          const sender = msg.direction === 'incoming' ? contact.name : 'You';
          return `${sender}: ${msg.finalText || msg.originalContent}`;
        })
        .join('\n');

      // Extract context hints from recent messages (no AI call)
      const contextHints = this.extractContextHints(recentMessages);

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
        aiLength,
        conversationSummary,
        contextHints,
        contactStyleSummary,  // ✅ NEW
        sensitiveTopics,       // ✅ NEW
        conversationState,     // ✅ NEW
        timeContext            // ✅ NEW
      );

      const completion = await groq.chat.completions.create({
        model: GROQ_MODELS.CHAT,
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory,
          { role: 'user', content: incomingMessage }
        ],
        temperature: GROQ_CONFIG.temperature,
        max_tokens:  GROQ_CONFIG.maxTokens,
        top_p:       GROQ_CONFIG.topP
      });

      const reply = completion.choices[0]?.message?.content?.trim();
      if (!reply) throw new Error('No reply generated from AI');

      return this.cleanReply(reply);

    } catch (error: any) {
      console.error('Error generating AI reply:', error);
      throw new Error(`Failed to generate reply: ${error.message}`);
    }
  }


  /**
   * ✅ NEW — Returns current time, day, date, and a contextual note
   * Injected into prompt so AI knows when a message is arriving
   */
  private getTimeContext(): string {
    const now    = new Date();
    const hours  = now.getHours();
    const mins   = now.getMinutes().toString().padStart(2, '0');

    const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];

    const timeStr = `${hours}:${mins}`;
    const dayName = days[now.getDay()];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

    let timeOfDay: string;
    let note = '';

    if      (hours >= 5  && hours < 11) { timeOfDay = 'morning'; }
    else if (hours >= 11 && hours < 17) { timeOfDay = 'afternoon'; }
    else if (hours >= 17 && hours < 21) { timeOfDay = 'evening'; }
    else if (hours >= 21 && hours < 24) {
      timeOfDay = 'night';
      note = 'It is nighttime — brief replies are natural. Mentioning sleep or rest is appropriate if the conversation allows.';
    } else {
      timeOfDay = 'late night';
      note = 'It is very late night — keep replies short. Suggesting sleep is natural and appropriate.';
    }

    return `Time: ${timeStr} | Day: ${dayName} | Date: ${dateStr} | Period: ${timeOfDay}${note ? `\nNote: ${note}` : ''}`;
  }


  /**
   * ✅ NEW — Detects conversation session state based on last message timestamp
   * Tells the AI whether to warm-open or jump straight in
   */
  private async getConversationState(userId: string, contactId: string): Promise<string> {
    try {
      const lastMessage = await Message.findOne({ userId, contactId })
        .sort({ timestamp: -1 })
        .lean() as any;

      if (!lastMessage) {
        return 'First ever message from this contact — open naturally.';
      }

      const hoursSince = (Date.now() - new Date(lastMessage.timestamp).getTime()) / (1000 * 60 * 60);

      if (hoursSince > 48) {
        return `Fresh conversation — ${Math.round(hoursSince / 24)} day(s) since last message. A warm natural re-opening fits.`;
      } else if (hoursSince > 6) {
        return `New session — last message ${Math.round(hoursSince)} hours ago. Pick up naturally without acting like it never stopped.`;
      } else if (hoursSince > 1) {
        return `Continuing conversation — last message ${Math.round(hoursSince)} hour(s) ago. Jump straight in.`;
      } else {
        return 'Active conversation — messages flowing. Jump straight in, no reintroduction needed.';
      }
    } catch {
      return '';
    }
  }


  /**
   * ✅ NEW — Maps relation (free-text field) to behavioral guidance via keyword matching
   * Injected as Rule 0 in the prompt — highest priority behavioral rule
   */
  private getRelationBehavior(relation: string): string {
    const r = relation.toLowerCase().trim();

    if (/\b(mom|mother|maa|mummy|ammi|amma|mata)\b/.test(r)) {
      return `RELATION: You are talking to your MOTHER. Be warm, reassuring, and always caring. Use "haan maa" style acknowledgments when appropriate. Never be rude, dismissive, or use harsh slang. If she asks about food, sleep, health, or studies — give a reassuring answer. She worries — ease her mind.`;
    }
    if (/\b(dad|father|papa|pappa|abbu|bapu|baba|pita)\b/.test(r)) {
      return `RELATION: You are talking to your FATHER. Be respectful and keep it brief. Answer questions directly. Don't be dramatic or overly emotional. Warm but not mushy.`;
    }
    if (/\b(girlfriend|gf)\b/.test(r)) {
      return `RELATION: You are talking to your GIRLFRIEND. Be warm and affectionate but natural — not over-the-top. Light teasing and playfulness is completely normal. If she is upset — be caring but not desperate or overly apologetic. Push back lightly when she is being dramatic — total agreement every time feels fake. Pet names are okay only if they appear in the chat history.`;
    }
    if (/\b(boyfriend|bf)\b/.test(r)) {
      return `RELATION: You are talking to your BOYFRIEND. Be natural, warm, and slightly playful. Text like you normally would with someone you are very comfortable with. Light teasing is fine.`;
    }
    if (/\b(best friend|bestie|best frd|bsf)\b/.test(r)) {
      return `RELATION: You are talking to your BEST FRIEND. No filter needed — banter, roasting, and inside jokes are completely normal. Be real and direct. Short replies are totally fine. You do not need to explain everything.`;
    }
    if (/\b(college friend|classmate|college frd|uni friend|batch|clg friend)\b/.test(r)) {
      return `RELATION: You are talking to a COLLEGE FRIEND. Keep it casual and brief. Topics like placements, assignments, college life, and mutual friends are natural. Banter is fine.`;
    }
    if (/\b(sibling|brother|sister|bhai|didi|bhaiya|sis|anna|akka)\b/.test(r)) {
      return `RELATION: You are talking to your SIBLING. A mix of teasing and genuine care is completely natural. Be protective when it matters, casual otherwise. Inside jokes and banter are normal.`;
    }
    if (/\b(cousin)\b/.test(r)) {
      return `RELATION: You are talking to your COUSIN. Friendly and casual — somewhere between a friend and a family member. Warm but not overly formal.`;
    }
    if (/\b(friend|dost|yaar|buddy)\b/.test(r)) {
      return `RELATION: You are talking to a FRIEND. Keep it casual, warm, and natural. Short replies are fine. No need to be formal.`;
    }
    if (/\b(teacher|sir|ma'am|madam|professor|prof|mentor)\b/.test(r)) {
      return `RELATION: You are talking to a TEACHER or MENTOR. Be respectful and polite. Keep it brief and to the point. No slang or abbreviations.`;
    }

    // Default fallback
    return `RELATION: You are talking to your ${relation}. Be natural, warm, and appropriate for your relationship with them.`;
  }


  /**
   * Extract lightweight context hints from raw messages
   * No AI call — pure keyword pattern matching
   * UNCHANGED
   */
  private extractContextHints(messages: any[]): string {
    if (!messages || messages.length === 0) return '';

    const allText = messages
      .map(m => (m.finalText || m.originalContent || '').toLowerCase())
      .join(' ');

    const topics: string[]   = [];
    const emotions: string[] = [];

    const topicKeywords: Record<string, string> = {
      'placement': 'placements/job',  'exam':    'upcoming exam',
      'test':      'upcoming test',   'fight':   'fight/argument',
      'gussa':     'anger/argument',  'rona':    'crying/upset',
      'bored':     'boredom',         'bore':    'boredom',
      'college':   'college',         'hostel':  'hostel',
      'ghar':      'home/family',     'startup': 'startup/work',
      'project':   'project work',    'paise':   'money/finances',
      'khana':     'food',            'sona':    'sleep/tiredness',
      'neend':     'sleep/tiredness', 'thak':    'tiredness',
      'bimar':     'health/illness',  'doctor':  'health/illness'
    };

    const emotionKeywords: Record<string, string> = {
      'nervous': 'nervous',  'scared':     'anxious',
      'dar':     'fearful',  'happy':      'happy',
      'khush':   'happy',    'sad':        'sad',
      'udaas':   'sad',      'angry':      'angry',
      'frustrated': 'frustrated', 'excited': 'excited',
      'miss':    'missing someone', 'love':  'affectionate',
      'pyaar':   'affectionate'
    };

    for (const [keyword, label] of Object.entries(topicKeywords)) {
      if (allText.includes(keyword) && !topics.includes(label)) topics.push(label);
    }
    for (const [keyword, label] of Object.entries(emotionKeywords)) {
      if (allText.includes(keyword) && !emotions.includes(label)) emotions.push(label);
    }

    const parts: string[] = [];
    if (topics.length > 0)   parts.push(`Topics mentioned: ${topics.slice(0, 3).join(', ')}`);
    if (emotions.length > 0) parts.push(`Emotional tone: ${emotions.slice(0, 2).join(', ')}`);

    return parts.join(' | ');
  }


  /**
   * Summarize last N messages into 1-2 sentences and save to ConversationMeta
   * Called from reply.worker.ts AFTER sending a reply
   * UNCHANGED
   */
  async summarizeAndSave(
    userId: string,
    contactId: string,
    contactName: string
  ): Promise<void> {
    try {
      const recentMessages = await Message.find({ userId, contactId })
        .sort({ timestamp: -1 })
        .limit(20)
        .lean();

      if (recentMessages.length < 3) return;

      const conversationText = recentMessages
        .reverse()
        .map((msg: any) => {
          const sender = msg.direction === 'incoming' ? contactName : 'Me';
          return `${sender}: ${msg.finalText || msg.originalContent || ''}`;
        })
        .filter(line => line.trim().length > 5)
        .join('\n');

      const completion = await groq.chat.completions.create({
        model: GROQ_MODELS.CHAT,
        messages: [
          {
            role: 'system',
            content: `You summarize WhatsApp conversations in 1-2 sentences.
Focus on: what is currently being talked about, the emotional tone, and any specific topic or event mentioned.
Output ONLY the summary — no intro, no label, no explanation.
Example output: "They are discussing placement preparation. The contact seems nervous about upcoming interviews."`
          },
          {
            role: 'user',
            content: `Summarize this conversation in 1-2 sentences:\n\n${conversationText}`
          }
        ],
        temperature: 0.3,
        max_tokens:  80,
        top_p:       1
      });

      const summary = completion.choices[0]?.message?.content?.trim();
      if (!summary) return;

      await ConversationMeta.findOneAndUpdate(
        { userId, contactId },
        { summary, updatedAt: new Date() },
        { upsert: true, new: true }
      );

      console.log(`📝 [SUMMARY] Saved for ${contactName}: "${summary}"`);

    } catch (error: any) {
      console.error('⚠️ [SUMMARY] Failed (non-critical):', error.message);
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
        file:            audioFile,
        model:           GROQ_MODELS.WHISPER,
        response_format: 'verbose_json'
      });

      const text = transcription.text?.trim();
      if (!text) throw new Error('No transcription returned');

      const language = (transcription as any).language || 'unknown';

      console.log(`✅ Transcription complete: "${text.substring(0, 50)}..."`);
      console.log(`🌐 Detected language: ${language}`);

      return { text, language: this.mapWhisperLanguage(language) };

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
      'en': 'English', 'hi': 'Hindi',    'te': 'Telugu',
      'ta': 'Tamil',   'mr': 'Marathi',  'bn': 'Bengali',
      'gu': 'Gujarati','kn': 'Kannada',  'ml': 'Malayalam',
      'pa': 'Punjabi', 'ur': 'Urdu',     'or': 'Oriya'
    };
    return languageMap[code.toLowerCase()] || 'English';
  }


  /**
   * Split a reply into 1-3 natural parts like a human texting
   * UNCHANGED
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
        !['aur','par','lekin','waise','btw','but','and','oh','haan'].includes(p.toLowerCase())
      );

    if (parts.length >= 2) return parts.slice(0, 3);

    const sentences = trimmed
      .split(/(?<=[.!?])\s+/)
      .filter(s => s && s.trim().length > 3);

    if (sentences.length >= 2) return sentences.slice(0, 3);

    return [trimmed];
  }


  /**
   * Detect Hinglish
   * UNCHANGED
   */
  private isHinglish(message: string): boolean {
    const hinglishMarkers = [
      'kya','kar','rha','rhi','rhe','hai','hain','ho','tha','thi',
      'the','kha','piya','aya','ayi','gaya','gayi','karo','karna',
      'nahi','nhi','haan','acha','theek','thik','bhai','yaar','kal',
      'aaj','abhi','sab','mera','meri','tera','teri','kaise','kaisa',
      'kab','kahan','kyun','kyunki','lekin','aur','matlab','bilkul',
      'zaroor','accha','bata','beta','beti','maa','papa','didi',
      'bhaiya','khana','peena','uth','dekh','sun','bol','hun',
      'hoon','bas','thoda','bahut','zyada','kam','hogya','hogaya',
      'aa','ja','ruk','bolo','suno','dekho','sb','toh','bhi','sirf',
      'tumhara','tumhari','apna','apni','kaisi','batao'
    ];

    const lower      = message.toLowerCase();
    const words      = lower.split(/\s+/);
    const matchCount = words.filter(word =>
      hinglishMarkers.includes(word.replace(/[^a-z]/g, ''))
    ).length;

    return matchCount >= 2 || (words.length <= 4 && matchCount >= 1);
  }


  /**
   * Build the complete system prompt
   * CHANGED: added contactStyleSummary, sensitiveTopics, conversationState, timeContext
   */
  private buildSystemPrompt(
    styleSummary: string,
    contactName: string,
    relation: string,
    conversationContext: string,
    incomingMessage: string,
    incomingLanguage: string,
    knowledgeBase: string,
    aboutMe: string              = '',
    userName: string             = '',
    aiLang: string               = 'auto',
    aiTone: string               = 'friendly',
    aiLength: string             = 'match',
    conversationSummary: string  = '',
    contextHints: string         = '',
    contactStyleSummary: string  = '',  // ✅ NEW
    sensitiveTopics: string[]    = [],  // ✅ NEW
    conversationState: string    = '',  // ✅ NEW
    timeContext: string          = ''   // ✅ NEW
  ): string {

    // ── LANGUAGE / TONE / LENGTH RULES ───────────────────────────────────

    let detectedLanguage: string;
    if (aiLang === 'auto') {
      detectedLanguage = this.isHinglish(incomingMessage) ? 'Hinglish' : incomingLanguage;
    } else {
      const langMap: Record<string, string> = {
        english: 'English', hindi: 'Hindi', hinglish: 'Hinglish', tamil: 'Tamil'
      };
      detectedLanguage = langMap[aiLang] || 'Hinglish';
    }

    const rule1 =
      detectedLanguage === 'Hinglish'
        ? `LANGUAGE: Reply in Hinglish only — Hindi words in Roman script, exactly how Indians text casually (e.g. "bas free hun", "haan sab thik hai"). Never formal Hindi. Never switch to English even for emotional or difficult topics — if you can't say it in Hinglish, simplify it.`
      : detectedLanguage === 'Hindi'
        ? `LANGUAGE: Reply in Hindi using Devanagari script only. Never switch to English or Roman script.`
      : detectedLanguage === 'English'
        ? `LANGUAGE: Reply in English only. Never mix Hindi, Hinglish, or any other language.`
      : detectedLanguage === 'Tamil'
        ? `LANGUAGE: Reply in Tamil script only. Never switch to any other language.`
      : `LANGUAGE: Reply in ${detectedLanguage} only — match the incoming message language exactly.`;

    const rule2 =
      aiTone === 'professional'
        ? `TONE: Formal and polite. Complete sentences. No slang or abbreviations.`
      : aiTone === 'casual'
        ? `TONE: Casual and relaxed — like texting a close friend. Abbreviations and short replies are fine.`
      : `TONE: Warm and natural — like texting someone you genuinely care about. Conversational but not sloppy.`;

    const rule3 =
      aiLength === 'short'
        ? `LENGTH: Keep replies SHORT — 1 to 2 sentences maximum.`
      : aiLength === 'medium'
        ? `LENGTH: Write 3–4 sentences. More detail but never paragraphs.`
      : `LENGTH: Mirror the incoming message length exactly. 3 words in → 3–6 words out. 3 sentences in → 2–3 sentences out.`;

    // ── CONTEXT BLOCKS ────────────────────────────────────────────────────

    // ✅ NEW — Always first: time + conversation state
    const currentContextBlock = `━━━ CURRENT CONTEXT ━━━
${timeContext}${conversationState ? `\nConversation state: ${conversationState}` : ''}
━━━━━━━━━━━━━━━━━━`;

    const identityBlock = (aboutMe || userName)
      ? `━━━ WHO YOU ARE ━━━
${userName ? `Name: ${userName}\n` : ''}${aboutMe}
These are confirmed facts about yourself. ALWAYS stay consistent. Never contradict them. If asked about something not listed here — deflect naturally rather than guessing.
━━━━━━━━━━━━━━━━━━`
      : '';

    const contactBlock = knowledgeBase.trim()
      ? `━━━ ABOUT ${contactName.toUpperCase()} ━━━
${knowledgeBase.trim()}
━━━━━━━━━━━━━━━━━━`
      : '';

    // ✅ NEW — How the CONTACT texts (not the user — the other person)
    const contactStyleBlock = contactStyleSummary.trim()
      ? `━━━ HOW ${contactName.toUpperCase()} TEXTS ━━━
${contactStyleSummary.trim()}
Use this to anticipate their mood and communication style — not to mimic them, but to understand them.
━━━━━━━━━━━━━━━━━━`
      : '';

    const styleBlock = styleSummary.trim()
      ? `━━━ YOUR TEXTING STYLE ━━━
${styleSummary.trim()}
(This takes priority over the length rule — if your natural style conflicts with it, follow your style.)
━━━━━━━━━━━━━━━━━━`
      : '';

    const summaryBlock = conversationSummary
      ? `━━━ WHAT THIS CONVERSATION IS ABOUT ━━━
${conversationSummary}
${contextHints ? `Context signals: ${contextHints}` : ''}
(Use this to stay on topic. Don't ignore what was already discussed.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      : contextHints
        ? `━━━ CONVERSATION CONTEXT SIGNALS ━━━
${contextHints}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        : '';

    const conversationBlock = `━━━ RECENT CONVERSATION ━━━
${conversationContext || 'This is the start of the conversation.'}
━━━━━━━━━━━━━━━━━━`;

    // ── CONDITIONAL RULES ─────────────────────────────────────────────────

    const conditionalRules: string[] = [];

    if (aboutMe || userName) {
      conditionalRules.push(
        `C1. If asked about yourself — answer ONLY from WHO YOU ARE. Never guess or invent anything not written there.`
      );
    }
    if (knowledgeBase.trim()) {
      conditionalRules.push(
        `C2. Use what you know about ${contactName} naturally — let it shape your replies without reciting it.`
      );
    }
    if (styleSummary.trim()) {
      conditionalRules.push(
        `C3. Your phrases from YOUR TEXTING STYLE are gold — use them when they fit, never force them.`
      );
    }
    if (conversationSummary || contextHints) {
      conditionalRules.push(
        `C4. STAY ON TOPIC: The conversation context above tells you what's being discussed. Connect your reply to that thread. Don't reply as if the conversation just started.`
      );
    }
    // ✅ NEW — Only injected if user has defined sensitive topics
    if (sensitiveTopics.length > 0) {
      conditionalRules.push(
        `C5. NEVER bring up or continue these topics: ${sensitiveTopics.join(', ')}. If ${contactName} brings one up — acknowledge very briefly and redirect naturally.`
      );
    }

    const conditionalRulesBlock = conditionalRules.length > 0
      ? conditionalRules.join('\n')
      : '';

    // ── UNIVERSAL RULES ───────────────────────────────────────────────────
    // ✅ NEW — Rule 0: relation behavior injected at the top (highest priority)

    const universalRules = `RULES — FOLLOW ALL WITHOUT EXCEPTION:

0. ${this.getRelationBehavior(relation)}
1. ${rule1}
2. ${rule2}
3. ${rule3}
4. NEVER BREAK CHARACTER: Never reveal or hint you are AI. If asked "are you a bot?" — deflect like a real person: "arrey kya bol raha hai" / "haha why would I be a bot". Never confirm.
5. NEVER INVENT FACTS: Never state a specific time, date, location, meal, or event unless it is in WHO YOU ARE. Deflect: "arrey phone check kar", "abhi yaad nahi yaar". Never guess.
6. MATCH EMOTIONAL ENERGY: If they are upset — be warm and calm. If excited — match it. If angry or hurt — no smileys. Never robotically positive.
7. ONE QUESTION MAX: Never ask more than one question per reply. Remove all extra questions.
8. VARY YOUR ENDINGS: Check the last outgoing message in RECENT CONVERSATION. If it ended with a question — end this one with a statement. Never repeat the same closing phrase or question back to back.
9. EMOJI RULES: Use emojis based on actual emotion of the reply. Never repeat the same emoji in consecutive messages. Skip emojis entirely in serious/tense/sad conversations. Max 1–2 per message.
10. PLAIN TEXT ONLY: No markdown, no asterisks, no bullet points, no headers. WhatsApp only — plain conversational text.
11. NO OPENING GREETINGS: If RECENT CONVERSATION has prior messages — never start with "Hi", "Hey", "Haan", or any greeting. Jump straight in.
12. NO THERAPY MODE: Never give long emotional advice or motivational speeches. "arrey chill kar yaar" beats a 4-sentence pep talk every time.
13. MATCH PLAYFUL/SARCASTIC ENERGY: If the message is teasing or joking — hit back with humor or mock-offence. Never respond to a joke with a flat neutral reply.
14. NATURAL PUSHBACK: In romantic or close-friend contexts, being 100% agreeable every time is unnatural. If someone says "don't talk to me" or "go sleep" — a light playful pushback is more human than immediate agreement.
${conditionalRulesBlock ? `\n${conditionalRulesBlock}` : ''}`;

    // ── FINAL ASSEMBLY ────────────────────────────────────────────────────

    const contextBlocks = [
      currentContextBlock,  // ✅ Always first — time + session state
      identityBlock,
      contactBlock,
      contactStyleBlock,    // ✅ NEW — how the contact texts
      summaryBlock,
      styleBlock,
      conversationBlock
    ]
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
   * Test personality profile
   * UNCHANGED
   */
  async testPersonality(userId: string, contactId: string, testMessage: string): Promise<string> {
    return this.generateReply(userId, contactId, testMessage, 'English');
  }


  /**
   * Enhance rough notes into a rich knowledge base paragraph
   * UNCHANGED
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
6. Output ONLY the paragraph — nothing else`
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
        max_tokens:  300,
        top_p:       1
      });

      const enhanced = completion.choices[0]?.message?.content?.trim();
      if (!enhanced) throw new Error('No enhanced context returned');

      console.log(`✅ Context enhanced for ${contactName}`);
      return enhanced;

    } catch (error: any) {
      console.error('Error enhancing context:', error);
      throw new Error(`Failed to enhance context: ${error.message}`);
    }
  }
}


export default new GroqService();