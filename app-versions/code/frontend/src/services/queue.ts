import Redis from 'ioredis';
import type {
  TranslationJob,
  TranslationResult,
  TranslationSession,
  JobStatus,
} from '../types.js';

export interface QueueServiceConfig {
  host: string;
  port: number;
}

type RedisClient = Redis;

export class QueueService {
  private client: RedisClient | null = null;
  private subscriber: RedisClient | null = null;
  private config: QueueServiceConfig;
  private readonly queueKey = 'translation:queue';
  private readonly resultChannel = 'translation:results';
  private readonly sessionKeyPrefix = 'translation:session:';

  constructor(config: QueueServiceConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // Client for commands
    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    // Separate client for pub/sub
    this.subscriber = new Redis({
      host: this.config.host,
      port: this.config.port,
      maxRetriesPerRequest: 3,
    });

    // Wait for connections
    await Promise.all([this.client.ping(), this.subscriber.ping()]);

    console.log('QueueService connected to Redis');
  }

  async enqueueJob(job: TranslationJob): Promise<void> {
    if (!this.client) {
      throw new Error('QueueService not connected');
    }
    const jobJson = JSON.stringify(job);
    await this.client.lpush(this.queueKey, jobJson);
    console.log(`Enqueued job ${job.jobId} for language ${job.targetLanguage}`);
  }

  async subscribeToResults(
    callback: (result: TranslationResult) => void,
  ): Promise<void> {
    if (!this.subscriber) {
      throw new Error('QueueService not connected');
    }

    await this.subscriber.subscribe(this.resultChannel);

    this.subscriber.on('message', (channel: string, message: string) => {
      if (channel === this.resultChannel) {
        try {
          const result = JSON.parse(message) as TranslationResult;
          callback(result);
        } catch (error) {
          console.error('Error parsing result message:', error);
        }
      }
    });

    console.log(`Subscribed to ${this.resultChannel}`);
  }

  async saveSession(session: TranslationSession): Promise<void> {
    if (!this.client) {
      throw new Error('QueueService not connected');
    }

    const key = this.sessionKeyPrefix + session.sessionId;
    const sessionData: Record<string, string> = {
      text: session.text,
      sourceLanguage: session.sourceLanguage,
      status: session.status,
      totalJobs: session.jobs.size.toString(),
      completedJobs: '0',
    };

    // Add job information
    for (const [lang, jobStatus] of session.jobs.entries()) {
      sessionData[`job:${lang}:status`] = jobStatus.status;
    }

    await this.client.hset(key, sessionData);
    await this.client.expire(key, 3600); // 1 hour TTL

    console.log(`Saved session ${session.sessionId}`);
  }

  async getSession(sessionId: string): Promise<TranslationSession | null> {
    if (!this.client) {
      throw new Error('QueueService not connected');
    }

    const key = this.sessionKeyPrefix + sessionId;
    const data = await this.client.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    const jobs = new Map<string, JobStatus>();

    // Parse job data from hash
    for (const [field, value] of Object.entries(data)) {
      const jobMatch = field.match(/^job:([^:]+):status$/);
      if (jobMatch) {
        const lang = jobMatch[1];
        jobs.set(lang, {
          status: value as JobStatus['status'],
          translatedText: data[`job:${lang}:translatedText`],
          error: data[`job:${lang}:error`],
        });
      }
    }

    return {
      sessionId,
      text: data.text,
      sourceLanguage: data.sourceLanguage,
      status: data.status as TranslationSession['status'],
      jobs,
    };
  }

  async updateJobStatus(
    sessionId: string,
    language: string,
    status: JobStatus['status'],
    translatedText?: string,
    error?: string,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('QueueService not connected');
    }

    const key = this.sessionKeyPrefix + sessionId;
    const updates: Record<string, string> = {
      [`job:${language}:status`]: status,
    };

    if (translatedText) {
      updates[`job:${language}:translatedText`] = translatedText;
    }

    if (error) {
      updates[`job:${language}:error`] = error;
    }

    await this.client.hset(key, updates);

    // Update completed jobs count
    if (status === 'completed' || status === 'error') {
      await this.client.hincrby(key, 'completedJobs', 1);
    }

    // Check if all jobs are done
    const data = await this.client.hgetall(key);
    const totalJobs = parseInt(data.totalJobs || '0', 10);
    const completedJobs = parseInt(data.completedJobs || '0', 10);

    if (completedJobs >= totalJobs) {
      await this.client.hset(key, 'status', 'completed');
    } else if (status === 'processing' && data.status === 'queued') {
      await this.client.hset(key, 'status', 'in_progress');
    }

    console.log(
      `Updated job status: session=${sessionId}, lang=${language}, status=${status}`,
    );
  }

  async disconnect(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    console.log('QueueService disconnected');
  }
}
