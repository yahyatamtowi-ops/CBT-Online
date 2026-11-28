import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  forwardToAppsScript,
  validateStrictAppsScriptUrl,
  type AppsScriptAction,
} from './src/utils/appsScriptProxy.ts';
import {
  gradeEssaysWithGemini,
  type EssayGradeRequestItem,
} from './src/utils/essayGradingServer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '15mb' }));

  // Reports whether server/Netlify environment variables are pre-configured for zero-touch sync.
  // Never exposes secret values.
  app.get('/api/auto-sync-status', (_req, res) => {
    const rawWebAppUrl = (
      process.env.APPS_SCRIPT_WEBAPP_URL ||
      process.env.VITE_APPS_SCRIPT_WEBAPP_URL ||
      ''
    ).trim();
    const rawSpreadsheetUrl = (
      process.env.SPREADSHEET_URL ||
      process.env.VITE_SPREADSHEET_URL ||
      ''
    ).trim();
    const rawSpreadsheetId = (
      process.env.SPREADSHEET_ID ||
      process.env.VITE_SPREADSHEET_ID ||
      ''
    ).trim();
    const hasSecret = Boolean(
      (process.env.APPS_SCRIPT_SYNC_SECRET || process.env.VITE_APPS_SCRIPT_SYNC_SECRET || '').trim()
    );
    const validUrl = rawWebAppUrl ? validateStrictAppsScriptUrl(rawWebAppUrl).ok : false;

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      serverConfigured: validUrl,
      hasWebAppUrl: validUrl,
      hasSecret,
      spreadsheetUrl: rawSpreadsheetUrl,
      spreadsheetId: rawSpreadsheetId,
    });
  });

  // Server-side semantic essay grading using Gemini (never exposes API key to client)
  app.post('/api/grade-essay', async (req, res) => {
    const body = req.body as { items?: EssayGradeRequestItem[] } | null;
    if (!body || !Array.isArray(body.items)) {
      res.status(400).json({ ok: false, error: 'Daftar soal esai tidak ditemukan.' });
      return;
    }

    const result = await gradeEssaysWithGemini(body.items);
    res.status(result.httpStatus).json({
      ok: result.ok,
      grades: result.grades,
      error: result.error,
    });
  });

  // Server-side proxy for Google Apps Script Web App sync.
  // Eliminates browser/iframe CORS & 302 redirect "Failed to fetch" issues
  // while strictly allowlisting Google Apps Script hosts and diagnosing HTML errors.
  app.post('/api/spreadsheet-sync', async (req, res) => {
    const body = req.body as {
      webAppUrl?: unknown;
      action?: unknown;
      secret?: unknown;
      database?: unknown;
    } | null;

    if (!body || typeof body !== 'object') {
      res.status(400).json({ ok: false, error: 'Permintaan tidak valid.' });
      return;
    }

    const envWebAppUrl = (
      process.env.APPS_SCRIPT_WEBAPP_URL ||
      process.env.VITE_APPS_SCRIPT_WEBAPP_URL ||
      ''
    ).trim();
    const envSecret = (
      process.env.APPS_SCRIPT_SYNC_SECRET ||
      process.env.VITE_APPS_SCRIPT_SYNC_SECRET ||
      ''
    ).trim();

    const webAppUrl =
      (typeof body.webAppUrl === 'string' ? body.webAppUrl.trim() : '') || envWebAppUrl;
    const action = body.action as AppsScriptAction;
    const secret =
      (typeof body.secret === 'string' ? body.secret.trim() : '') || envSecret;

    const result = await forwardToAppsScript({
      webAppUrl,
      action,
      secret,
      database: body.database,
    });

    res.status(result.httpStatus).json(result.body);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
        watch: hmrDisabled ? null : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CerdasExam CBT server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
