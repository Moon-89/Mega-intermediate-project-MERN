import 'dotenv/config';

const bool = (v, fallback = false) =>
  v === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: (process.env.MONGO_URI || '').trim(),
  jwtSecret: process.env.JWT_SECRET || 'cinebook-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  seedOnStart: bool(process.env.SEED_ON_START, true),
  demo: {
    adminEmail: process.env.ADMIN_EMAIL || 'admin@cinebook.dev',
    adminPassword: process.env.ADMIN_PASSWORD || 'Admin@123',
    userEmail: process.env.USER_EMAIL || 'user@cinebook.dev',
    userPassword: process.env.USER_PASSWORD || 'User@123',
  },
};

export const isProd = env.nodeEnv === 'production';
