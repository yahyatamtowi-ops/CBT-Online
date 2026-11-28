import {
  forwardToAppsScript,
  type AppsScriptAction,
} from '../../src/utils/appsScriptProxy.ts';

interface SyncRequestBody {
  webAppUrl?: unknown;
  action?: unknown;
  secret?: unknown;
  database?: unknown;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method tidak didukung. Gunakan POST.' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }

  let raw: unknown;

  try {
    raw = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Body JSON permintaan tidak valid.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }

  if (!raw || typeof raw !== 'object') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Permintaan tidak valid.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }

  const body = raw as SyncRequestBody;

  // Prefer explicit URL from request; fall back automatically to Netlify environment variables
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

  const reqUrl = typeof body.webAppUrl === 'string' ? body.webAppUrl.trim() : '';
  const reqSecret = typeof body.secret === 'string' ? body.secret.trim() : '';

  const webAppUrl = reqUrl || envWebAppUrl;
  const secret = reqSecret || envSecret;
  const action = body.action as AppsScriptAction;

  const result = await forwardToAppsScript({
    webAppUrl,
    action,
    secret,
    database: body.database,
    timeoutMs: 8500,
  });

  return new Response(JSON.stringify(result.body), {
    status: result.httpStatus,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
