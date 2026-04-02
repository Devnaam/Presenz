import { Router, Request, Response } from 'express';
import { Message } from '../models';
import { MessageDirection } from '../types';


const router = Router();


/**
 * GET /api/v1/activity?userId=&page=&limit=&filter=
 * Returns paginated AI reply activity log
 * filter: 'all' | 'ai' | 'override'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, page = '1', limit = '20', filter = 'all' } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, parseInt(limit as string));
    const skip = (pageNum - 1) * limitNum;

    // Build query based on filter
    const baseQuery: any = {
      userId,
      direction: MessageDirection.OUTGOING,
    };

    if (filter === 'ai') {
      baseQuery.generatedByAI = true;
    } else if (filter === 'override') {
      baseQuery.generatedByAI = true;
      baseQuery.studentOverride = true;
    } else {
      // 'all' — only show outgoing messages that were AI generated
      baseQuery.generatedByAI = true;
    }

    const [messages, total] = await Promise.all([
      Message.find(baseQuery)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('contactId', 'name relation phone')
        .lean(),
      Message.countDocuments(baseQuery),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        messages,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
          hasMore: pageNum < Math.ceil(total / limitNum),
        },
      },
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch activity log'
    });
  }
});


/**
 * GET /api/v1/activity/stats?userId=
 * Quick stats for the activity page header
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));

    const [totalAI, todayAI, overridden] = await Promise.all([
      Message.countDocuments({ userId, generatedByAI: true }),
      Message.countDocuments({
        userId,
        generatedByAI: true,
        timestamp: { $gte: todayStart },
      }),
      Message.countDocuments({
        userId,
        generatedByAI: true,
        studentOverride: true,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: { totalAI, todayAI, overridden },
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch activity stats'
    });
  }
});


export default router;