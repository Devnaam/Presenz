import { Router, Request, Response } from 'express';
import { User, StudentStatus } from '../models';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { authenticate } from '../middleware/auth.middleware';
import { registerValidation, loginValidation } from '../middleware/validation.middleware';
import { StudentMode, SubscriptionStatus } from '../types';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
router.post('/register', registerValidation, async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await User.create({
      name,
      email,
      passwordHash,
      phone,
      subscriptionStatus: SubscriptionStatus.TRIAL,
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Create default student status
    await StudentStatus.create({
      userId: user._id,
      mode: StudentMode.AVAILABLE,
      autoAwayEnabled: true,
      autoAwayMinutes: 30,
      lastActiveAt: new Date(),
    });

    // Generate token
    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          subscriptionStatus: user.subscriptionStatus,
          trialEndsAt: user.trialEndsAt,
        },
        token,
      },
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
});

/**
 * POST /api/v1/auth/login
 * User login
 */
router.post('/login', loginValidation, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Generate token
    const token = generateToken(user._id.toString());

    // Update last active
    await StudentStatus.findOneAndUpdate(
      { userId: user._id },
      { lastActiveAt: new Date() },
      { upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          subscriptionStatus: user.subscriptionStatus,
          trialEndsAt: user.trialEndsAt,
        },
        token,
      },
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Login failed'
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user info'
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout (client-side token removal)
 */
router.post('/logout', authenticate, async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;