import { PersonalityProfile } from '../models';
import { MessageSender } from '../types';
import {
  parseWhatsAppChat,
  separateMessagesBySender,
  cleanMessages,
  convertToRawMessages,
  selectRepresentativeMessages
} from '../utils/chatParser';
import { detectDominantLanguages } from '../utils/language';
import { groq, GROQ_MODELS } from '../config/groq'; // ← NEW IMPORT


interface RawMessage {
  timestamp: Date;
  sender: string;
  text: string;
  language: string;
}


class PersonalityService {

  /**
   * Process uploaded chat file and build personality profile
   */
  async processChatExport(
    userId: string,
    contactId: string,
    fileContent: string,
    studentName: string
  ): Promise<{
    messageCount: number;
    dominantLanguages: string[];
    success: boolean;
  }> {
    try {
      console.log('📄 Parsing chat file...');
      const parsedMessages = await parseWhatsAppChat(fileContent);

      if (parsedMessages.length === 0) {
        throw new Error('No messages found in chat file');
      }

      console.log('👥 Separating messages by sender...');
      const { studentMessages, familyMessages } = separateMessagesBySender(
        parsedMessages,
        studentName
      );

      if (studentMessages.length < 10) {
        throw new Error('Not enough student messages found. Please ensure the chat export contains your own messages.');
      }

      console.log('🧹 Cleaning messages...');
      const cleanedStudentMessages = cleanMessages(studentMessages);
      const cleanedFamilyMessages = cleanMessages(familyMessages);

      console.log('🌐 Detecting languages...');
      const studentRawMessages = convertToRawMessages(
        cleanedStudentMessages,
        MessageSender.STUDENT
      );
      const familyRawMessages = convertToRawMessages(
        cleanedFamilyMessages,
        MessageSender.FAMILY
      );

      const allTexts = studentRawMessages.map(msg => msg.text);
      const dominantLanguages = detectDominantLanguages(allTexts);

      console.log('🎯 Selecting representative messages...');
      const representativeMessages = selectRepresentativeMessages(studentRawMessages, 150);

      // ── CHANGED: now async, calls Groq for compact style summary ─────────
      console.log('🧠 Generating AI style summary...');
      const systemPrompt = await this.buildPersonalityPrompt(
        representativeMessages,
        studentRawMessages,
        familyRawMessages,
        studentName,
        dominantLanguages
      );

      console.log('💾 Saving personality profile...');
      await PersonalityProfile.findOneAndUpdate(
        { userId, contactId },
        {
          userId,
          contactId,
          rawMessages: [...studentRawMessages, ...familyRawMessages],
          messageCount: studentRawMessages.length,
          dominantLanguages,
          systemPrompt,
          processedAt: new Date()
        },
        { upsert: true, returnDocument: 'after' }
      );

      console.log('✅ Personality profile created successfully');

      return {
        messageCount: studentRawMessages.length,
        dominantLanguages,
        success: true
      };

    } catch (error: any) {
      console.error('Error processing chat export:', error);
      throw new Error(`Failed to process chat: ${error.message}`);
    }
  }


