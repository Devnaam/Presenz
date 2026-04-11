import { Worker, Job } from 'bullmq';
import redis from '../config/redis';
import { QUEUE_NAMES } from '../config/queue';
import { Message, FamilyContact, StudentStatus, PersonalityProfile } from '../models';
import { MessageDirection, MessageStatus, MessageType } from '../types';
import groqService from '../services/groq.service';
import whatsappService from '../services/whatsapp.service';
import { detectLanguage } from '../utils/language';
import subscriptionService from '../services/subscription.service';


interface ReplyJobData {
  userId: string;
  contactId: string;
  messageId: string;
  messageText: string;
  messageType: 'text' | 'voice';
}


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
        concurrency: 5,
        limiter: {
          max: 10,
          duration: 1000
        }
      }
    );
    this.setupEventHandlers();
  }


  private async processReplyJob(job: Job<ReplyJobData>): Promise<void> {
    const { userId, contactId, messageId, messageText } = job.data;

    console.log(`🔄 Processing reply job for message: ${messageId}`);

    try {
      // Step 1: Validate all conditions
      const isValid = await this.validateReplyConditions(userId, contactId);
      if (!isValid) {
        console.log('⚠️ Reply conditions not met - skipping');
        return;
      }

      // Step 2: Rate limit check
      const shouldRateLimit = await this.checkRateLimit(userId, contactId, messageId);
      if (shouldRateLimit) {
        console.log('⏱️ Rate limit active - skipping reply');
        return;
      }

      // ─────────────────────────────────────────────────────────────────
      // Step 3: DEBOUNCE — wait 4 seconds, then check if a newer message
      // arrived from this contact. If yes, skip — let the newest job reply
      // with full context. This batches rapid "Hi / Kya kar rhi ho / Batao"
      // bursts into a single coherent reply.
      // ─────────────────────────────────────────────────────────────────
      console.log('⏳ [DEBOUNCE] Waiting 4s for burst messages...');
      await this.sleep(1000);

      const incomingMessage = await Message.findById(messageId);
      if (!incomingMessage) {
        console.log('⚠️ Message not found in DB — skipping');
        return;
      }

      const newerMessage = await Message.findOne({
        userId,
        contactId,
        direction: MessageDirection.INCOMING,
        timestamp: { $gt: incomingMessage.timestamp }
      });

      if (newerMessage) {
        console.log('⏭️ [DEBOUNCE] Newer message exists — skipping, letting that job reply');
        return;
      }

      // ─────────────────────────────────────────────────────────────────
      // Step 4: HUMAN SILENCE — ~15% chance of not replying to very short
      // casual messages (1–2 words). Real people go quiet sometimes.
      // ─────────────────────────────────────────────────────────────────
      if (this.decideSilence(messageText)) {
        console.log('🤫 [SILENCE] Going quiet on this one — simulating being busy');
        return;
      }

      // Step 5: Get contact
      const contact = await FamilyContact.findById(contactId);
      if (!contact) throw new Error('Contact not found');

      // ─────────────────────────────────────────────────────────────────
      // Step 6: READ RECEIPT — mark as read before typing
      // Humans read the message before they reply
      // ─────────────────────────────────────────────────────────────────
      if (incomingMessage.whatsappMessageId) {
        await whatsappService.markAsRead(
          userId,
          contact.phone,
          incomingMessage.whatsappMessageId
        );
        console.log('👁️ [READ] Message marked as read');
        // Short human pause after reading before starting to type
        await this.sleep(300 + Math.random() * 200);
      }

      // Step 7: Detect language
      const language = detectLanguage(messageText);

      // ─────────────────────────────────────────────────────────────────
      // Step 8: GENERATE REPLY — while showing typing indicator
      // ─────────────────────────────────────────────────────────────────
      await whatsappService.sendTypingIndicator(userId, contact.phone);
      console.log('🤖 Generating AI reply...');

      const aiReply = await groqService.generateReply(
        userId,
        contactId,
        messageText,
        language
      );

      if (!aiReply) throw new Error('AI failed to generate reply');
      console.log(`✅ AI Reply: ${aiReply}`);

      // ─────────────────────────────────────────────────────────────────
      // Step 9: SPLIT LIKE HUMAN — break long replies into 2–3 parts
      // Real people never send one huge wall of text
      // ─────────────────────────────────────────────────────────────────
      const parts = groqService.splitLikeHuman(aiReply);
      console.log(`📨 [SPLIT] Sending ${parts.length} message part(s)`);

      // ─────────────────────────────────────────────────────────────────
      // Step 10: TYPING DELAY — simulate actual time to type the message
      // Based on reply length so longer replies take more time
      // ─────────────────────────────────────────────────────────────────
      const firstDelay = this.calculateTypingDelay(parts[0]);
      console.log(`⌨️  [TYPING] Simulating ${Math.round(firstDelay / 1000)}s typing time...`);
      await this.sleep(firstDelay);

      // ─────────────────────────────────────────────────────────────────
      // Step 11: SEND ALL PARTS with natural inter-message pauses
      // ─────────────────────────────────────────────────────────────────
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          // Brief pause between parts — person typed the next thought
          await whatsappService.sendTypingIndicator(userId, contact.phone);
          const interDelay = 600 + Math.random() * 400;
          await this.sleep(interDelay);
        }
        await whatsappService.sendMessage(userId, contact.phone, parts[i]);
        console.log(`📤 [SEND] Part ${i + 1}/${parts.length}: "${parts[i]}"`);
      }

      // Stop typing indicator after all messages sent
      await whatsappService.stopTypingIndicator(userId, contact.phone);

      // Step 12: Save outgoing message to DB
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

      await subscriptionService.incrementReplyCount(userId);
      console.log(`📊 [LIMIT] Reply count incremented for user: ${userId}`);

      groqService.summarizeAndSave(userId, contactId, contact.name).catch(() => { });

      // Step 13: Update incoming message status
      await Message.findByIdAndUpdate(messageId, {
        status: MessageStatus.REPLIED
      });

      console.log(`✅ Reply sent successfully to ${contact.name}`);

    } catch (error: any) {
      console.error('❌ Error processing reply job:', error);

      // Always try to stop typing indicator on failure
      try {
        const contact = await FamilyContact.findById(contactId);
        if (contact) {
          await whatsappService.stopTypingIndicator(userId, contact.phone);
        }
      } catch (_) { }

      await Message.findByIdAndUpdate(messageId, {
        status: MessageStatus.FAILED
      });

      throw error;
    }
  }


  /**
   * Calculate realistic typing delay based on text length.
   * Shorter messages: 1.5–3s. Longer messages: up to 10s.
   * Jitter ensures no two replies feel robotic/identical.
   */
  private calculateTypingDelay(text: string): number {
    const CHARS_PER_SECOND = 20;                          // faster typer
    const base = (text.length / CHARS_PER_SECOND) * 1000;
    const jitter = (Math.random() - 0.5) * 500;          // less variance
    return Math.min(Math.max(base + jitter, 800), 2500);  // cap at 2.5s
  }


  /**
   * Randomly decide to go silent.
   * Only applies to very short 1–2 word messages (casual greetings).
   * 15% chance — makes the AI feel less like a bot that always replies.
   */
  private decideSilence(message: string): boolean {
    const wordCount = message.trim().split(/\s+/).length;
    return wordCount <= 2 && Math.random() < 0.15;
  }


  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  /**
   * Validate all reply conditions
   */
  private async validateReplyConditions(userId: string, contactId: string): Promise<boolean> {
    const canUseAI = await subscriptionService.canUseAI(userId);
    if (!canUseAI) {
      console.log('❌ Subscription expired - AI features disabled');
      return false;
    }

    const studentStatus = await StudentStatus.findOne({ userId });
    if (!studentStatus || studentStatus.mode === 'available') {
      console.log('❌ Student is available');
      return false;
    }

    const contact = await FamilyContact.findById(contactId);
    if (!contact || !contact.isActive) {
      console.log('❌ Contact is not active');
      return false;
    }

    const profile = await PersonalityProfile.findOne({ userId, contactId });
    if (!profile || !profile.systemPrompt) {
      console.log('❌ No personality profile found');
      return false;
    }

    return true;
  }


  /**
   * Check if we should rate limit.
   * Skips only if we already replied AFTER this specific incoming message.
   * 5-second cooldown prevents duplicate jobs from firing twice.
   */
  private async checkRateLimit(
    userId: string,
    contactId: string,
    messageId: string
  ): Promise<boolean> {
    const COOLDOWN_MS = 5 * 1000;

    const incomingMessage = await Message.findById(messageId);
    if (!incomingMessage) return false;

    const lastReply = await Message.findOne({
      userId,
      contactId,
      direction: MessageDirection.OUTGOING
    }).sort({ timestamp: -1 });

    if (!lastReply) return false;

    const repliedRecently = (Date.now() - lastReply.timestamp.getTime()) < COOLDOWN_MS;
    const alreadyRepliedToThis = lastReply.timestamp >= incomingMessage.timestamp;

    return repliedRecently && alreadyRepliedToThis;
  }


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


  async close(): Promise<void> {
    await this.worker.close();
    console.log('🔌 Reply Worker closed');
  }
}


export default new ReplyWorker();