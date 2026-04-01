import cloudinaryService from '../services/cloudinary.service';
import subscriptionService from '../services/subscription.service';


/**
 * Cleanup old voice notes from Cloudinary
 * Runs every hour
 */
export const startCleanupCron = () => {
  // Run cleanup every hour
  setInterval(async () => {
    console.log('🧹 Running voice note cleanup...');
    await cloudinaryService.deleteOldVoiceNotes(1); // Delete files older than 1 hour
  }, 60 * 60 * 1000); // Every hour

  console.log('⏰ Cleanup cron job started');
};


/**
 * Check expired subscriptions
 * Runs every 6 hours
 */
export const startSubscriptionCron = () => {
  // Run check every 6 hours
  setInterval(async () => {
    console.log('💳 Checking expired subscriptions...');
    await subscriptionService.checkExpiredSubscriptions();
  }, 6 * 60 * 60 * 1000); // Every 6 hours

  // Also run once on startup
  setTimeout(async () => {
    await subscriptionService.checkExpiredSubscriptions();
  }, 5000); // 5 seconds after startup

  console.log('⏰ Subscription cron job started');
};
