import { Router, Request, Response } from 'express';
import multer from 'multer';
import personalityService from '../services/personality.service';
import groqService from '../services/groq.service';


const router = Router();


// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});


/**
 * POST /api/v1/personality/upload
 * Upload and process WhatsApp chat export
 */
router.post('/upload', upload.single('chatFile'), async (req: Request, res: Response) => {
  try {
    const { userId, contactId, studentName } = req.body;

    if (!userId || !contactId || !studentName) {
      res.status(400).json({
        success: false,
        message: 'userId, contactId, and studentName are required'
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'Chat file is required'
      });
      return;
    }

    // Convert buffer to string
    const fileContent = req.file.buffer.toString('utf-8');

    // Process the chat export
    const result = await personalityService.processChatExport(
      userId,
      contactId,
      fileContent,
      studentName
    );

    res.status(200).json({
      success: true,
      message: 'Personality profile created successfully',
      data: result
    });

  } catch (error: any) {
    console.error('Upload chat error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process chat file'
    });
  }
});


/**
 * GET /api/v1/personality/status
 * Check if personality profile exists
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { userId, contactId } = req.query;

    if (!userId || !contactId) {
      res.status(400).json({
        success: false,
        message: 'userId and contactId are required'
      });
      return;
    }

    const status = await personalityService.getProfileStatus(
      userId as string,
      contactId as string
    );

    res.status(200).json({
      success: true,
      data: status
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get profile status'
    });
  }
});


/**
 * POST /api/v1/personality/test
 * Test the AI with a sample message
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { userId, contactId, message } = req.body;

    if (!userId || !contactId || !message) {
      res.status(400).json({
        success: false,
        message: 'userId, contactId, and message are required'
      });
      return;
    }

    const reply = await groqService.testPersonality(userId, contactId, message);

    res.status(200).json({
      success: true,
      data: {
        incomingMessage: message,
        aiReply: reply
      }
    });

  } catch (error: any) {
    console.error('Test personality error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to test personality'
    });
  }
});


/**
 * DELETE /api/v1/personality/reset
 * Delete personality profile
 */
router.delete('/reset', async (req: Request, res: Response) => {
  try {
    const { userId, contactId } = req.body;

    if (!userId || !contactId) {
      res.status(400).json({
        success: false,
        message: 'userId and contactId are required'
      });
      return;
    }

    await personalityService.deleteProfile(userId, contactId);

    res.status(200).json({
      success: true,
      message: 'Personality profile deleted successfully'
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete profile'
    });
  }
});


export default router;