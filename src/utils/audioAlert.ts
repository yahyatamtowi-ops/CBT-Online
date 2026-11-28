/**
 * Synthesizes an unmistakable Web Audio warning chime + Indonesian female voice reprimand
 * whenever a student triggers an anti-cheat security violation.
 */
export function playViolationAlarm(severity: 'warning' | 'critical' = 'warning') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const beeps = severity === 'critical' ? 3 : 2;
    for (let i = 0; i < beeps; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = severity === 'critical' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(severity === 'critical' ? 920 : 780, now + i * 0.22);
      osc.frequency.exponentialRampToValueAtTime(
        severity === 'critical' ? 540 : 620,
        now + i * 0.22 + 0.16
      );

      gain.gain.setValueAtTime(0.001, now + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.24, now + i * 0.22 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.22 + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.22);
      osc.stop(now + i * 0.22 + 0.19);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch {
    // Gracefully ignore if browser autoplay policy blocks Web Audio before interaction
  }
}

/**
 * Generates clear, firm Bahasa Indonesia reprimand speech text tailored to each violation type.
 */
export function buildViolationVoiceMessage(params: {
  type: string;
  severity: 'warning' | 'critical';
  count?: number;
  maxTolerance?: number;
}): string {
  const { type, severity, count, maxTolerance } = params;
  const lower = type.toLowerCase();

  if (severity === 'critical') {
    return 'Perhatian! Batas toleransi pelanggaran Anda telah terlampaui. Sesi ujian Anda dikunci otomatis oleh sistem. Silakan lapor kepada guru pengawas.';
  }

  let base =
    'Perhatian! Sistem mendeteksi pelanggaran tata tertib ujian. Harap kerjakan ujian dengan jujur dan tetap fokus pada layar.';

  if (lower.includes('screenshot') || lower.includes('tangkapan layar') || lower.includes('cetak')) {
    base =
      'Peringatan keras! Mengambil tangkapan layar atau mencetak soal dilarang selama ujian berlangsung. Pelanggaran Anda telah dicatat.';
  } else if (lower.includes('notifikasi') || lower.includes('tepi layar') || lower.includes('kontrol')) {
    base =
      'Perhatian! Anda terdeteksi membuka bilah notifikasi atau menggeser tepi layar. Harap segera tutup notifikasi dan fokus mengerjakan soal.';
  } else if (lower.includes('lebih dari 1 wajah') || lower.includes('dua wajah')) {
    base =
      'Peringatan! Kamera pengawas mendeteksi lebih dari satu wajah di depan layar. Ujian wajib dikerjakan secara mandiri.';
  } else if (lower.includes('wajah tidak terdeteksi')) {
    base =
      'Perhatian! Wajah Anda tidak terdeteksi di kamera pengawas. Harap posisikan wajah Anda tepat menghadap ke kamera.';
  } else if (lower.includes('menunduk') || lower.includes('ke atas')) {
    base =
      'Perhatian! Kamera pengawas mendeteksi Anda menunduk atau mengalihkan pandangan. Harap tetap menatap layar ujian.';
  } else if (lower.includes('kanan') || lower.includes('kiri') || lower.includes('menoleh')) {
    base =
      'Perhatian! Kamera pengawas mendeteksi Anda menoleh ke kiri atau ke kanan. Harap hadapkan wajah lurus ke layar ujian.';
  } else if (lower.includes('mengobrol') || lower.includes('suara')) {
    base =
      'Perhatian! Sensor suara mendeteksi Anda berbicara atau mengobrol. Harap tenang selama ujian berlangsung.';
  } else if (lower.includes('kamera') && lower.includes('dinonaktifkan')) {
    base =
      'Peringatan! Kamera pengawas terputus. Harap segera aktifkan kembali kamera Anda.';
  } else if (
    lower.includes('fullscreen') ||
    lower.includes('layar penuh') ||
    lower.includes('pindah tab') ||
    lower.includes('fokus') ||
    lower.includes('split screen')
  ) {
    base =
      'Perhatian! Anda terdeteksi meninggalkan layar ujian atau berpindah aplikasi. Harap segera kembali ke halaman ujian dan jangan berpindah layar.';
  } else if (lower.includes('devtools') || lower.includes('pintasan')) {
    base =
      'Peringatan! Tombol pintasan yang Anda tekan dilarang selama ujian berlangsung.';
  }

  if (
    typeof count === 'number' &&
    typeof maxTolerance === 'number' &&
    maxTolerance > 0
  ) {
    if (count >= maxTolerance) {
      return `${base} Ini adalah peringatan terakhir sebelum ujian Anda dikunci.`;
    }
    return `${base} Ini peringatan ke ${count} dari ${maxTolerance}.`;
  }

  return base;
}

const FEMALE_VOICE_HINTS = [
  'damayanti',
  'gadis',
  'siti',
  'indah',
  'putri',
  'female',
  'perempuan',
  'wanita',
  'google bahasa indonesia',
  'samantha',
  'zira',
  'jenny',
  'aria',
];

const MALE_VOICE_HINTS = ['ardi', 'andika', 'male', 'pria', 'laki', 'david', 'mark'];

function pickIndonesianFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const isIndo = (v: SpeechSynthesisVoice) =>
    v.lang.toLowerCase().startsWith('id') ||
    v.name.toLowerCase().includes('indonesia');

  const isLikelyMale = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    return MALE_VOICE_HINTS.some((hint) => n.includes(hint));
  };

  const isLikelyFemale = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    return FEMALE_VOICE_HINTS.some((hint) => n.includes(hint));
  };

  const indoVoices = voices.filter(isIndo);
  if (indoVoices.length > 0) {
    const indoFemale = indoVoices.find((v) => isLikelyFemale(v) && !isLikelyMale(v));
    if (indoFemale) return indoFemale;
    const indoNonMale = indoVoices.find((v) => !isLikelyMale(v));
    if (indoNonMale) return indoNonMale;
    return indoVoices[0];
  }

  // Fallback to Malay (close pronunciation) or any clear female voice
  const malayFemale = voices.find(
    (v) => v.lang.toLowerCase().startsWith('ms') && !isLikelyMale(v)
  );
  if (malayFemale) return malayFemale;

  return voices.find((v) => isLikelyFemale(v) && !isLikelyMale(v)) || null;
}

/**
 * Warms up browser speech synthesis voices on user gesture so reprimand voice
 * plays cleanly without delay when a violation occurs.
 */
export function primeViolationVoice() {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.getVoices();
  } catch {
    // ignore
  }
}

/**
 * Speaks a firm Indonesian female proctor reprimand using Web Speech API.
 */
export function speakViolationWarning(params: {
  type: string;
  severity: 'warning' | 'critical';
  count?: number;
  maxTolerance?: number;
}) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const text = buildViolationVoiceMessage(params);

    const doSpeak = () => {
      try {
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        const voices = synth.getVoices();
        const chosen = pickIndonesianFemaleVoice(voices);
        if (chosen) {
          utterance.voice = chosen;
          if (chosen.lang) utterance.lang = chosen.lang;
        }
        // Slightly higher pitch + clear calm rate ensures unmistakable female voice tone
        utterance.pitch = 1.22;
        utterance.rate = 0.98;
        utterance.volume = 1;
        synth.speak(utterance);
      } catch {
        // Gracefully ignore blocked speech
      }
    };

    // Short delay after chime so chime and female voice don't drown each other out
    window.setTimeout(doSpeak, 280);
  } catch {
    // Ignore on unsupported browsers
  }
}
