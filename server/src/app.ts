import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFound';
import { apiRouter } from './routes';

export const API_BASE_PATH = '/api/v1';

/**
 * Builds the Express app without starting a listener, so tests can drive it
 * with supertest and index.ts can own the port.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isTest) {
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  app.use(API_BASE_PATH, apiRouter);

  // Order matters: 404 first, then the error handler, and nothing after it.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
