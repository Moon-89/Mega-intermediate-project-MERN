import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';
import { env } from './config/env.js';

export function createApp({ logging = true } = {}) {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: env.clientOrigin === '*' ? true : env.clientOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '200kb' }));
  if (logging && env.nodeEnv !== 'test') app.use(morgan('dev'));

  app.get('/', (_req, res) => {
    res.status(200).json({
      data: {
        name: 'CineBook API',
        version: '1.0.0',
        docs: '/api/health lists service status; see README.md for the full API contract',
      },
    });
  });

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
