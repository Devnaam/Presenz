import { groq, GROQ_MODELS, GROQ_CONFIG } from '../config/groq';
import { PersonalityProfile, Message, FamilyContact } from '../models';


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
      
      if (!profile || !profile.systemPrompt) {
        throw new Error('Personality profile not found or incomplete');
      }

      const contact = await FamilyContact.findById(contactId);
      
      if (!contact) {
        throw new Error('Family contact not found');
      }

      const recentMessages = await Message.find({ userId, contactId })
        .sort({ timestamp: -1 })
        .limit(15)
        .lean();

      const conversationContext = recentMessages
        .reverse()
        .map(msg => {
          const sender = msg.direction === 'incoming' ? contact.name : 'You';
          return `${sender}: ${msg.finalText || msg.originalContent}`;
        })
        .join('\n');

      const systemPrompt = this.buildSystemPrompt(
        profile.systemPrompt,
        contact.name,
        contact.relation,
        conversationContext,
        incomingMessage,
        incomingLanguage
      );

      const completion = await groq.chat.completions.create({
        model: GROQ_MODELS.CHAT,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: incomingMessage
          }
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
   * Build the complete system prompt
   */
  private buildSystemPrompt(
    personalityPrompt: string,
    contactName: string,
    relation: string,
    conversationContext: string,
    incomingMessage: string,
    incomingLanguage: string
  ): string {
    return `You are texting your ${relation} (${contactName}).


${personalityPrompt}


CRITICAL RULES:
1. Reply in the EXACT SAME LANGUAGE they are using: ${incomingLanguage}
2. Keep replies SHORT - maximum 2-3 sentences
3. Be warm and natural - like texting family
4. DO NOT make up specific facts or details you don't know
5. DO NOT use formal language or over-explain
6. If you don't know something specific, give a warm vague reply


RECENT CONVERSATION:
${conversationContext || 'No recent conversation'}


NEW MESSAGE FROM ${contactName}:
${incomingMessage}


YOUR REPLY (in ${incomingLanguage}, short and natural):`;
  }


  /**
   * Clean and validate AI reply
   */
  private cleanReply(reply: string): string {
    let cleaned = reply.replace(/[*"]/g, '').trim();

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
}


export default new GroqService();