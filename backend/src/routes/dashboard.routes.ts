import { Router, Request, Response } from 'express';
import { Message, FamilyContact, StudentStatus } from '../models';
import { MessageDirection } from '../types';


const router = Router();


/**
 * GET /api/v1/dashboard/summary
 * CHANGED: accepts ?period=today|7days|30days
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { userId, period = 'today' } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    // NEW: calculate date range based on period
    const endDate = new Date();
    let startDate = new Date();

    if (period === '7days') {
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === '30days') {
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // today (default)
      startDate.setHours(0, 0, 0, 0);
    }

    // Count messages received in period
    const messagesReceived = await Message.countDocuments({
      userId,
      direction: MessageDirection.INCOMING,
      timestamp: { $gte: startDate, $lte: endDate }
    });

    // Count AI replies sent in period
    const aiRepliesSent = await Message.countDocuments({
      userId,
      direction: MessageDirection.OUTGOING,
      generatedByAI: true,
      timestamp: { $gte: startDate, $lte: endDate }
    });

    // Active contacts — always current, not period-bound
    const activeContacts = await FamilyContact.countDocuments({
      userId,
      isActive: true
    });

    // Student status
    const studentStatus = await StudentStatus.findOne({ userId });

    // Recent activity — last 5 messages always
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