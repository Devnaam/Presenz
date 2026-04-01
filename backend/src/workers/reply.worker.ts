import { Worker, Job } from 'bullmq';
import redis from '../config/redis';
import { QUEUE_NAMES } from '../config/queue';
import { Message, FamilyContact, StudentStatus, PersonalityProfile } from '../models';
import { MessageDirection, MessageStatus, MessageType } from '../types';
import groqService from '../services/groq.service';
import whatsappService from '../services/whatsapp.service';
import { detectLanguage } from '../utils/language';

interface ReplyJobData {
  userId: string;
  contactId: string;
  messageId: string;
  messageText: string;
  messageType: 'text' | 'voice';
}

/**
 * Reply Worker - Processes messages and generates AI replies
 */
class ReplyWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      QUEUE_NAMES.REPLY_QUEUE,
      async (job: Job<ReplyJobData>) => {
        return await this.processReplyJob(job);
      },
      {
        connection: redis,
        concurrency: 5, // Process 5 jobs concurrently
        limiter: {
          max: 10,
          duration: 1000 // Max 10 jobs per second
        }
      }
    );

    this.setupEventHandlers();
  }

  /**
   * Process a reply job
   */
  private async processReplyJob(job: Job<ReplyJobData>): Promise<void> {
    const { userId, contactId, messageId, messageText, messageType } = job.data;

    console.log(`🔄 Processing reply job for message: ${messageId}`);

    try {
      // Step 1: Validate all conditions again (in case state changed)
      const isValid = await this.validateReplyConditions(userId, contactId);
      
      if (!isValid) {
        console.log('⚠️ Reply conditions not met - skipping');
        return;
      }

      // Step 2: Check rate limiting (no reply within last 60 seconds)
      const shouldRateLimit = await this.checkRateLimit(userId, contactId);
      
      if (shouldRateLimit) {
        console.log('⏱️ Rate limit active - skipping reply');
        return;
      }

      // Step 3: Detect language
      const language = detectLanguage(messageText);

      // Step 4: Generate AI reply
      console.log('🤖 Generating AI reply...');
      const aiReply = await groqService.generateReply(
        userId,
        contactId,
        messageText,
        language
      );

      if (!aiReply) {
        throw new Error('AI failed to generate reply');
      }

      console.log(`✅ AI Reply: ${aiReply}`);

      // Step 5: Send via WhatsApp
      const contact = await FamilyContact.findById(contactId);
      
      if (!contact) {
        throw new Error('Contact not found');
      }

      await whatsappService.sendMessage(userId, contact.phone, aiReply);

      // Step 6: Save outgoing message to database
      await Message.create({
        userId,
        contactId,
        direction: MessageDirection.OUTGOING,
        type: MessageType.TEXT,
        originalContent: aiReply,
        finalText: aiReply,
        generatedByAI: true,
        studentOverride: false,
        language,
        status: MessageStatus.REPLIED,
        timestamp: new Date()
      });

      // Step 7: Update original incoming message status
      await Message.findByIdAndUpdate(messageId, {
        status: MessageStatus.REPLIED
      });

      console.log(`✅ Reply sent successfully to ${contact.name}`);

    } catch (error: any) {
      console.error('❌ Error processing reply job:', error);
      
      // Update message status to failed
      await Message.findByIdAndUpdate(messageId, {
        status: MessageStatus.FAILED
      });

      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Validate all reply conditions
   */
  private async validateReplyConditions(userId: string, contactId: string): Promise<boolean> {
    // Check 1: Student status must be "away"
    const studentStatus = await StudentStatus.findOne({ userId });
    
    if (!studentStatus || studentStatus.mode === 'available') {
      console.log('❌ Student is available');
      return false;
    }

    // Check 2: Contact must be active
    const contact = await FamilyContact.findById(contactId);
    
    if (!contact || !contact.isActive) {
      console.log('❌ Contact is not active');
      return false;
    }

    // Check 3: Personality profile must exist
    const profile = await PersonalityProfile.findOne({ userId, contactId });
    
    if (!profile || !profile.systemPrompt) {
      console.log('❌ No personality profile found');
      return false;
    }

    return true;
  }

  /**
   * Check if we should rate limit (replied within last 60 seconds)
   */
  private async checkRateLimit(userId: string, contactId: string): Promise<boolean> {
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);

    const recentReply = await Message.findOne({
      userId,
      contactId,
      direction: MessageDirection.OUTGOING,
      timestamp: { $gte: sixtySecondsAgo }
    });

    return !!recentReply;
  }

  /**
   * Setup event handlers for worker
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`✅ Worker completed job ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Worker failed job ${job?.id}:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('❌ Worker error:', err);
    });

    console.log('👷 Reply Worker started');
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    await this.worker.close();
    console.log('🔌 Reply Worker closed');
  }
}

export default new ReplyWorker();