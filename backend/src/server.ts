import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import whatsappService from './services/whatsapp.service';

// Import Redis and Queue config
import './config/redis';
import './config/queue';

// Import worker
import './workers/reply.worker';

// Import routes
import sessionRoutes from './routes/session.routes';
import personalityRoutes from './routes/personality.routes';
import contactRoutes from './routes/contact.routes';
import statusRoutes from './routes/status.routes';
import conversationRoutes from './routes/conversation.routes';
import dashboardRoutes from './routes/dashboard.routes';


// Load environment variables
dotenv.config();


// Initialize Express app
const app: Application = express();
const PORT = process.env.PORT || 5000;


// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// Health check route
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Presenz Backend is running',
    timestamp: new Date().toISOString()
  });
});


// API Routes
app.use('/api/v1/session', sessionRoutes);
app.use('/api/v1/personality', personalityRoutes);
app.use('/api/v1/contacts', contactRoutes);
app.use('/api/v1/status', statusRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);


// Test route
app.get('/api/v1/test', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API is working!',
    version: '1.0.0'
  });
});


// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});


// Error handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});


// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Restore WhatsApp sessions
    console.log('🔄 Restoring WhatsApp sessions...');
    await whatsappService.restoreAllSessions();

    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📱 WhatsApp ready for connections`);
      console.log(`🧠 AI Personality Engine ready`);
      console.log(`📬 BullMQ Queue System active`);
      console.log(`🛡️ Contact Protection enabled`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};


startServer();