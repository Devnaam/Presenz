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
      delay: 10000 // 10 seconds
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600 // Keep for 24 hours
    },
    removeOnFail: {
      count: 50 // Keep last 50 failed jobs
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

const voiceQueueEvents = new QueueEvents(QUEUE_NAMES.VOICE_TRANSCRIPTION, {
  connection: redis
});


replyQueueEvents.on('completed', ({ jobId }) => {
  console.log(`✅ Reply job ${jobId} completed`);
});

replyQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Reply job ${jobId} failed: ${failedReason}`);
});

voiceQueueEvents.on('completed', ({ jobId }) => {
  console.log(`✅ Voice job ${jobId} completed`);
});

voiceQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Voice job ${jobId} failed: ${failedReason}`);
});


console.log('📬 BullMQ Queues initialized');