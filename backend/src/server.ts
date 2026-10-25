import { createApiApp } from './app';
import { db } from './config/database';
import { env } from './config/env';
import { musicProviderAdapter } from './services/musicProviderAdapter';

async function startStandaloneBackend() {
  await db.connect();
  await musicProviderAdapter.ensureServiceRunning();

  const app = createApiApp();
  const port = Number(process.env.BACKEND_PORT || env.PORT || 8000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`[vibeflow-backend] API server listening on http://localhost:${port}`);
  });
}

process.on('SIGTERM', () => {
  musicProviderAdapter.stopManagedService();
  process.exit(0);
});

startStandaloneBackend().catch((err) => {
  console.error('[vibeflow-backend] Failed to start server:', err);
  process.exit(1);
});