  /**
   * Analyze texting style from substantive messages only (10+ chars)
   * Ignores single-word filler replies like "haa", "ok", "nhi"
   * UNCHANGED
   */
  private analyzeStyle(messages: RawMessage[]): {
    usesEmoji: boolean;
    emojiFrequency: string;
    usesPunctuation: boolean;
    usesAbbreviations: boolean;
    capitalizationStyle: string;
    lengthDescription: string;
  } {
    const substantive = messages.filter(m => m.text.length >= 10);
    const sample = substantive.length > 0 ? substantive : messages;

    if (sample.length === 0) {
      return {
        usesEmoji: false,
        emojiFrequency: 'rarely',
        usesPunctuation: false,
        usesAbbreviations: false,
        capitalizationStyle: 'mostly lowercase',
        lengthDescription: 'short but complete thoughts'
      };
    }

    const avgLen = sample.reduce((sum, m) => sum + m.text.length, 0) / sample.length;

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const emojiRatio = sample.filter(m => emojiRegex.test(m.text)).length / sample.length;

    const punctuationRatio = sample.filter(m => /[.!?,]/.test(m.text)).length / sample.length;

    const abbreviations = [
      'nhi', 'nahi', 'haan', 'ok', 'k', 'r', 'u', 'ur', 'wbu', 'hbu',
      'lol', 'omg', 'btw', 'tbh', 'idk', 'bc', 'bhai', 'yaar'
    ];
    const abbrRatio = sample.filter(m =>
      abbreviations.some(a => m.text.toLowerCase().split(/\s+/).includes(a))
    ).length / sample.length;

    const lowerRatio = sample.filter(m => m.text === m.text.toLowerCase()).length / sample.length;

    const lengthDescription = avgLen < 25
      ? 'short and casual — usually 1 sentence, sometimes just a phrase'
      : avgLen < 60
      ? 'medium length — 1-2 sentences, conversational'
      : 'tends to write more detailed replies, sometimes 2-3 sentences';

    return {
      usesEmoji: emojiRatio > 0.1,
      emojiFrequency: emojiRatio > 0.4 ? 'frequently (most messages)' : emojiRatio > 0.1 ? 'sometimes' : 'rarely or never',
      usesPunctuation: punctuationRatio > 0.3,
      usesAbbreviations: abbrRatio > 0.2,
      capitalizationStyle: lowerRatio > 0.7 ? 'mostly lowercase' : 'mixed case',
      lengthDescription
    };
  }


