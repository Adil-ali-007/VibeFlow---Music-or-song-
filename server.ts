import http from 'http';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './backend/src/app';
import { db } from './backend/src/config/database';
import { env } from './backend/src/config/env';
import { musicProviderAdapter } from './backend/src/services/musicProviderAdapter';

async function startFullStackServer(): Promise<void> {
  // Kick off Python music service and MongoDB connection without blocking port 3000 binding
  const servicesInitPromise = Promise.allSettled([
    musicProviderAdapter.ensureServiceRunning(),
    db.connect(),
  ]);

  const app = createApiApp();
  const httpServer = http.createServer(app);
  const isProd = env.NODE_ENV === 'production';

  if (!isProd) {
    const disableHmr =
      process.env.DISABLE_HMR === 'true' || Boolean(process.env.GOOGLE_RUNTIME);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? (false as const) : undefined,
        watch: disableHmr ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(
      `[VibeFlow] Full-stack server running at http://localhost:${port} (mode=${env.NODE_ENV}, musicService=${env.MUSIC_SERVICE_URL}, internalTokenAuth=${Boolean(env.INTERNAL_SERVICE_TOKEN)})`
    );
  });

  await servicesInitPromise;
}

process.on('SIGTERM', () => {
  musicProviderAdapter.stopManagedService();
  process.exit(0);
});

startFullStackServer().catch((err) => {
  console.error('[VibeFlow] Server startup error:', err);
  process.exit(1);
});
