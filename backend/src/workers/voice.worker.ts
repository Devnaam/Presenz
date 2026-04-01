import { Worker, Job } from 'bullmq';
import redis from '../config/redis';
import { QUEUE_NAMES, replyQueue } from '../config/queue';
import { Message } from '../models';
import cloudinaryService from '../services/cloudinary.service';
import groqService from '../services/groq.service';
import { saveBufferToTemp, convertToMP3, deleteTempFile } from '../utils/audio';

interface VoiceJobData {
  userId: string;
  contactId: string;
  messageId: string;
  audioBuffer: string; // Base64 encoded
}

/**
 * Voice Transcription Worker
 */
class VoiceWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      QUEUE_NAMES.VOICE_TRANSCRIPTION,
      async (job: Job<VoiceJobData>) => {
        return await this.processVoiceJob(job);
      },
      {
        connection: redis,
        concurrency: 3 // Process 3 voice notes concurrently
      }
    );

    this.setupEventHandlers();
  }

  /**
   * Process voice transcription job
   */
  private async processVoiceJob(job: Job<VoiceJobData>): Promise<void> {
    const { userId, contactId, messageId, audioBuffer } = job.data;

    console.log(`🎤 Processing voice note: ${messageId}`);

    let tempOggPath: string | null = null;
    let tempMp3Path: string | null = null;
    let cloudinaryPublicId: string | null = null;

    try {
      // Step 1: Decode base64 buffer
      const buffer = Buffer.from(audioBuffer, 'base64');

      // Step 2: Save original audio to temp file
      const filename = `voice_${Date.now()}.ogg`;
      tempOggPath = await saveBufferToTemp(buffer, filename);

      // Step 3: Convert to MP3 for Groq Whisper
      tempMp3Path = tempOggPath.replace('.ogg', '.mp3');
      await convertToMP3(tempOggPath, tempMp3Path);

      console.log('🔄 Audio converted to MP3');

      // Step 4: Upload original to Cloudinary (for storage)
      const cloudinaryResult = await cloudinaryService.uploadAudio(buffer, filename);
      cloudinaryPublicId = cloudinaryResult.publicId;

      console.log('☁️ Audio uploaded to Cloudinary');

      // Step 5: Transcribe with Groq Whisper
      const transcription = await groqService.transcribeAudio(tempMp3Path);

      console.log(`✅ Transcription: "${transcription.text}"`);

      // Step 6: Update message with transcription
      await Message.findByIdAndUpdate(messageId, {
        transcribedText: transcription.text,
        language: transcription.language,
        originalContent: cloudinaryResult.url
      });

      // Step 7: Push to reply queue (same as text messages)
      await replyQueue.add('generate-reply', {
        userId,
        contactId,
        messageId,
        messageText: transcription.text,
        messageType: 'voice'
      });

      console.log('📬 Voice note queued for AI reply');

      // Step 8: Schedule Cloudinary cleanup (delete after 1 hour)
      setTimeout(async () => {
        if (cloudinaryPublicId) {
          await cloudinaryService.deleteAudio(cloudinaryPublicId);
        }
      }, 60 * 60 * 1000); // 1 hour

    } catch (error: any) {
      console.error('❌ Error processing voice note:', error);
      
      // Update message status to failed
      await Message.findByIdAndUpdate(messageId, {
        status: 'failed'
      });

      throw error;

    } finally {
      // Cleanup temp files
      if (tempOggPath) await deleteTempFile(tempOggPath);
      if (tempMp3Path) await deleteTempFile(tempMp3Path);
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`✅ Voice worker completed job ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Voice worker failed job ${job?.id}:`, err.message);
    });

    console.log('🎙️ Voice Transcription Worker started');
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    await this.worker.close();
    console.log('🔌 Voice Worker closed');
  }
}

export default new VoiceWorker();