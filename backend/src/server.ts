import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDatabase } from './config/database';
import whatsappService from './services/whatsapp.service';
import { startCleanupCron, startSubscriptionCron } from './utils/cron';
import { logger } from './config/logger';
import { errorHandler } from './middleware/error.middleware';
import { apiLimiter, authLimiter } from './middleware/rateLimit.middleware';

// Import configurations
import './config/redis';
import './config/queue';
import './config/cloudinary';
import './config/razorpay';

// Import workers
import './workers/reply.worker';
import './workers/voice.worker';

// Import routes
import authRoutes from './routes/auth.routes';
import sessionRoutes from './routes/session.routes';
import personalityRoutes from './routes/personality.routes';
import contactRoutes from './routes/contact.routes';
import statusRoutes from './routes/status.routes';
import conversationRoutes from './routes/conversation.routes';
import dashboardRoutes from './routes/dashboard.routes';
import subscriptionRoutes from './routes/subscription.routes';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
}

// Special handling for webhook (raw body needed for signature verification)
app.use('/api/v1/subscription/webhook', express.raw({ type: 'application/json' }));

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use('/api/', apiLimiter);

// Health check route (no rate limit)
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Presenz Backend is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/session', sessionRoutes);
app.use('/api/v1/personality', personalityRoutes);
app.use('/api/v1/contacts', contactRoutes);
app.use('/api/v1/status', statusRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);

// Test route
app.get('/api/v1/test', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API is working!',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Restore WhatsApp sessions
    logger.info('Restoring WhatsApp sessions...');
    await whatsappService.restoreAllSessions();

    // Start cron jobs
    startCleanupCron();
    startSubscriptionCron();

    // Start listening
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info(`📱 WhatsApp ready for connections`);
      logger.info(`🧠 AI Personality Engine ready`);
      logger.info(`📬 BullMQ Queue System active`);
      logger.info(`🛡️ Contact Protection enabled`);
      logger.info(`🎙️ Voice Note Support enabled`);
      logger.info(`💳 Razorpay Payments ready`);
      logger.info(`🔐 Authentication enabled`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();