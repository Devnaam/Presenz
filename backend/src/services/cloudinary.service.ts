import cloudinary from '../config/cloudinary';
import { saveBufferToTemp, deleteTempFile } from '../utils/audio';

class CloudinaryService {
  
  /**
   * Upload audio file to Cloudinary
   */
  async uploadAudio(buffer: Buffer, filename: string): Promise<{
    url: string;
    publicId: string;
    duration: number;
  }> {
    try {
      // Save buffer to temp file
      const tempPath = await saveBufferToTemp(buffer, filename);

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(tempPath, {
        resource_type: 'video', // Audio files are uploaded as 'video' type
        folder: 'presenz/voice-notes',
        public_id: `voice_${Date.now()}`,
        format: 'ogg' // Keep original format
      });

      // Delete temp file
      await deleteTempFile(tempPath);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        duration: result.duration || 0
      };

    } catch (error: any) {
      console.error('Error uploading to Cloudinary:', error);
      throw new Error(`Failed to upload audio: ${error.message}`);
    }
  }

  /**
   * Delete audio file from Cloudinary
   */
  async deleteAudio(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'video'
      });
      console.log(`🗑️ Deleted audio from Cloudinary: ${publicId}`);
    } catch (error: any) {
      console.error('Error deleting from Cloudinary:', error);
    }
  }

  /**
   * Bulk delete old voice notes (cleanup job)
   */
  async deleteOldVoiceNotes(olderThanHours: number = 1): Promise<number> {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        resource_type: 'video',
        prefix: 'presenz/voice-notes/',
        max_results: 500
      });

      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const resource of result.resources) {
        const uploadTime = new Date(resource.created_at).getTime();
        
        if (uploadTime < cutoffTime) {
          await this.deleteAudio(resource.public_id);
          deletedCount++;
        }
      }

      console.log(`🧹 Cleaned up ${deletedCount} old voice notes`);
      return deletedCount;

    } catch (error: any) {
      console.error('Error cleaning up voice notes:', error);
      return 0;
    }
  }
}

export default new CloudinaryService();