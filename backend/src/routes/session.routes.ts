import { Router, Request, Response } from 'express';
import whatsappService from '../services/whatsapp.service';


const router = Router();


/**
 * POST /api/v1/session/create
 * Create a new WhatsApp session
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    // TODO: Get userId from JWT auth middleware (Phase 5)
    // For now, we'll use a test userId from request body
    const { userId } = req.body;


    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId is required'
      });
      return;
    }


    const result = await whatsappService.createSession(userId);


    res.status(201).json({
      success: true,
      message: 'Session created. Please scan QR code.',
      data: result
    });


  } catch (error: any) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create session'
    });
  }
});


/**
 * GET /api/v1/session/qr
 * Get QR code for scanning (polling endpoint)
 */
router.get('/qr', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;


    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId is required'
      });
      return;
    }


    const status = await whatsappService.getSessionStatus(userId as string);


    res.status(200).json({
      success: true,
      data: status
    });


  } catch (error: any) {
    console.error('Get QR error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get QR code'
    });
  }
});


/**
 * GET /api/v1/session/status
 * Get current session connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;


    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId is required'
      });
      return;
    }


    const status = await whatsappService.getSessionStatus(userId as string);


    res.status(200).json({
      success: true,
      data: status
    });


  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get status'
    });
  }
});


/**
 * POST /api/v1/session/send
 * Send a test message (for development)
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { userId, phoneNumber, message } = req.body;


    if (!userId || !phoneNumber || !message) {
      res.status(400).json({
        success: false,
        message: 'userId, phoneNumber, and message are required'
      });
      return;
    }


    await whatsappService.sendMessage(userId, phoneNumber, message);


    res.status(200).json({
      success: true,
      message: 'Message sent successfully'
    });


  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send message'
    });
  }
});


/**
 * DELETE /api/v1/session/disconnect
 * Disconnect and logout from WhatsApp
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;


    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId is required'
      });
      return;
    }


    await whatsappService.disconnectSession(userId);


    res.status(200).json({
      success: true,
      message: 'Session disconnected successfully'
    });


  } catch (error: any) {
    console.error('Disconnect error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to disconnect'
    });
  }
});


export default router;