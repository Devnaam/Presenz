import cloudinaryService from '../services/cloudinary.service';

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