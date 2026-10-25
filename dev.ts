import 'dotenv/config';
import app from './server.js';

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function start(): Promise<void> {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HCM Lite] Server listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[HCM Lite] Fatal startup error:', err);
  process.exit(1);
});