  /**
   * Extract conversation pairs — family message → student response.
   * Uses ALL student messages (not the filtered representative subset)
   * so that responses to family messages are not missing.
   * Only includes pairs where student replied with a substantive response (8+ chars).
   * UNCHANGED
   */
  private extractConversationPairs(
    allStudentMessages: RawMessage[],
    familyMessages: RawMessage[]
  ): Array<{ familySaid: string; studentReplied: string }> {
    const pairs: Array<{ familySaid: string; studentReplied: string }> = [];

    const allMessages = [
      ...familyMessages.map(m => ({ ...m, isFamily: true })),
      ...allStudentMessages.map(m => ({ ...m, isFamily: false }))
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const THIRTY_MINUTES = 30 * 60 * 1000;

    for (let i = 0; i < allMessages.length - 1; i++) {
      const current = allMessages[i];
      const next = allMessages[i + 1];

      if (
        current.isFamily &&
        !next.isFamily &&
        current.text.length > 3 &&
        next.text.length >= 8
      ) {
        const timeDiff = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
        if (timeDiff <= THIRTY_MINUTES) {
          pairs.push({
            familySaid: current.text,
            studentReplied: next.text
          });
        }
      }
    }

    return [...pairs]
      .sort(() => Math.random() - 0.5)
      .slice(0, 40);
  }


  /**
   * Extract common phrases — only phrases 8+ chars to avoid single-word noise
   * UNCHANGED
   */
  private extractCommonPhrases(messages: RawMessage[]): string[] {
    const phraseCount: { [key: string]: number } = {};

    for (const msg of messages) {
      const text = msg.text.toLowerCase().trim();
      if (text.length >= 8 && text.length <= 60) {
        phraseCount[text] = (phraseCount[text] || 0) + 1;
      }
    }

    return Object.entries(phraseCount)
      .filter(([_, count]) => count >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([phrase]) => phrase);
  }


  /**
   * NEW: Call Groq to generate a compact 6-8 sentence style summary.
   * Falls back to a plain text summary if Groq call fails.
   */
  private async generateStyleSummary(
    style: ReturnType<typeof this.analyzeStyle>,
    conversationPairs: Array<{ familySaid: string; studentReplied: string }>,
    commonPhrases: string[],
    dominantLanguages: string[],
    studentName: string
  ): Promise<string> {
    try {
      const pairsText = conversationPairs
        .slice(0, 12)
        .map(p => `Contact: "${p.familySaid}"\n${studentName}: "${p.studentReplied}"`)
        .join('\n\n');

      const prompt = `Analyze these WhatsApp messages and write a 6-8 sentence description of this person's texting style. Start with "You text in...". Be specific about their language mix, tone, reply length, and any signature habits. Write only the description — no headings, no bullet points.

Style data:
- Languages used: ${dominantLanguages.join(', ')}
- Reply length: ${style.lengthDescription}
- Emojis: ${style.emojiFrequency}
- Punctuation: ${style.usesPunctuation ? 'uses occasionally' : 'rarely uses'}
- Slang/abbreviations: ${style.usesAbbreviations ? 'yes — uses casual shorthand' : 'mostly writes fully'}
- Capitalization: ${style.capitalizationStyle}
${commonPhrases.length > 0 ? `- Phrases used often: ${commonPhrases.slice(0, 8).join(', ')}` : ''}

Sample conversations:
${pairsText}

Write only the style description paragraph starting with "You text in..."`;

      const completion = await groq.chat.completions.create({
        model: GROQ_MODELS.CHAT,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
      });

      const summary = completion.choices[0]?.message?.content?.trim();
      if (!summary) throw new Error('Empty summary from Groq');

      console.log('✅ Style summary generated:', summary.substring(0, 80) + '...');
      return summary;

    } catch (error: any) {
      console.error('⚠️ Style summary failed, using fallback:', error.message);
      // Fallback: build description from analyzed data without Groq
      return [
        `You text in ${dominantLanguages.join(' and ')}.`,
        style.lengthDescription + '.',
        `You use emojis ${style.emojiFrequency}.`,
        `Your writing is ${style.capitalizationStyle}.`,
        style.usesAbbreviations
          ? 'You use casual shorthand and slang naturally.'
          : 'You usually write words out fully.',
        commonPhrases.length > 0
          ? `Phrases you use often: ${commonPhrases.slice(0, 5).join(', ')}.`
          : ''
      ].filter(Boolean).join(' ');
    }
  }


  /**
   * CHANGED: now async — generates compact AI style summary via Groq
   * instead of building a long raw prompt with all messages.
   */
  private async buildPersonalityPrompt(
    _representativeMessages: RawMessage[],
    allStudentMessages: RawMessage[],
    familyMessages: RawMessage[],
    studentName: string,
    dominantLanguages: string[]
  ): Promise<string> {
    const style = this.analyzeStyle(allStudentMessages);
    const conversationPairs = this.extractConversationPairs(allStudentMessages, familyMessages);
    const commonPhrases = this.extractCommonPhrases(allStudentMessages);

    return await this.generateStyleSummary(
      style,
      conversationPairs,
      commonPhrases,
      dominantLanguages,
      studentName
    );
  }


  /**
   * Get personality profile status
   * CHANGED: added hasKnowledgeBase to return value
   */
  async getProfileStatus(userId: string, contactId: string): Promise<{
    exists: boolean;
    messageCount?: number;
    dominantLanguages?: string[];
    processedAt?: Date;
    hasKnowledgeBase?: boolean; // ← NEW
  }> {
    const profile = await PersonalityProfile.findOne({ userId, contactId });

    if (!profile) {
      return { exists: false };
    }

    return {
      exists: true,
      messageCount: profile.messageCount,
      dominantLanguages: profile.dominantLanguages,
      processedAt: profile.processedAt || undefined,
      hasKnowledgeBase: !!((profile as any).knowledgeBase?.trim()) // ← NEW
    };
  }


  /**
   * Delete personality profile
   * UNCHANGED
   */
  async deleteProfile(userId: string, contactId: string): Promise<void> {
    await PersonalityProfile.findOneAndDelete({ userId, contactId });
  }


  /**
   * NEW: Save freeform knowledge base context for a contact
   */
  async saveKnowledgeBase(userId: string, contactId: string, knowledgeBase: string): Promise<void> {
    await PersonalityProfile.findOneAndUpdate(
      { userId, contactId },
      { $set: { knowledgeBase } },
      { upsert: true, new: true }
    );
  }


  /**
   * NEW: Get knowledge base for a contact
   */
  async getKnowledgeBase(userId: string, contactId: string): Promise<string> {
    const profile = await PersonalityProfile.findOne({ userId, contactId });
    return (profile as any)?.knowledgeBase || '';
  }
}


export default new PersonalityService();