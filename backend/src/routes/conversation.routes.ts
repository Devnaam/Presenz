import { Router, Request, Response } from 'express';
import { Message, FamilyContact } from '../models';
import { MessageDirection } from '../types';
import whatsappService from '../services/whatsapp.service';

const router = Router();

/**
 * GET /api/v1/conversations
 * Get all conversations with last message
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    // Get all family contacts
    const contacts = await FamilyContact.find({ userId }).lean();

    // Get last message for each contact
    const conversations = await Promise.all(
      contacts.map(async (contact) => {
        const lastMessage = await Message.findOne({
          userId,
          contactId: contact._id
        })
          .sort({ timestamp: -1 })
          .lean();

        const unreadCount = await Message.countDocuments({
          userId,
          contactId: contact._id,
          direction: MessageDirection.INCOMING,
          status: 'received'
        });

        return {
          contact,
          lastMessage,
          unreadCount
        };
      })
    );

    // Sort by last message timestamp
    conversations.sort((a, b) => {
      const timeA = a.lastMessage?.timestamp?.getTime() || 0;
      const timeB = b.lastMessage?.timestamp?.getTime() || 0;
      return timeB - timeA;
    });

    res.status(200).json({
      success: true,
      data: conversations
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch conversations'
    });
  }
});

/**
 * GET /api/v1/conversations/:contactId
 * Get full message history with a contact
 */
router.get('/:contactId', async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const { userId, limit = 50, skip = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    // Get messages
    const messages = await Message.find({ userId, contactId })
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();

    // Get contact details
    const contact = await FamilyContact.findById(contactId).lean();

    // Reverse to show oldest first
    messages.reverse();

    res.status(200).json({
      success: true,
      data: {
        contact,
        messages,
        hasMore: messages.length === Number(limit)
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch conversation'
    });
  }
});

/**
 * POST /api/v1/conversations/send
 * Student sends manual message (override)
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { userId, contactId, message } = req.body;

    if (!userId || !contactId || !message) {
      return res.status(400).json({
        success: false,
        message: 'userId, contactId, and message are required'
      });
    }

    // Get contact
    const contact = await FamilyContact.findById(contactId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Send via WhatsApp
    await whatsappService.sendMessage(userId, contact.phone, message);

    // Save to database
    const savedMessage = await Message.create({
      userId,
      contactId,
      direction: MessageDirection.OUTGOING,
      type: 'text',
      originalContent: message,
      finalText: message,
      generatedByAI: false,
      studentOverride: true,
      status: 'replied',
      timestamp: new Date()
    });

    // Update student activity
    const { StudentStatus } = await import('../models');
    await StudentStatus.findOneAndUpdate(
      { userId },
      { 
        lastActiveAt: new Date(),
        mode: 'available'
      }
    );

    res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: savedMessage
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
 * GET /api/v1/conversations/ai-log
 * Get all AI-generated messages
 */
router.get('/ai-log/all', async (req: Request, res: Response) => {
  try {
    const { userId, days = 1 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const aiMessages = await Message.find({
      userId,
      generatedByAI: true,
      timestamp: { $gte: startDate }
    })
      .populate('contactId', 'name relation')
      .sort({ timestamp: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        messages: aiMessages,
        count: aiMessages.length
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch AI log'
    });
  }
});

export default router;