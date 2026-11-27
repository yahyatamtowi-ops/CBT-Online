import type { SpreadsheetSyncConfig } from '../types/cbt';
import { validateAppsScriptUrl } from '../utils/cbtLogic';

export interface AutoSyncEnvInput {
  VITE_APPS_SCRIPT_WEBAPP_URL?: string;
  VITE_SPREADSHEET_URL?: string;
  VITE_SPREADSHEET_ID?: string;
  VITE_APPS_SCRIPT_SYNC_SECRET?: string;
  VITE_AUTO_SYNC_ENABLED?: string;
}

export interface ServerAutoSyncStatus {
  serverConfigured: boolean;
  hasWebAppUrl: boolean;
  hasSecret: boolean;
  spreadsheetUrl: string;
  spreadsheetId: string;
}

export interface ResolvedAutoSyncDefaults {
  hasEnvAppsScript: boolean;
  webAppUrl: string;
  spreadsheetUrl: string;
  spreadsheetId: string;
  syncSecret: string;
  autoEnabled: boolean;
}

export function extractSpreadsheetIdFromUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return '';
}

export function readClientAutoSyncEnv(): AutoSyncEnvInput {
  const metaEnv =
    typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ? (import.meta as unknown as { env: Record<string, string | undefined> }).env
      : {};
  return {
    VITE_APPS_SCRIPT_WEBAPP_URL: metaEnv.VITE_APPS_SCRIPT_WEBAPP_URL,
    VITE_SPREADSHEET_URL: metaEnv.VITE_SPREADSHEET_URL,
    VITE_SPREADSHEET_ID: metaEnv.VITE_SPREADSHEET_ID,
    VITE_APPS_SCRIPT_SYNC_SECRET: metaEnv.VITE_APPS_SCRIPT_SYNC_SECRET,
    VITE_AUTO_SYNC_ENABLED: metaEnv.VITE_AUTO_SYNC_ENABLED,
  };
}

export function resolveAutoSyncDefaults(
  env: AutoSyncEnvInput = readClientAutoSyncEnv()
): ResolvedAutoSyncDefaults {
  const rawUrl = (env.VITE_APPS_SCRIPT_WEBAPP_URL || '').trim();
  const urlCheck = rawUrl ? validateAppsScriptUrl(rawUrl) : { ok: false, normalizedUrl: '' };
  const webAppUrl = urlCheck.ok ? urlCheck.normalizedUrl : '';
  const spreadsheetUrl = (env.VITE_SPREADSHEET_URL || '').trim();
  const spreadsheetId =
    (env.VITE_SPREADSHEET_ID || '').trim() || extractSpreadsheetIdFromUrl(spreadsheetUrl);
  const syncSecret = (env.VITE_APPS_SCRIPT_SYNC_SECRET || '').trim();
  const explicitFlag = (env.VITE_AUTO_SYNC_ENABLED || '').trim().toLowerCase();
  const autoEnabled =
    Boolean(webAppUrl) && explicitFlag !== 'false' && explicitFlag !== '0';

  return {
    hasEnvAppsScript: Boolean(webAppUrl),
    webAppUrl,
    spreadsheetUrl:
      spreadsheetUrl ||
      (spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : ''),
    spreadsheetId,
    syncSecret,
    autoEnabled,
  };
}

export function mergeSpreadsheetSyncWithDefaults(
  local: SpreadsheetSyncConfig,
  envDefaults: ResolvedAutoSyncDefaults,
  serverStatus?: ServerAutoSyncStatus | null
): SpreadsheetSyncConfig {
  const effectiveUrl = local.webAppUrl.trim() || envDefaults.webAppUrl;
  const effectiveSheetUrl =
    local.spreadsheetUrl.trim() ||
    envDefaults.spreadsheetUrl ||
    serverStatus?.spreadsheetUrl ||
    '';
  const effectiveSecret = local.syncSecret.trim() || envDefaults.syncSecret;
  const hasRemoteEndpoint =
    validateAppsScriptUrl(effectiveUrl).ok || Boolean(serverStatus?.serverConfigured);

  // Auto-enable when local config had no URL yet and env/server provides a valid endpoint
  const shouldAutoEnable =
    local.enabled ||
    (!local.webAppUrl.trim() && (envDefaults.autoEnabled || Boolean(serverStatus?.serverConfigured)));

  return {
    ...local,
    enabled: hasRemoteEndpoint ? shouldAutoEnable : local.enabled,
    webAppUrl: effectiveUrl,
    spreadsheetUrl: effectiveSheetUrl,
    syncSecret: effectiveSecret,
    autoPushOnChange: local.autoPushOnChange ?? true,
    autoPullOnLoad: local.autoPullOnLoad ?? true,
    autoPullIntervalSeconds:
      typeof local.autoPullIntervalSeconds === 'number' ? local.autoPullIntervalSeconds : 60,
  };
}

export function buildNetlifyEnvSnippet(config: {
  webAppUrl: string;
  spreadsheetUrl: string;
  syncSecret: string;
  spreadsheetId?: string;
}): string {
  const sheetId =
    (config.spreadsheetId || '').trim() || extractSpreadsheetIdFromUrl(config.spreadsheetUrl);
  const lines = [
    '# Tempel variabel ini di Netlify -> Site configuration -> Environment variables',
    `APPS_SCRIPT_WEBAPP_URL=${config.webAppUrl.trim()}`,
    `APPS_SCRIPT_SYNC_SECRET=${config.syncSecret.trim()}`,
    `VITE_APPS_SCRIPT_WEBAPP_URL=${config.webAppUrl.trim()}`,
    `VITE_SPREADSHEET_URL=${config.spreadsheetUrl.trim()}`,
    `VITE_SPREADSHEET_ID=${sheetId}`,
    'VITE_AUTO_SYNC_ENABLED=true',
  ];
  return lines.join('\n');
}
