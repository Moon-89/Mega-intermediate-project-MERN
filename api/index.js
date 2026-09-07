import { createApp } from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';
import { env } from '../server/src/config/env.js';
import { seedIfEmpty } from '../server/src/seed.js';

const app = createApp({ logging: false });
let databaseReady;

function prepareDatabase() {
  if (!databaseReady) {
    databaseReady = connectDB()
      .then(async () => {
        if (env.seedOnStart) await seedIfEmpty();
      })
      .catch((error) => {
        databaseReady = undefined;
        throw error;
      });
  }
  return databaseReady;
}

export default async function handler(req, res) {
  await prepareDatabase();
  return app(req, res);
}