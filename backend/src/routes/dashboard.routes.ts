import { Router, Request, Response } from 'express';
import { Message, FamilyContact, StudentStatus } from '../models';
import { MessageDirection } from '../types';


const router = Router();


/**
 * GET /api/v1/dashboard/summary
 * Get dashboard summary statistics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Count messages received today
    const messagesReceived = await Message.countDocuments({
      userId,
      direction: MessageDirection.INCOMING,
      timestamp: { $gte: today, $lt: tomorrow }
    });

    // Count AI replies sent today
    const aiRepliesSent = await Message.countDocuments({
      userId,
      direction: MessageDirection.OUTGOING,
      generatedByAI: true,
      timestamp: { $gte: today, $lt: tomorrow }
    });

    // Count active contacts
    const activeContacts = await FamilyContact.countDocuments({
      userId,
      isActive: true
    });

    // Get student status
    const studentStatus = await StudentStatus.findOne({ userId });

    // Get recent activity (last 5 messages)
    const recentMessages = await Message.find({ userId })
      .sort({ timestamp: -1 })
      .limit(5)
      .populate('contactId', 'name relation')
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        today: {
          messagesReceived,
          aiRepliesSent,
          activeContacts
        },
        status: {
          mode: studentStatus?.mode || 'available',
          autoAwayEnabled: studentStatus?.autoAwayEnabled || false,
          lastActiveAt: studentStatus?.lastActiveAt
        },
        recentActivity: recentMessages
      }
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard summary'
    });
  }
});


export default router;