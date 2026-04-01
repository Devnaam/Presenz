import { Queue, QueueEvents } from 'bullmq';
import redis from './redis';


// Queue names
export const QUEUE_NAMES = {
  REPLY_QUEUE: 'reply-queue',
  VOICE_TRANSCRIPTION: 'voice-transcription-queue'
};


// Queue configurations
const queueConfig = {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 10000
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600
    },
    removeOnFail: {
      count: 50
    }
  }
};


// Create queues
export const replyQueue = new Queue(QUEUE_NAMES.REPLY_QUEUE, queueConfig);
export const voiceQueue = new Queue(QUEUE_NAMES.VOICE_TRANSCRIPTION, queueConfig);


// Queue events for monitoring
const replyQueueEvents = new QueueEvents(QUEUE_NAMES.REPLY_QUEUE, {
  connection: redis
});


replyQueueEvents.on('completed', ({ jobId }) => {
  console.log(`✅ Job ${jobId} completed`);
});


replyQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Job ${jobId} failed: ${failedReason}`);
});


console.log('📬 BullMQ Queues initialized');