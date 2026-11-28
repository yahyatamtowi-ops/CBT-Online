import { GoogleGenAI, Type } from '@google/genai';

export interface EssayGradeRequestItem {
  questionId: string;
  prompt: string;
  answerKey: string;
  keywords?: string[];
  maxPoints: number;
  studentAnswer: string;
}

export interface EssayGradeResponseItem {
  questionId: string;
  scoreRatio: number;
  earnedPoints: number;
  maxPoints: number;
  matchPercent: number;
  feedback: string;
  gradedBy: 'ai_semantic';
}

export async function gradeEssaysWithGemini(items: EssayGradeRequestItem[]): Promise<{
  ok: boolean;
  httpStatus: number;
  grades?: EssayGradeResponseItem[];
  error?: string;
}> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return {
      ok: false,
      httpStatus: 503,
      error: 'GEMINI_API_KEY belum dikonfigurasi di server. Menggunakan penilaian semantik lokal.',
    };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'Daftar soal esai tidak boleh kosong.',
    };
  }

  // Cap payload safely to 12 items and reasonable text length
  const sanitizedItems = items.slice(0, 12).map((item) => ({
    questionId: String(item.questionId || '').slice(0, 100),
    prompt: String(item.prompt || '').slice(0, 1200),
    answerKey: String(item.answerKey || '').slice(0, 1500),
    keywords: Array.isArray(item.keywords)
      ? item.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 15)
      : [],
    maxPoints: Number.isFinite(Number(item.maxPoints)) && Number(item.maxPoints) > 0
      ? Number(item.maxPoints)
      : 10,
    studentAnswer: String(item.studentAnswer || '').slice(0, 2500),
  }));

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = [
      'Anda adalah guru evaluator ujian SMA profesional di Indonesia yang menilai soal esai secara objektif dan adil.',
      'TUGAS: Bandingkan jawaban siswa dengan kunci jawaban dan kata kunci konsep.',
      'ATURAN PENILAIAN SEMANTIK:',
      '1. Fokus pada KETEPATAN MAKNA / MAKSUD / KONSEP INTI, BUKAN kesamaan kata persis.',
      '2. Jika siswa menggunakan diksi, sinonim, atau susunan kalimat yang berbeda namun maksud/maknanya SAMA dengan kunci jawaban, berikan scoreRatio tinggi (0.85 - 1.0).',
      '3. Jika jawaban hanya mencakup sebagian konsep kunci, berikan scoreRatio proporsional (0.30 - 0.80) sesuai kelengkapan konsep.',
      '4. Jika jawaban kosong, menyimpang, atau bertentangan dengan kunci jawaban, berikan scoreRatio 0.0 - 0.15.',
      '5. Berikan feedback singkat (1 kalimat Bahasa Indonesia) yang menjelaskan tingkat kesesuaian jawaban siswa.',
    ].join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: JSON.stringify(sanitizedItems),
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionId: { type: Type.STRING },
                  scoreRatio: {
                    type: Type.NUMBER,
                    description: 'Skor ketepatan makna dari 0.0 sampai 1.0',
                  },
                  feedback: {
                    type: Type.STRING,
                    description: 'Umpan balik singkat dalam Bahasa Indonesia (maksimal 1 kalimat)',
                  },
                },
                required: ['questionId', 'scoreRatio', 'feedback'],
              },
            },
          },
          required: ['results'],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) {
      return {
        ok: false,
        httpStatus: 502,
        error: 'Respons penilaian semantik kosong.',
      };
    }

    const parsed = JSON.parse(rawText) as {
      results?: Array<{ questionId?: string; scoreRatio?: number; feedback?: string }>;
    };
    const itemById = new Map(sanitizedItems.map((it) => [it.questionId, it]));
    const grades: EssayGradeResponseItem[] = [];

    for (const row of parsed.results || []) {
      const id = String(row.questionId || '');
      const source = itemById.get(id);
      if (!source) continue;
      const ratio = source.studentAnswer.trim()
        ? Math.max(0, Math.min(1, Number(row.scoreRatio) || 0))
        : 0;
      const earnedPoints = Number((ratio * source.maxPoints).toFixed(2));
      grades.push({
        questionId: id,
        scoreRatio: Number(ratio.toFixed(4)),
        earnedPoints,
        maxPoints: source.maxPoints,
        matchPercent: Math.round(ratio * 100),
        feedback:
          String(row.feedback || '').trim() ||
          (ratio >= 0.8
            ? 'Makna jawaban sangat sesuai dengan kunci jawaban.'
            : ratio >= 0.5
            ? 'Sebagian besar konsep jawaban sudah sesuai dengan kunci.'
            : 'Jawaban masih kurang sesuai dengan konsep pada kunci.'),
        gradedBy: 'ai_semantic',
      });
    }

    return { ok: true, httpStatus: 200, grades };
  } catch (err) {
    return {
      ok: false,
      httpStatus: 502,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal menghubungi layanan penilaian semantik.',
    };
  }
}
