import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { seedIfEmpty } from './seed.js';

async function main() {
  const { uri, inMemory } = await connectDB();

  if (inMemory) {
    console.log('[db] MONGO_URI not set - started an in-memory MongoDB (data resets on restart)');
  }
  console.log(`[db] connected to ${uri.replace(/\/\/[^@]*@/, '//***@')}`);

  if (env.seedOnStart) await seedIfEmpty();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[api] CineBook API listening on http://localhost:${env.port}`);
    console.log(`[api] CORS origin: ${env.clientOrigin}`);
  });
}

main().catch((err) => {
  console.error('[fatal] failed to start server:', err);
  process.exit(1);
});
