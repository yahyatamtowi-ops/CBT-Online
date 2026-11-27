import { validateStrictAppsScriptUrl } from '../../src/utils/appsScriptProxy.ts';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method tidak didukung.' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }

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

  return new Response(
    JSON.stringify({
      ok: true,
      serverConfigured: validUrl,
      hasWebAppUrl: validUrl,
      hasSecret,
      spreadsheetUrl: rawSpreadsheetUrl,
      spreadsheetId: rawSpreadsheetId,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}
