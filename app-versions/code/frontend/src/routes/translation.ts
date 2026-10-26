import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import type { QueueService } from '../services/queue.js';
import type { SSEManager } from '../services/sse.js';
import type {
  TranslateRequest,
  TranslateResponse,
  SessionResponse,
  TranslationJob,
  JobStatus,
  TranslationSession,
} from '../types.js';
import { SUPPORTED_LANGUAGES } from '../types.js';
import {
  translationRequestsCounter,
  jobsEnqueuedCounter,
  requestDuration,
  validationErrorsCounter,
} from '../metrics.js';
import { logger } from '../logger.js';

export interface TranslationRouterDeps {
  queueService: QueueService;
  sseManager: SSEManager;
}

export function createTranslationRouter(deps: TranslationRouterDeps): Router {
  const router = Router();
  const { queueService, sseManager } = deps;

  // POST /api/translate - Submit translation request
  router.post('/', async (req: Request, res: Response) => {
    const start = Date.now();

    try {
      const body = req.body as TranslateRequest;

      // Validate text
      if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
        validationErrorsCounter.add(1, { error_type: 'empty_text' });
        logger.warn('Validation failed: empty text', {
          reason: 'empty_text',
          ip: req.ip,
          targetLanguages: body.targetLanguages,
        });
        res.status(400).json({
          error: 'Text is required',
          details: 'Text must be a non-empty string',
        });
        return;
      }

      // Validate targetLanguages
      if (
        !Array.isArray(body.targetLanguages) ||
        body.targetLanguages.length === 0
      ) {
        validationErrorsCounter.add(1, { error_type: 'invalid_languages' });
        logger.warn('Validation failed: invalid languages', {
          reason: 'invalid_languages',
          providedValue: body.targetLanguages,
          ip: req.ip,
        });
        res.status(400).json({
          error: 'At least one target language is required',
          details: 'targetLanguages must be a non-empty array',
        });
        return;
      }

      // Check max languages
      if (body.targetLanguages.length > 3) {
        validationErrorsCounter.add(1, { error_type: 'too_many_languages' });
        logger.warn('Validation failed: too many languages', {
          reason: 'too_many_languages',
          requestedCount: body.targetLanguages.length,
          maxAllowed: 3,
          ip: req.ip,
        });
        res.status(400).json({
          error: 'Maximum 3 target languages allowed',
          details: `You requested ${body.targetLanguages.length} languages`,
        });
        return;
      }

      // Validate each language
      const unsupportedLanguages = body.targetLanguages.filter(
        (lang) => !SUPPORTED_LANGUAGES.includes(lang as any),
      );

      if (unsupportedLanguages.length > 0) {
        validationErrorsCounter.add(1, { error_type: 'unsupported_language' });
        logger.warn('Validation failed: unsupported language', {
          reason: 'unsupported_language',
          unsupportedLanguages: unsupportedLanguages,
          supportedLanguages: SUPPORTED_LANGUAGES,
          ip: req.ip,
        });
        res.status(400).json({
          error: `Unsupported language: ${unsupportedLanguages.join(', ')}`,
          supportedLanguages: [...SUPPORTED_LANGUAGES],
        });
        return;
      }

      // Create session
      const sessionId = uuidv4();
      const jobs = new Map<string, JobStatus>();

      logger.info('Translation session created', {
        session_id: sessionId,
        text_length: body.text.length,
        target_languages: body.targetLanguages,
        language_count: body.targetLanguages.length,
      });

      // Create and enqueue jobs
      const jobsList: TranslationJob[] = [];

      for (const targetLanguage of body.targetLanguages) {
        const jobId = uuidv4();
        const job: TranslationJob = {
          jobId,
          sessionId,
          text: body.text,
          sourceLanguage: 'en',
          targetLanguage,
          createdAt: new Date().toISOString(),
        };

        jobsList.push(job);
        jobs.set(targetLanguage, { status: 'queued' });

        // Enqueue job
        await queueService.enqueueJob(job);
        jobsEnqueuedCounter.add(1, { target_language: targetLanguage });

        logger.info('Translation job enqueued', {
          job_id: jobId,
          session_id: sessionId,
          target_language: targetLanguage,
          queue: 'translation_queue',
        });
      }

      // Save session
      const session: TranslationSession = {
        sessionId,
        text: body.text,
        sourceLanguage: 'en',
        status: 'queued',
        jobs,
      };

      await queueService.saveSession(session);

      // Track successful request
      translationRequestsCounter.add(1, {
        status: 'success',
        language_count: body.targetLanguages.length.toString(),
      });

      // Track request duration
      requestDuration.record(Date.now() - start, {
        target_language_count: body.targetLanguages.length.toString(),
      });

      logger.info('Translation session ready', {
        session_id: sessionId,
        jobs_count: jobsList.length,
        status: 'queued',
      });

      // Return response
      const response: TranslateResponse = {
        sessionId,
        status: 'queued',
        jobs: jobsList.map((job) => ({
          jobId: job.jobId,
          targetLanguage: job.targetLanguage,
          status: 'queued',
        })),
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error creating translation session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /api/translate/:sessionId - Get session status
  router.get('/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params as unknown & { sessionId: string };

      const session = await queueService.getSession(sessionId);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Convert Map to object for JSON response
      const translations: Record<string, JobStatus> = {};
      for (const [lang, jobStatus] of session.jobs.entries()) {
        translations[lang] = jobStatus;
      }

      const response: SessionResponse = {
        sessionId: session.sessionId,
        text: session.text,
        status: session.status,
        translations,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /api/translate/:sessionId/events - SSE endpoint
  router.get('/:sessionId/events', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params as unknown & { sessionId: string };

      // Verify session exists
      const session = await queueService.getSession(sessionId);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Add SSE connection
      sseManager.addConnection(sessionId, res);

      logger.info('SSE connection established', {
        session_id: sessionId,
        ip: req.ip,
      });
    } catch (error) {
      logger.error('Error establishing SSE connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
