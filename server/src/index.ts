import type { Server } from 'node:http';
import { API_BASE_PATH, createApp } from './app';
import { env } from './config/env';
import { disconnectPrisma } from './lib/prisma';
import { logger } from './lib/logger';

const app = createApp();

const server: Server = app.listen(env.PORT, () => {
  logger.info(`PeoplePay360 API listening on http://localhost:${env.PORT}${API_BASE_PATH}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`Health check: http://localhost:${env.PORT}${API_BASE_PATH}/health`);
});

/**
 * Close the listener before dropping the database connection, so in-flight
 * requests are not cut off mid-query.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down`);

  server.close(async (error) => {
    if (error) {
      logger.error('Error while closing HTTP server', error);
    }
    await disconnectPrisma().catch((disconnectError) => {
      logger.error('Error while disconnecting Prisma', disconnectError);
    });
    process.exit(error ? 1 : 0);
  });

  // Do not hang forever on a stuck connection.
  setTimeout(() => {
    logger.error('Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});
