import { Router, Request, Response } from 'express';
import { StudentStatus } from '../models';
import { StudentMode } from '../types';


const router = Router();


/**
 * GET /api/v1/status
 * Get current student status
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

    let status = await StudentStatus.findOne({ userId: userId as string });

    // Create default status if not exists
    if (!status) {
      status = await StudentStatus.create({
        userId: userId as string,
        mode: StudentMode.AVAILABLE,
        autoAwayEnabled: true,
        autoAwayMinutes: 30,
        lastActiveAt: new Date()
      });
    }

    return res.status(200).json({
      success: true,
      data: status
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get status'
    });
  }
});


/**
 * PATCH /api/v1/status/mode
 * Manually set student mode (available/away)
 */
router.patch('/mode', async (req: Request, res: Response) => {
  try {
    const { userId, mode } = req.body;

    if (!userId || !mode) {
      return res.status(400).json({
        success: false,
        message: 'userId and mode are required'
      });
    }

    if (!Object.values(StudentMode).includes(mode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mode. Use "available" or "away"'
      });
    }

    const status = await StudentStatus.findOneAndUpdate(
      { userId },
      {
        mode,
        lastActiveAt: new Date()
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: `Status updated to ${mode}`,
      data: status
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update status'
    });
  }
});


/**
 * PATCH /api/v1/status/settings
 * Update auto-away settings
 */
router.patch('/settings', async (req: Request, res: Response) => {
  try {
    const { userId, autoAwayEnabled, autoAwayMinutes } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const updateData: any = {
      lastActiveAt: new Date()
    };

    if (typeof autoAwayEnabled === 'boolean') {
      updateData.autoAwayEnabled = autoAwayEnabled;
    }

    if (autoAwayMinutes) {
      updateData.autoAwayMinutes = Math.max(5, Math.min(autoAwayMinutes, 120)); // 5-120 min range
    }

    const status = await StudentStatus.findOneAndUpdate(
      { userId },
      updateData,
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: status
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update settings'
    });
  }
});


/**
 * POST /api/v1/status/activity
 * Update last active timestamp (called by frontend periodically)
 */
router.post('/activity', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const status = await StudentStatus.findOneAndUpdate(
      { userId },
      {
        lastActiveAt: new Date(),
        mode: StudentMode.AVAILABLE // Auto-switch to available when active
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      data: status
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update activity'
    });
  }
});


export default router;