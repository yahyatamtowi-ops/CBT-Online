export type AppsScriptAction = 'ping' | 'pull' | 'push';

export interface AppsScriptUrlCheck {
  ok: boolean;
  normalizedUrl: string;
  error?: string;
}

export interface AppsScriptRedirectCheck {
  ok: boolean;
  isAuthRedirect?: boolean;
  error?: string;
}

export interface AppsScriptForwardRequest {
  webAppUrl: string;
  action: AppsScriptAction;
  secret?: string;
  database?: unknown;
}

export interface AppsScriptForwardResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const ALLOWED_APPS_SCRIPT_HOSTS = new Set([
  'script.google.com',
  'script.googleusercontent.com',
]);

/**
 * Strictly validates a Google Apps Script Web App URL to prevent SSRF
 * and catch common Google deployment mistakes (/dev URLs, multi-account /u/1/ URLs).
 */
export function validateStrictAppsScriptUrl(rawUrl: string): AppsScriptUrlCheck {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      normalizedUrl: '',
      error: 'URL Web App Google Apps Script wajib diisi.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      normalizedUrl: trimmed,
      error: 'Format URL Web App Google Apps Script tidak valid.',
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      ok: false,
      normalizedUrl: trimmed,
      error: 'URL Google Apps Script harus menggunakan protokol HTTPS.',
    };
  }

  if (parsed.username || parsed.password || parsed.port) {
    return {
      ok: false,
      normalizedUrl: trimmed,
      error: 'URL Google Apps Script tidak boleh mengandung kredensial atau port khusus.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_APPS_SCRIPT_HOSTS.has(host)) {
    return {
      ok: false,
      normalizedUrl: trimmed,
      error:
        'Domain harus berasal dari Google Apps Script (https://script.google.com/macros/s/.../exec).',
    };
  }

  if (host === 'script.google.com') {
    // Strip multi-account segment (/macros/u/1/s/ -> /macros/s/) which frequently breaks anonymous fetch
    if (/\/macros\/u\/\d+\/s\//.test(parsed.pathname)) {
      parsed.pathname = parsed.pathname.replace(/\/macros\/u\/\d+\/s\//, '/macros/s/');
    }

    const isMacrosPath =
      parsed.pathname.startsWith('/macros/s/') ||
      parsed.pathname.startsWith('/a/macros/');
    if (!isMacrosPath) {
      return {
        ok: false,
        normalizedUrl: trimmed,
        error:
          'Gunakan URL Deployment Web App yang berakhiran /exec dari menu Terapkan > Deployment baru > Aplikasi Web.',
      };
    }

    if (parsed.pathname.endsWith('/dev')) {
      return {
        ok: false,
        normalizedUrl: trimmed,
        error:
          'URL berakhiran /dev adalah tautan uji internal (membutuhkan login Google). Gunakan URL Deployment produksi yang berakhiran /exec.',
      };
    }

    if (!parsed.pathname.endsWith('/exec')) {
      return {
        ok: false,
        normalizedUrl: trimmed,
        error:
          'URL Web App Google Apps Script harus berakhiran /exec. Salin ulang dari menu Terapkan > Kelola Deployment.',
      };
    }
  }

  return { ok: true, normalizedUrl: parsed.toString() };
}

/**
 * Validates every redirect Location hop so outbound requests never leave Google's Apps Script hosts.
 */
export function validateAppsScriptRedirectUrl(
  locationUrl: string,
  baseUrl: string
): AppsScriptRedirectCheck {
  let target: URL;
  try {
    target = new URL(locationUrl, baseUrl);
  } catch {
    return {
      ok: false,
      error: 'URL pengalihan dari Google Apps Script tidak valid.',
    };
  }

  if (target.protocol !== 'https:' || target.username || target.password || target.port) {
    return {
      ok: false,
      error: 'Pengalihan menuju protokol atau tujuan yang tidak diizinkan.',
    };
  }

  const host = target.hostname.toLowerCase();
  if (host === 'accounts.google.com') {
    return {
      ok: false,
      isAuthRedirect: true,
      error:
        'Google mengalihkan koneksi ke halaman login. Pastikan pada Apps Script menu Terapkan > Kelola Deployment: "Jalankan sebagai: Saya" dan "Yang memiliki akses: Siapa saja". Jika menggunakan akun sekolah/belajar.id yang dibatasi admin domain, coba gunakan akun Gmail pribadi (@gmail.com).',
    };
  }

  if (!ALLOWED_APPS_SCRIPT_HOSTS.has(host)) {
    return {
      ok: false,
      error: `Pengalihan ke host luar (${host}) ditolak demi keamanan.`,
    };
  }

  return { ok: true };
}

/**
 * Translates non-JSON HTML responses from Google Apps Script into clear, actionable guidance.
 */
export function diagnoseAppsScriptHtmlResponse(
  rawBody: string,
  httpStatus: number
): string {
  const sample = rawBody.slice(0, 4000).toLowerCase();

  if (
    sample.includes('accounts.google.com') ||
    sample.includes('servicelogin') ||
    sample.includes('sign in - google accounts') ||
    sample.includes('masuk - akun google')
  ) {
    return 'Google meminta login saat mengakses Web App. Pastikan "Yang memiliki akses" disetel ke "Siapa saja" (Anyone), lalu klik Terapkan versi baru. Jika memakai akun belajar.id / Workspace sekolah, kebijakan admin mungkin membatasi akses publik—coba gunakan akun Gmail biasa.';
  }

  if (
    sample.includes('script function not found') ||
    sample.includes('fungsi skrip tidak ditemukan')
  ) {
    return 'Fungsi doGet/doPost tidak ditemukan di Google Apps Script. Tempel seluruh kode Code.gs, simpan, lalu buat Deployment Baru (atau perbarui ke Versi Baru).';
  }

  if (
    sample.includes('you do not have permission') ||
    sample.includes('tidak memiliki izin') ||
    sample.includes('authorization is required') ||
    sample.includes('otorisasi')
  ) {
    return 'Apps Script belum diotorisasi atau tidak memiliki izin akses Spreadsheet. Jalankan otorisasi di editor Apps Script, pastikan "Jalankan sebagai: Saya", lalu terapkan Versi Baru.';
  }

  if (
    httpStatus === 404 ||
    sample.includes('sorry, unable to open the file') ||
    sample.includes('page not found') ||
    sample.includes('maaf, file tidak dapat dibuka')
  ) {
    return 'URL Web App Apps Script tidak ditemukan (404) atau sudah diarsipkan. Salin ulang URL aktif (/exec) dari menu Terapkan > Kelola Deployment.';
  }

  if (
    sample.includes('typeerror') ||
    sample.includes('referenceerror') ||
    sample.includes('syntaxerror') ||
    sample.includes('exception:')
  ) {
    return 'Terjadi error di dalam kode Google Apps Script. Pastikan kode Code.gs disalin lengkap tanpa terpotong dan sudah diterapkan sebagai Versi Baru.';
  }

  return `Google Apps Script mengembalikan halaman HTML (HTTP ${httpStatus}), bukan JSON. Pastikan kode Code.gs sudah disimpan dan diterapkan ulang sebagai Aplikasi Web (Versi Baru) dengan akses "Siapa saja".`;
}

/**
 * Proxies ping/pull/push requests server-side to Google Apps Script,
 * following validated Google 302 redirects (including POST -> 302 -> GET) without browser CORS failures.
 */
export async function forwardToAppsScript(
  req: AppsScriptForwardRequest,
  fetchImpl: typeof fetch = fetch
): Promise<AppsScriptForwardResult> {
  const urlCheck = validateStrictAppsScriptUrl(req.webAppUrl);
  if (!urlCheck.ok) {
    return {
      httpStatus: 400,
      body: { ok: false, error: urlCheck.error },
    };
  }

  if (req.action !== 'ping' && req.action !== 'pull' && req.action !== 'push') {
    return {
      httpStatus: 400,
      body: { ok: false, error: 'Aksi sinkronisasi tidak valid.' },
    };
  }

  const secret = typeof req.secret === 'string' ? req.secret.trim().slice(0, 256) : '';
  let currentUrl = urlCheck.normalizedUrl;
  let currentMethod: 'GET' | 'POST' = req.action === 'push' ? 'POST' : 'GET';
  let currentBody: string | undefined;

  if (req.action === 'push') {
    if (!req.database || typeof req.database !== 'object') {
      return {
        httpStatus: 400,
        body: { ok: false, error: 'Payload database tidak ditemukan untuk aksi push.' },
      };
    }
    currentBody = JSON.stringify({
      action: 'push',
      secret,
      database: req.database,
    });
  } else {
    const target = new URL(currentUrl);
    target.searchParams.set('action', req.action);
    if (secret) {
      target.searchParams.set('secret', secret);
    }
    currentUrl = target.toString();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    let response: Response | null = null;
    const maxRedirects = 5;

    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      const headers: Record<string, string> = {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
      };
      if (currentMethod === 'POST') {
        headers['Content-Type'] = 'text/plain;charset=utf-8';
      }

      response = await fetchImpl(currentUrl, {
        method: currentMethod,
        headers,
        body: currentMethod === 'POST' ? currentBody : undefined,
        redirect: 'manual',
        signal: controller.signal,
      });

      const isRedirect =
        response.status === 301 ||
        response.status === 302 ||
        response.status === 303 ||
        response.status === 307 ||
        response.status === 308;

      if (!isRedirect) {
        break;
      }

      if (hop === maxRedirects) {
        return {
          httpStatus: 502,
          body: {
            ok: false,
            error: 'Terlalu banyak pengalihan (redirect) dari Google Apps Script.',
          },
        };
      }

      const location = response.headers.get('location');
      if (!location) {
        return {
          httpStatus: 502,
          body: {
            ok: false,
            error: 'Respons pengalihan Google Apps Script tidak memiliki alamat tujuan.',
          },
        };
      }

      const redirectCheck = validateAppsScriptRedirectUrl(location, currentUrl);
      if (!redirectCheck.ok) {
        return {
          httpStatus: redirectCheck.isAuthRedirect ? 403 : 502,
          body: { ok: false, error: redirectCheck.error },
        };
      }

      currentUrl = new URL(location, currentUrl).toString();
      // Google Apps Script responds to POST with 302 pointing to script.googleusercontent.com/macros/echo
      // which MUST be fetched via GET without resending the POST body.
      if (
        currentMethod === 'POST' &&
        (response.status === 301 || response.status === 302 || response.status === 303)
      ) {
        currentMethod = 'GET';
        currentBody = undefined;
      }
    }

    if (!response) {
      return {
        httpStatus: 502,
        body: { ok: false, error: 'Tidak ada respons dari Google Apps Script.' },
      };
    }

    const rawText = await response.text();
    try {
      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {
          httpStatus: 502,
          body: {
            ok: false,
            error: 'Format JSON dari Google Apps Script tidak sesuai.',
          },
        };
      }
      return {
        httpStatus: response.ok ? 200 : response.status,
        body: parsed,
      };
    } catch {
      return {
        httpStatus: 502,
        body: {
          ok: false,
          error: diagnoseAppsScriptHtmlResponse(rawText, response.status),
        },
      };
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      httpStatus: isTimeout ? 504 : 502,
      body: {
        ok: false,
        error: isTimeout
          ? 'Koneksi ke Google Apps Script melebihi batas waktu (25 detik). Periksa ukuran data atau coba ulangi.'
          : 'Server gagal menjangkau Google Apps Script. Periksa URL Web App (/exec) dan pastikan koneksi internet aktif.',
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
