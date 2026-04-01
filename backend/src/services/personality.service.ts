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
      // Step 1: Parse the chat file
      console.log('📄 Parsing chat file...');
      const parsedMessages = await parseWhatsAppChat(fileContent);

      if (parsedMessages.length === 0) {
        throw new Error('No messages found in chat file');
      }

      // Step 2: Separate student and family messages
      console.log('👥 Separating messages by sender...');
      const { studentMessages, familyMessages } = separateMessagesBySender(
        parsedMessages,
        studentName
      );

      if (studentMessages.length < 10) {
        throw new Error('Not enough student messages found. Please ensure the chat export contains your own messages.');
      }

      // Step 3: Clean messages
      console.log('🧹 Cleaning messages...');
      const cleanedStudentMessages = cleanMessages(studentMessages);
      const cleanedFamilyMessages = cleanMessages(familyMessages);

      // Step 4: Convert to IRawMessage format with language detection
      console.log('🌐 Detecting languages...');
      const studentRawMessages = convertToRawMessages(
        cleanedStudentMessages,
        MessageSender.STUDENT
      );
      const familyRawMessages = convertToRawMessages(
        cleanedFamilyMessages,
        MessageSender.FAMILY
      );

      // Step 5: Detect dominant languages
      const allTexts = studentRawMessages.map(msg => msg.text);
      const dominantLanguages = detectDominantLanguages(allTexts);

      // Step 6: Select representative messages
      console.log('🎯 Selecting representative messages...');
      const representativeMessages = selectRepresentativeMessages(studentRawMessages, 150);

      // Step 7: Build system prompt
      console.log('🧠 Building personality prompt...');
      const systemPrompt = this.buildPersonalityPrompt(
        representativeMessages,
        studentName
      );

      // Step 8: Save or update personality profile
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
        { upsert: true, new: true }
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
   * Build system prompt from student's messages
   */
  private buildPersonalityPrompt(messages: any[], _studentName: string): string {
    // Group messages by language
    const byLanguage: { [key: string]: string[] } = {};
    
    for (const msg of messages) {
      if (!byLanguage[msg.language]) {
        byLanguage[msg.language] = [];
      }
      byLanguage[msg.language].push(msg.text);
    }

    // Build examples section
    let examplesSection = 'YOUR PAST MESSAGES (learn your style from these):\n\n';
    
    for (const [language, texts] of Object.entries(byLanguage)) {
      examplesSection += `[${language} messages]:\n`;
      examplesSection += texts.slice(0, 30).map(text => `- "${text}"`).join('\n');
      examplesSection += '\n\n';
    }

    return examplesSection;
  }


  /**
   * Get personality profile status
   */
  async getProfileStatus(userId: string, contactId: string): Promise<{
    exists: boolean;
    messageCount?: number;
    dominantLanguages?: string[];
    processedAt?: Date;
  }> {
    const profile = await PersonalityProfile.findOne({ userId, contactId });

    if (!profile) {
      return { exists: false };
    }

    return {
      exists: true,
      messageCount: profile.messageCount,
      dominantLanguages: profile.dominantLanguages,
      processedAt: profile.processedAt || undefined
    };
  }


  /**
   * Delete personality profile
   */
  async deleteProfile(userId: string, contactId: string): Promise<void> {
    await PersonalityProfile.findOneAndDelete({ userId, contactId });
  }
}


export default new PersonalityService();