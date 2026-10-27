import './instrumentation';
import express from 'express';
import cors from 'cors';
import { join } from 'path';
import type { Server } from 'http';
import { QueueService } from './services/queue.js';
import { SSEManager } from './services/sse.js';
import { createTranslationRouter } from './routes/translation.js';
import type { TranslationResult } from './types.js';

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

// Global state for graceful shutdown
let server: Server | null = null;
let queueService: QueueService | null = null;
let sseManager: SSEManager | null = null;

async function startServer(): Promise<void> {
  try {
    // Create Express app
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.static(join(__dirname, 'public')));

    // Initialize services
    console.log('Initializing services...');

    queueService = new QueueService({
      host: REDIS_HOST,
      port: REDIS_PORT,
    });

    await queueService.connect();

    sseManager = new SSEManager();

    // Subscribe to translation results
    await queueService.subscribeToResults(async (result: TranslationResult) => {
      console.log(`Received result for job ${result.jobId}: ${result.status}`);

      try {
        // Update session in Redis
        await queueService!.updateJobStatus(
          result.sessionId,
          result.targetLanguage,
          result.status === 'completed' ? 'completed' : 'error',
          result.translatedText,
          result.error,
        );

        // Send SSE event
        const eventType =
          result.status === 'completed'
            ? 'translation_complete'
            : 'translation_error';

        sseManager!.sendEvent(result.sessionId, eventType, result);

        // Check if session is complete
        const session = await queueService!.getSession(result.sessionId);
        if (session && session.status === 'completed') {
          sseManager!.sendEvent(result.sessionId, 'session_complete', {
            sessionId: result.sessionId,
            status: 'completed',
          });
        }
      } catch (error) {
        console.error('Error processing translation result:', error);
      }
    });

    // Mount routes
    const translationRouter = createTranslationRouter({
      queueService,
      sseManager,
    });
    app.use('/api/translate', translationRouter);

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Start server
    server = app.listen(PORT, () => {
      console.log(`Frontend server listening on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  try {
    // Close SSE connections
    if (sseManager) {
      sseManager.closeAll();
    }

    // Close HTTP server
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('HTTP server closed');
    }

    // Disconnect from Redis
    if (queueService) {
      await queueService.disconnect();
    }

    console.log('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
startServer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
