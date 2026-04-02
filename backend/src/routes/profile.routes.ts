import { Router, Request, Response } from 'express';
import mongoose from 'mongoose'; // ✅ THIS LINE WAS MISSING
import { User, UserProfile } from '../models';


const router = Router();


/**
 * GET /api/v1/profile?userId=
 * Returns user basic info + profile preferences in one call
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            res.status(400).json({ success: false, message: 'userId is required' });
            return;
        }

        const [user, profile] = await Promise.all([
            User.findById(userId).select('-passwordHash').lean(),
            UserProfile.findOne({ userId }).lean(),
        ]);

        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                user,
                profile: profile || {
                    aboutMe: '',
                    aiLanguage: 'auto',
                    aiTone: 'friendly',
                    aiLength: 'match',
                },
            },
        });

    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || 'Failed to fetch profile' });
    }
});


/**
 * PATCH /api/v1/profile/:userId/basic
 * Update user name, email, phone
 */
router.patch('/:userId/basic', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { name, email, phone } = req.body;

        if (!name || !email || !phone) {
            res.status(400).json({ success: false, message: 'name, email, and phone are required' });
            return;
        }

        // ✅ Cast to ObjectId so TypeScript $ne type matches
        const existing = await User.findOne({
            email,
            _id: { $ne: new mongoose.Types.ObjectId(userId as string) },
        });

        if (existing) {
            res.status(409).json({ success: false, message: 'Email already in use by another account' });
            return;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { name, email, phone },
            { new: true, runValidators: true }
        ).select('-passwordHash');

        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Basic info updated successfully',
            data: user,
        });

    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || 'Failed to update basic info' });
    }
});


/**
 * PATCH /api/v1/profile/:userId
 * Save About Me + AI preferences (upsert)
 */
router.patch('/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { aboutMe, aiLanguage, aiTone, aiLength } = req.body;

        const profile = await UserProfile.findOneAndUpdate(
            { userId },
            { aboutMe, aiLanguage, aiTone, aiLength },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: profile,
        });

    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || 'Failed to update profile' });
    }
});


export default router;