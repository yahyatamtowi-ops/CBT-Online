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

  // ---------------------------------------------------------------------------
  // Real-Time Live Proctoring Event Hub (SSE + Buffered Snapshot)
  // Propagates student violations, toilet permission requests, exam locks, and
  // teacher/proctor unlocks & confirmations across devices/browsers in <200ms
  // without requiring a page refresh.
  // ---------------------------------------------------------------------------
  interface LiveHubEvent {
    eventId: string;
    senderId: string;
    sentAt: string;
    kind: string;
    violation?: Record<string, unknown> & { id?: string };
    toiletRequest?: Record<string, unknown> & { id?: string };
    attempt?: Record<string, unknown> & { id?: string };
    deletedAttemptId?: string;
  }

  const sseClients = new Set<express.Response>();
  const liveViolations = new Map<string, Record<string, unknown>>();
  const liveToiletRequests = new Map<string, Record<string, unknown>>();
  const liveAttempts = new Map<string, Record<string, unknown>>();
  const liveDeletedAttemptIds = new Set<string>();

  const trimMap = (map: Map<string, Record<string, unknown>>, maxSize: number) => {
    while (map.size > maxSize) {
      const oldestKey = map.keys().next().value;
      if (!oldestKey) break;
      map.delete(oldestKey);
    }
  };

  app.get('/api/live-events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);

    sseClients.add(res);

    const keepalive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepalive);
        sseClients.delete(res);
      }
    }, 20_000);

    req.on('close', () => {
      clearInterval(keepalive);
      sseClients.delete(res);
    });
  });

  app.get('/api/live-events/snapshot', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      snapshot: {
        violations: Array.from(liveViolations.values()),
        toiletRequests: Array.from(liveToiletRequests.values()),
        attempts: Array.from(liveAttempts.values()),
        deletedAttemptIds: Array.from(liveDeletedAttemptIds),
      },
    });
  });

  app.post('/api/live-events', (req, res) => {
    const event = req.body as LiveHubEvent | null;
    if (!event || typeof event !== 'object' || !event.eventId || !event.kind) {
      res.status(400).json({ ok: false, error: 'Payload live event tidak valid.' });
      return;
    }

    if (event.violation && typeof event.violation.id === 'string') {
      liveViolations.set(event.violation.id, event.violation);
      trimMap(liveViolations, 150);
    }
    if (event.toiletRequest && typeof event.toiletRequest.id === 'string') {
      liveToiletRequests.set(event.toiletRequest.id, event.toiletRequest);
      trimMap(liveToiletRequests, 100);
    }
    if (event.attempt && typeof event.attempt.id === 'string') {
      liveDeletedAttemptIds.delete(event.attempt.id);
      liveAttempts.set(event.attempt.id, event.attempt);
      trimMap(liveAttempts, 200);
    }
    if (typeof event.deletedAttemptId === 'string' && event.deletedAttemptId) {
      liveAttempts.delete(event.deletedAttemptId);
      liveDeletedAttemptIds.add(event.deletedAttemptId);
    }

    const frame = `data: ${JSON.stringify({ type: 'live_event', event })}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(frame);
      } catch {
        sseClients.delete(client);
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, delivered: sseClients.size });
  });

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
