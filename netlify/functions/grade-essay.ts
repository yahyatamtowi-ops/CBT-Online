import {
  gradeEssaysWithGemini,
  type EssayGradeRequestItem,
} from '../../src/utils/essayGradingServer.ts';

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

  const body = raw as { items?: EssayGradeRequestItem[] } | null;
  if (!body || !Array.isArray(body.items)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Daftar soal esai tidak ditemukan.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }

  const result = await gradeEssaysWithGemini(body.items);
  return new Response(
    JSON.stringify({
      ok: result.ok,
      grades: result.grades,
      error: result.error,
    }),
    {
      status: result.httpStatus,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }
  );
}
