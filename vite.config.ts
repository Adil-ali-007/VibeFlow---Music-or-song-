import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

export default defineConfig(() => {
  const disableHmr =
    process.env.DISABLE_HMR === 'true' || Boolean(process.env.GOOGLE_RUNTIME);
  const backendProxyTarget = process.env.BACKEND_URL || 'http://127.0.0.1:3000';

  const disableHmrClientWebSocketPlugin: Plugin = {
    name: 'vibeflow:disable-hmr-ws-client',
    enforce: 'post',
    transform(code, id) {
      if (disableHmr && id.includes('client/client.mjs')) {
        return {
          code: code.replace(
            /transport\.connect\(createHMRHandler\(handleMessage\)\);?/g,
            '/* HMR WebSocket disabled in container environment */'
          ),
          map: null,
        };
      }
      return null;
    },
  };

  return {
    plugins: [react(), tailwindcss(), disableHmrClientWebSocketPlugin],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR & WebSocket server disabled in AI Studio via DISABLE_HMR / GOOGLE_RUNTIME env vars.
      hmr: !disableHmr,
      ws: disableHmr ? (false as const) : undefined,
      watch: disableHmr ? null : {},
      proxy: {
        '/api': {
          target: backendProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
