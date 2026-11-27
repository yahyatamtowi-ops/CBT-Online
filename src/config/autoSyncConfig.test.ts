import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSeedDatabase } from '../data/seedData.ts';
import {
  buildNetlifyEnvSnippet,
  extractSpreadsheetIdFromUrl,
  mergeSpreadsheetSyncWithDefaults,
  resolveAutoSyncDefaults,
} from './autoSyncConfig.ts';
import autoSyncStatusHandler from '../../netlify/functions/auto-sync-status.ts';

test('extractSpreadsheetIdFromUrl parses standard Google Sheets URLs and raw IDs', () => {
  assert.equal(
    extractSpreadsheetIdFromUrl(
      'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=0'
    ),
    '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
  );
  assert.equal(
    extractSpreadsheetIdFromUrl('1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'),
    '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
  );
  assert.equal(extractSpreadsheetIdFromUrl(''), '');
});

test('resolveAutoSyncDefaults and mergeSpreadsheetSyncWithDefaults auto-enable Apps Script & Spreadsheet from env or server status', () => {
  const seed = createInitialSeedDatabase();
  const envDefaults = resolveAutoSyncDefaults({
    VITE_APPS_SCRIPT_WEBAPP_URL:
      'https://script.google.com/macros/s/AKfycbTestAutoSync12345/exec',
    VITE_SPREADSHEET_URL:
      'https://docs.google.com/spreadsheets/d/1SheetAutoSyncId1234567890/edit',
    VITE_APPS_SCRIPT_SYNC_SECRET: 'SECRET_2026',
  });

  assert.equal(envDefaults.hasEnvAppsScript, true);
  assert.equal(envDefaults.autoEnabled, true);
  assert.equal(envDefaults.spreadsheetId, '1SheetAutoSyncId1234567890');

  const mergedFromEnv = mergeSpreadsheetSyncWithDefaults(
    seed.spreadsheetSync,
    envDefaults
  );
  assert.equal(mergedFromEnv.enabled, true);
  assert.equal(
    mergedFromEnv.webAppUrl,
    'https://script.google.com/macros/s/AKfycbTestAutoSync12345/exec'
  );
  assert.equal(mergedFromEnv.syncSecret, 'SECRET_2026');

  // Server/Netlify env fallback with empty client env
  const emptyEnv = resolveAutoSyncDefaults({});
  const mergedFromServer = mergeSpreadsheetSyncWithDefaults(
    seed.spreadsheetSync,
    emptyEnv,
    {
      serverConfigured: true,
      hasWebAppUrl: true,
      hasSecret: true,
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1ServerSheetId1234567890/edit',
      spreadsheetId: '1ServerSheetId1234567890',
    }
  );
  assert.equal(mergedFromServer.enabled, true);
  assert.equal(
    mergedFromServer.spreadsheetUrl,
    'https://docs.google.com/spreadsheets/d/1ServerSheetId1234567890/edit'
  );
});

test('buildNetlifyEnvSnippet formats ready-to-paste Netlify Environment Variables', () => {
  const snippet = buildNetlifyEnvSnippet({
    webAppUrl: 'https://script.google.com/macros/s/AKfycbDeploy123/exec',
    spreadsheetUrl:
      'https://docs.google.com/spreadsheets/d/1NetlifySheetId1234567890/edit',
    syncSecret: 'SMANSA_KEY',
  });
  assert.match(snippet, /APPS_SCRIPT_WEBAPP_URL=https:\/\/script\.google\.com\/macros\/s\/AKfycbDeploy123\/exec/);
  assert.match(snippet, /APPS_SCRIPT_SYNC_SECRET=SMANSA_KEY/);
  assert.match(snippet, /VITE_SPREADSHEET_ID=1NetlifySheetId1234567890/);
  assert.match(snippet, /VITE_AUTO_SYNC_ENABLED=true/);
});

test('Netlify auto-sync-status function reports serverConfigured without leaking secrets', async () => {
  const prevUrl = process.env.APPS_SCRIPT_WEBAPP_URL;
  const prevSecret = process.env.APPS_SCRIPT_SYNC_SECRET;
  try {
    process.env.APPS_SCRIPT_WEBAPP_URL =
      'https://script.google.com/macros/s/AKfycbNetlifyFuncTest123/exec';
    process.env.APPS_SCRIPT_SYNC_SECRET = 'TOP_SECRET_VALUE';

    const resp = await autoSyncStatusHandler(
      new Request('https://example.netlify.app/api/auto-sync-status', { method: 'GET' })
    );
    assert.equal(resp.status, 200);
    const bodyText = await resp.text();
    assert.equal(bodyText.includes('TOP_SECRET_VALUE'), false);
    const json = JSON.parse(bodyText) as {
      ok: boolean;
      serverConfigured: boolean;
      hasSecret: boolean;
    };
    assert.equal(json.ok, true);
    assert.equal(json.serverConfigured, true);
    assert.equal(json.hasSecret, true);
  } finally {
    if (prevUrl === undefined) delete process.env.APPS_SCRIPT_WEBAPP_URL;
    else process.env.APPS_SCRIPT_WEBAPP_URL = prevUrl;
    if (prevSecret === undefined) delete process.env.APPS_SCRIPT_SYNC_SECRET;
    else process.env.APPS_SCRIPT_SYNC_SECRET = prevSecret;
  }
});
