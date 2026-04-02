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
 * UNCHANGED
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

    const fileContent = req.file.buffer.toString('utf-8');

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
 * UNCHANGED
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
 * UNCHANGED
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
 * UNCHANGED
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


/**
 * PATCH /api/v1/personality/knowledge-base
 * UNCHANGED
 */
router.patch('/knowledge-base', async (req: Request, res: Response) => {
  try {
    const { userId, contactId, knowledgeBase } = req.body;

    if (!userId || !contactId) {
      res.status(400).json({
        success: false,
        message: 'userId and contactId are required'
      });
      return;
    }

    if (typeof knowledgeBase !== 'string') {
      res.status(400).json({
        success: false,
        message: 'knowledgeBase must be a string'
      });
      return;
    }

    await personalityService.saveKnowledgeBase(userId, contactId, knowledgeBase.trim());

    res.status(200).json({
      success: true,
      message: 'Knowledge base saved successfully'
    });

  } catch (error: any) {
    console.error('Save knowledge base error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save knowledge base'
    });
  }
});


/**
 * GET /api/v1/personality/knowledge-base
 * UNCHANGED
 */
router.get('/knowledge-base', async (req: Request, res: Response) => {
  try {
    const { userId, contactId } = req.query;

    if (!userId || !contactId) {
      res.status(400).json({
        success: false,
        message: 'userId and contactId are required'
      });
      return;
    }

    const knowledgeBase = await personalityService.getKnowledgeBase(
      userId as string,
      contactId as string
    );

    res.status(200).json({
      success: true,
      data: { knowledgeBase }
    });

  } catch (error: any) {
    console.error('Get knowledge base error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get knowledge base'
    });
  }
});


/**
 * POST /api/v1/personality/enhance-context
 * Takes rough user notes → returns AI-expanded paragraph
 * NEW
 */
router.post('/enhance-context', async (req: Request, res: Response) => {
  try {
    const { roughText, contactName, relation } = req.body;

    if (!roughText || !contactName || !relation) {
      res.status(400).json({
        success: false,
        message: 'roughText, contactName, and relation are required'
      });
      return;
    }

    if (roughText.trim().length < 5) {
      res.status(400).json({
        success: false,
        message: 'Please write at least a few words before enhancing'
      });
      return;
    }

    const enhanced = await groqService.enhanceContext(
      roughText.trim(),
      contactName,
      relation
    );

    res.status(200).json({
      success: true,
      data: { enhanced }
    });

  } catch (error: any) {
    console.error('Enhance context error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to enhance context'
    });
  }
});


export default router;