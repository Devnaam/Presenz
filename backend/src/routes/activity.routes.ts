import { Router, Request, Response } from 'express';
import { ActivityLog } from '../models';

const router = Router();

/**
 * GET /api/v1/activity?userId=&page=&limit=
 * Paginated account activity timeline
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, page = '1', limit = '20' } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const pageNum  = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, parseInt(limit as string));
    const skip     = (pageNum - 1) * limitNum;

    const [events, total] = await Promise.all([
      ActivityLog.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ActivityLog.countDocuments({ userId }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          total,
          page:       pageNum,
          totalPages: Math.ceil(total / limitNum),
          hasMore:    pageNum < Math.ceil(total / limitNum),
        },
      },
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch activity',
    });
  }
});

export default router;