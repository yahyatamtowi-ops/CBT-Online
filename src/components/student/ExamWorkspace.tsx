import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  LayoutGrid,
  Lock,
  Maximize2,
  Mic,
  MicOff,
  Moon,
  Save,
  ShieldAlert,
  Sun,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type {
  ExamAttempt,
  ExamPackage,
  Question,
  StudentAnswerValue,
} from '../../types/cbt';
import { playViolationAlarm } from '../../utils/audioAlert';
import {
  evaluateCameraBehavior,
  formatSecondsToClock,
  getRemainingExamSeconds,
  getRemainingMinSubmitSeconds,
  isQuestionAnswered,
  seededShuffle,
} from '../../utils/cbtLogic';

type FontSizeOption = 'sm' | 'md' | 'lg';

interface ActiveWarningModal {
  type: string;
  detail: string;
  timestamp: string;
  count: number;
  maxTolerance: number;
  requiresFullscreenReturn: boolean;
}

export function ExamWorkspace({
  attempt,
  examPackage,
  questions,
}: {
  attempt: ExamAttempt;
  examPackage: ExamPackage;
  questions: Question[];
}) {
  const {
    db,
    logout,
    saveStudentAnswer,
    toggleFlagQuestion,
    updateCurrentQuestionIndex,
    recordStudentViolation,
    submitStudentExam,
  } = useCBT();

  const [currentIndex, setCurrentIndex] = useState(
    Math.min(attempt.currentQuestionIndex || 0, Math.max(0, questions.length - 1))
  );
  const [fontSize, setFontSize] = useState<FontSizeOption>('md');
  const [darkMode, setDarkMode] = useState(db.theme.mode === 'dark');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSavedText, setLastSavedText] = useState('Tersimpan otomatis');
  const [nowMs, setNowMs] = useState(Date.now());

  // Security & lockdown states
  const [warningModal, setWarningModal] = useState<ActiveWarningModal | null>(null);
  const [fullscreenBlockedOverlay, setFullscreenBlockedOverlay] = useState(false);
  const [screenshotShieldActive, setScreenshotShieldActive] = useState(false);

  // Camera & Microphone proctoring states
  const [cameraState, setCameraState] = useState<
    'idle' | 'active' | 'denied' | 'disconnected'
  >(db.security.requireCameraMonitoring ? 'idle' : 'idle');
  const [cameraBehaviorStatus, setCameraBehaviorStatus] = useState<
    'focused' | 'looking_away' | 'talking'
  >('focused');
  const [micActive, setMicActive] = useState(false);
  const [audioLevelPct, setAudioLevelPct] = useState(0);
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0);

  // Tiered Finish modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const lastViolationAtRef = useRef<number>(0);
  const autoSubmittedRef = useRef<boolean>(false);
  const enteredFullscreenOnceRef = useRef<boolean>(false);
  const initialSizeRef = useRef<{ w: number; h: number }>({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  // Camera proctoring refs
  const proctorVideoRef = useRef<HTMLVideoElement | null>(null);
  const proctorStreamRef = useRef<MediaStream | null>(null);
  const prevLumaRef = useRef<Uint8Array | null>(null);
  const baselineCentroidXRef = useRef<number | null>(null);
  const calibrationSamplesRef = useRef<number[]>([]);
  const turnFramesRef = useRef<number>(0);
  const speechFramesRef = useRef<number>(0);

  // Sync dark mode class on <html> without clobbering global theme on unmount
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    return () => {
      if (db.theme.mode === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
    };
  }, [darkMode, db.theme.mode]);

  // Live clock tick (1s) for remaining exam timer, min submit timer, and watermark timestamp
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Online / Offline detector
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Ordered questions matching attempt.questionOrder, appending any newly added questions
  const orderedQuestions = useMemo(() => {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const ordered = attempt.questionOrder
      .map((id) => byId.get(id))
      .filter((q): q is Question => Boolean(q));
    const orderedIds = new Set(ordered.map((q) => q.id));
    const extras = questions.filter((q) => !orderedIds.has(q.id));
    const combined = [...ordered, ...extras];
    return combined.length > 0 ? combined : questions;
  }, [attempt.questionOrder, questions]);

  // Keep currentIndex within bounds if question list shrinks
  useEffect(() => {
    if (orderedQuestions.length > 0 && currentIndex >= orderedQuestions.length) {
      setCurrentIndex(orderedQuestions.length - 1);
    }
  }, [currentIndex, orderedQuestions.length]);

  const currentQuestion = orderedQuestions[currentIndex] || orderedQuestions[0];

  const remainingSeconds = getRemainingExamSeconds(
    attempt.startedAt,
    examPackage.durationMinutes,
    attempt.extraMinutes,
    nowMs
  );

  const minSubmitRemainingSeconds = getRemainingMinSubmitSeconds(
    attempt.startedAt,
    examPackage.minSubmitMinutes,
    nowMs
  );

  // Auto-submit once when time reaches 0
  useEffect(() => {
    if (
      attempt.status === 'in_progress' &&
      remainingSeconds <= 0 &&
      !autoSubmittedRef.current
    ) {
      autoSubmittedRef.current = true;
      submitStudentExam(attempt.id);
    }
  }, [attempt.id, attempt.status, remainingSeconds, submitStudentExam]);

  const triggerViolation = useCallback(
    (type: string, detail: string, requiresFullscreenReturn = false) => {
      if (attempt.status !== 'in_progress') return;
      const now = Date.now();
      // Debounce duplicate simultaneous events (e.g., blur + visibilitychange)
      if (now - lastViolationAtRef.current < 1800) return;
      lastViolationAtRef.current = now;

      const result = recordStudentViolation(attempt.id, type, detail);
      playViolationAlarm(result.locked ? 'critical' : 'warning');

      if (!result.locked) {
        setWarningModal({
          type,
          detail,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          count: result.nextCount,
          maxTolerance: db.security.maxViolationTolerance,
          requiresFullscreenReturn,
        });
      }
    },
    [attempt.id, attempt.status, db.security.maxViolationTolerance, recordStudentViolation]
  );

  const requestEnterFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        enteredFullscreenOnceRef.current = true;
        setFullscreenBlockedOverlay(false);
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
        enteredFullscreenOnceRef.current = true;
        setFullscreenBlockedOverlay(false);
      }
    } catch {
      // Some embedded iframe environments block requestFullscreen; keep exam playable with other guards active
      setFullscreenBlockedOverlay(false);
    }
  }, []);

  // Attempt fullscreen entry on mount if required by Admin
  useEffect(() => {
    if (db.security.requireFullscreen && attempt.status === 'in_progress') {
      requestEnterFullscreen();
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [attempt.status, db.security.requireFullscreen, requestEnterFullscreen]);

  // Anti-Cheat Event Listeners: Fullscreen exit, Tab switch, Window blur, Split screen resize
  useEffect(() => {
    if (attempt.status !== 'in_progress') return;

    const handleFullscreenChange = () => {
      if (!db.security.requireFullscreen) return;
      if (document.fullscreenElement) {
        enteredFullscreenOnceRef.current = true;
        setFullscreenBlockedOverlay(false);
      } else if (enteredFullscreenOnceRef.current) {
        setFullscreenBlockedOverlay(true);
        triggerViolation(
          'Keluar Mode Fullscreen',
          'Peserta keluar dari mode layar penuh selama sesi ujian berlangsung.',
          true
        );
      }
    };

    const handleVisibilityChange = () => {
      if (!db.security.detectTabSwitchAndSplitScreen) return;
      if (document.hidden) {
        triggerViolation(
          'Pindah Tab / Aplikasi Ditinggalkan',
          'Tab ujian tidak aktif karena siswa berpindah tab atau meminimalkan browser.'
        );
      }
    };

    const handleWindowBlur = () => {
      if (!db.security.detectTabSwitchAndSplitScreen) return;
      triggerViolation(
        'Kehilangan Fokus Jendela Browser',
        'Kursor atau fokus jendela berpindah ke aplikasi atau layar lain di luar ujian.'
      );
    };

    const handleResize = () => {
      if (!db.security.detectTabSwitchAndSplitScreen) return;
      const prevW = initialSizeRef.current.w;
      const prevH = initialSizeRef.current.h;
      const curW = window.innerWidth;
      const curH = window.innerHeight;
      if (prevW > 500 && (curW < prevW * 0.76 || curH < prevH * 0.72)) {
        triggerViolation(
          'Deteksi Split Screen / Perubahan Layar',
          `Ukuran layar menyusut drastis (${curW}×${curH}px), terindikasi Split Screen atau Floating Window.`
        );
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('resize', handleResize);
    };
  }, [
    attempt.status,
    db.security.detectTabSwitchAndSplitScreen,
    db.security.requireFullscreen,
    triggerViolation,
  ]);

  // Anti-Cheat Event Listeners: Right-click, Copy/Paste, Drag, DevTools, PrintScreen
  useEffect(() => {
    if (!db.security.blockRightClickAndCopyPaste || attempt.status !== 'in_progress') {
      return;
    }

    const blockEvent = (e: Event) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      if (e.key === 'PrintScreen') {
        e.preventDefault();
        setScreenshotShieldActive(true);
        triggerViolation(
          'Percobaan Screenshot (PrintScreen)',
          'Tombol PrintScreen ditekan. Layar soal diburamkan otomatis.'
        );
        setTimeout(() => setScreenshotShieldActive(false), 3500);
        return;
      }

      const isDevTools =
        e.key === 'F12' ||
        (ctrlOrMeta && e.shiftKey && ['i', 'j', 'c'].includes(key));

      const isBlockedShortcut =
        ctrlOrMeta && ['c', 'v', 'x', 'a', 'p', 's', 'u'].includes(key);

      const isAltTab = e.altKey && key === 'tab';

      if (isDevTools || isBlockedShortcut || isAltTab) {
        e.preventDefault();
        triggerViolation(
          isDevTools ? 'Percobaan Inspeksi DevTools' : 'Pintasan Keyboard Terlarang',
          `Kombinasi tombol terlarang (${e.ctrlKey ? 'Ctrl+' : ''}${
            e.shiftKey ? 'Shift+' : ''
          }${e.altKey ? 'Alt+' : ''}${e.key}) diblokir oleh sistem.`
        );
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        setScreenshotShieldActive(true);
        triggerViolation(
          'Percobaan Screenshot (PrintScreen)',
          'Tombol tangkapan layar terdeteksi.'
        );
        setTimeout(() => setScreenshotShieldActive(false), 3500);
      }
    };

    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('cut', blockEvent);
    document.addEventListener('paste', blockEvent);
    document.addEventListener('dragstart', blockEvent);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('contextmenu', blockEvent);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('cut', blockEvent);
      document.removeEventListener('paste', blockEvent);
      document.removeEventListener('dragstart', blockEvent);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [attempt.status, db.security.blockRightClickAndCopyPaste, triggerViolation]);

  // Camera & Audio Proctoring: detect looking left/right, talking, or disconnecting camera
  useEffect(() => {
    if (!db.security.requireCameraMonitoring || attempt.status !== 'in_progress') {
      return;
    }

    let cancelled = false;
    let monitorInterval: number | null = null;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let audioBuffer: Float32Array<ArrayBuffer> | null = null;
    const offscreen = document.createElement('canvas');
    offscreen.width = 64;
    offscreen.height = 48;
    const ctx2d = offscreen.getContext('2d', { willReadFrequently: true });

    prevLumaRef.current = null;
    baselineCentroidXRef.current = null;
    calibrationSamplesRef.current = [];
    turnFramesRef.current = 0;
    speechFramesRef.current = 0;

    const cleanupMedia = () => {
      if (monitorInterval !== null) {
        window.clearInterval(monitorInterval);
        monitorInterval = null;
      }
      if (proctorStreamRef.current) {
        proctorStreamRef.current.getTracks().forEach((t) => t.stop());
        proctorStreamRef.current = null;
      }
      if (proctorVideoRef.current) {
        proctorVideoRef.current.srcObject = null;
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    };

    const initCameraMonitor = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('denied');
        setCameraErrorMsg('Perangkat/browser tidak mendukung akses kamera.');
        return;
      }

      try {
        let stream: MediaStream;
        let hasAudio = false;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
            audio: true,
          });
          hasAudio = stream.getAudioTracks().length > 0;
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
            audio: false,
          });
          hasAudio = false;
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        proctorStreamRef.current = stream;
        setCameraState('active');
        setMicActive(hasAudio);
        setCameraErrorMsg(null);

        if (proctorVideoRef.current) {
          proctorVideoRef.current.srcObject = stream;
          proctorVideoRef.current.play().catch(() => {});
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.addEventListener('ended', () => {
            if (!cancelled) {
              setCameraState('disconnected');
              setCameraErrorMsg('Kamera terputus saat ujian berlangsung.');
              triggerViolation(
                'Kamera Pengawas Dinonaktifkan',
                'Aliran kamera pengawas terputus atau dinonaktifkan secara manual saat ujian berlangsung.'
              );
            }
          });
        }

        if (hasAudio && typeof AudioContext !== 'undefined') {
          try {
            audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(stream);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            audioBuffer = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
          } catch {
            analyser = null;
          }
        }

        monitorInterval = window.setInterval(() => {
          if (cancelled) return;
          const videoEl = proctorVideoRef.current;

          let horizontalShift = 0;
          let lateralMotionScore = 0;

          if (videoEl && videoEl.readyState >= 2 && ctx2d) {
            ctx2d.drawImage(videoEl, 0, 0, 64, 48);
            const imgData = ctx2d.getImageData(0, 0, 64, 48).data;
            const currentLuma = new Uint8Array(64 * 48);

            let weightedX = 0;
            let weightTotal = 0;
            let leftDiff = 0;
            let rightDiff = 0;
            let regionPixels = 0;

            for (let y = 6; y < 42; y++) {
              for (let x = 6; x < 58; x++) {
                const pIdx = y * 64 + x;
                const dIdx = pIdx * 4;
                const r = imgData[dIdx];
                const g = imgData[dIdx + 1];
                const b = imgData[dIdx + 2];
                const luma = (r * 77 + g * 150 + b * 29) >> 8;
                currentLuma[pIdx] = luma;

                // Skin-tone / illuminated foreground weighting for horizontal face centroid
                const isSkinLike = r > 70 && g > 35 && b > 20 && r > g && r > b;
                const weight = isSkinLike ? 3 : luma > 85 ? 1 : 0;
                if (weight > 0) {
                  const normX = (x - 32) / 26; // -1 .. +1
                  weightedX += normX * weight;
                  weightTotal += weight;
                }

                if (prevLumaRef.current) {
                  const diff = Math.abs(luma - prevLumaRef.current[pIdx]);
                  if (diff > 24) {
                    if (x < 32) leftDiff += 1;
                    else rightDiff += 1;
                  }
                  regionPixels += 1;
                }
              }
            }

            prevLumaRef.current = currentLuma;

            if (weightTotal > 20) {
              const centroidX = weightedX / weightTotal;
              if (baselineCentroidXRef.current === null) {
                calibrationSamplesRef.current.push(centroidX);
                if (calibrationSamplesRef.current.length >= 3) {
                  const sum = calibrationSamplesRef.current.reduce((a, b) => a + b, 0);
                  baselineCentroidXRef.current = sum / calibrationSamplesRef.current.length;
                }
              } else {
                horizontalShift = Math.max(
                  -1,
                  Math.min(1, centroidX - baselineCentroidXRef.current)
                );
              }
            }

            if (regionPixels > 0) {
              // Lateral asymmetry score indicates sudden turning to left or right side
              const totalMoved = leftDiff + rightDiff;
              const asymmetry = Math.abs(leftDiff - rightDiff) / (regionPixels * 0.5);
              lateralMotionScore = totalMoved > 60 ? Math.min(1, asymmetry * 1.4) : 0;
            }
          }

          let audioRms = 0;
          if (analyser && audioBuffer) {
            analyser.getFloatTimeDomainData(audioBuffer);
            let sumSq = 0;
            for (let i = 0; i < audioBuffer.length; i++) {
              sumSq += audioBuffer[i] * audioBuffer[i];
            }
            audioRms = Math.sqrt(sumSq / audioBuffer.length);
            setAudioLevelPct(Math.min(100, Math.round(audioRms * 450)));
          }

          const evaluation = evaluateCameraBehavior({
            horizontalShift,
            lateralMotionScore,
            audioRms,
            consecutiveTurnFrames: turnFramesRef.current,
            consecutiveSpeechFrames: speechFramesRef.current,
          });

          turnFramesRef.current = evaluation.nextTurnFrames;
          speechFramesRef.current = evaluation.nextSpeechFrames;
          setCameraBehaviorStatus(evaluation.status);

          if (
            evaluation.shouldFlagViolation &&
            evaluation.violationType &&
            evaluation.violationDetail
          ) {
            triggerViolation(evaluation.violationType, evaluation.violationDetail);
          }
        }, 750);
      } catch {
        if (!cancelled) {
          setCameraState('denied');
          setMicActive(false);
          setCameraErrorMsg(
            'Akses kamera tidak aktif. Klik Aktifkan Kamera agar pengawasan berjalan.'
          );
        }
      }
    };

    initCameraMonitor();

    return () => {
      cancelled = true;
      cleanupMedia();
    };
  }, [
    attempt.status,
    cameraRetryNonce,
    db.security.requireCameraMonitoring,
    triggerViolation,
  ]);

  const handleSelectQuestion = (idx: number) => {
    const safeIdx = Math.max(0, Math.min(idx, orderedQuestions.length - 1));
    setCurrentIndex(safeIdx);
    updateCurrentQuestionIndex(attempt.id, safeIdx);
    setMobileNavOpen(false);
  };

  const handleAnswerChange = (questionId: string, val: StudentAnswerValue) => {
    saveStudentAnswer(attempt.id, questionId, val);
    setLastSavedText(
      `Tersimpan ${new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}`
    );
  };

  const answeredCount = orderedQuestions.filter((q) =>
    isQuestionAnswered(q, attempt.answers[q.id])
  ).length;
  const unansweredCount = orderedQuestions.length - answeredCount;
  const activeQuestionIds = useMemo(
    () => new Set(orderedQuestions.map((q) => q.id)),
    [orderedQuestions]
  );
  const flaggedCount = attempt.flaggedQuestionIds.filter((id) =>
    activeQuestionIds.has(id)
  ).length;

  const fontSizeClass =
    fontSize === 'sm'
      ? 'text-sm leading-relaxed'
      : fontSize === 'lg'
      ? 'text-lg leading-relaxed'
      : 'text-base leading-relaxed';

  // Build display options respecting shuffle order and appending any newly added options (e.g. Option E)
  const currentOptions = useMemo(() => {
    if (!currentQuestion?.options) return [];
    const order = attempt.optionOrders[currentQuestion.id];
    if (!order || order.length === 0) return currentQuestion.options;
    const byId = new Map(currentQuestion.options.map((o) => [o.id, o]));
    const mapped = order
      .map((id) => byId.get(id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o));
    const mappedIds = new Set(mapped.map((o) => o.id));
    const extras = currentQuestion.options.filter((o) => !mappedIds.has(o.id));
    return [...mapped, ...extras];
  }, [attempt.optionOrders, currentQuestion]);

  // Shuffled right-side choices for matching questions
  const matchingRightChoices = useMemo(() => {
    if (!currentQuestion?.matchingPairs) return [];
    const rights = currentQuestion.matchingPairs.map((p) => p.right);
    return seededShuffle(rights, `${attempt.studentNisn}-${currentQuestion.id}-right`);
  }, [attempt.studentNisn, currentQuestion]);

  const watermarkLabel = `${attempt.studentNisn} · ${attempt.studentName} · ${new Date(
    nowMs
  ).toLocaleTimeString('id-ID')}`;

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-8 text-center space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Paket soal tidak memiliki butir pertanyaan.
        </p>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const currentAnswer = attempt.answers[currentQuestion.id];
  const isCurrentFlagged = attempt.flaggedQuestionIds.includes(currentQuestion.id);

  return (
    <div
      className={`min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col exam-print-shield ${
        db.security.blockRightClickAndCopyPaste ? 'exam-no-select' : ''
      }`}
    >
      {/* Offline Warning Banner */}
      {!isOnline && (
        <div
          role="alert"
          className="bg-amber-600 text-white px-4 py-2.5 text-center text-xs font-semibold flex items-center justify-center gap-2"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            Koneksi terputus, jawaban tersimpan aman di perangkat. Jangan tutup browser.
          </span>
        </div>
      )}

      {/* Compact Sticky Exam Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 truncate">
              {examPackage.subject} · {attempt.studentName} ({attempt.studentNisn})
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {examPackage.title}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Compact Camera Proctoring Status */}
            {db.security.requireCameraMonitoring && (
              <div
                className={`hidden md:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                  cameraState !== 'active'
                    ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    : cameraBehaviorStatus === 'focused'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                }`}
              >
                {cameraState === 'active' ? (
                  <Camera className="h-3.5 w-3.5" />
                ) : (
                  <CameraOff className="h-3.5 w-3.5" />
                )}
                <span>
                  {cameraState !== 'active'
                    ? 'Kamera Nonaktif'
                    : cameraBehaviorStatus === 'talking'
                    ? 'Suara Terdeteksi'
                    : cameraBehaviorStatus === 'looking_away'
                    ? 'Menoleh Terdeteksi'
                    : 'Kamera Aktif'}
                </span>
              </div>
            )}

            {/* Timer */}
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-sm font-bold tabular-nums ${
                remainingSeconds <= 300
                  ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                  : 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
              }`}
              aria-label="Sisa waktu ujian"
            >
              <Clock className="h-4 w-4" />
              <span>{formatSecondsToClock(remainingSeconds)}</span>
            </div>

            {/* Font Size Controls */}
            <div
              className="hidden sm:inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800"
              role="group"
              aria-label="Ukuran huruf soal"
            >
              {(['sm', 'md', 'lg'] as FontSizeOption[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`rounded-md px-2 py-1 text-xs font-bold uppercase transition-colors ${
                    fontSize === sz
                      ? 'bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-indigo-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {sz === 'sm' ? 'S' : sz === 'md' ? 'M' : 'L'}
                </button>
              ))}
            </div>

            {/* Dark/Light Mode Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Mobile Question Map Trigger */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Buka peta nomor soal"
              className="lg:hidden inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="font-mono tabular-nums">
                {currentIndex + 1}/{orderedQuestions.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Two-Column Exam Layout */}
      <main className="relative mx-auto w-full max-w-7xl flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 py-6 sm:px-6">
        {/* Question Area (Protected with Dynamic Watermark) */}
        <section
          className={`relative lg:col-span-8 xl:col-span-9 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 sm:p-8 overflow-hidden flex flex-col justify-between min-h-[540px] ${
            screenshotShieldActive ? 'blur-xl brightness-0' : ''
          }`}
        >
          {/* Dynamic Anti-Photo Watermark Overlay */}
          {db.security.enableDynamicWatermark && (
            <div
              aria-hidden="true"
              data-testid="dynamic-watermark"
              className="pointer-events-none select-none absolute inset-0 z-10 overflow-hidden opacity-[0.06] dark:opacity-[0.08]"
            >
              <div className="grid grid-cols-2 gap-y-20 gap-x-10 -rotate-12 scale-110 p-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="font-mono text-xs font-bold tracking-wider text-slate-900 dark:text-slate-100 whitespace-nowrap"
                  >
                    {watermarkLabel}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question Content */}
          <div className="relative z-20 space-y-6">
            {/* Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                  Soal {currentIndex + 1} dari {orderedQuestions.length}
                </span>
                <span>·</span>
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                  {currentQuestion.type === 'single_choice'
                    ? 'Pilihan Ganda'
                    : currentQuestion.type === 'multiple_choice'
                    ? 'Pilihan Ganda Kompleks'
                    : currentQuestion.type === 'matching'
                    ? 'Menjodohkan'
                    : 'Benar / Salah'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                  {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5 text-amber-600" />}
                  <Save className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{lastSavedText}</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggleFlagQuestion(attempt.id, currentQuestion.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    isCurrentFlagged
                      ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Flag className="h-3.5 w-3.5" />
                  <span>{isCurrentFlagged ? 'Ditandai Ragu-ragu' : 'Tandai Ragu-ragu'}</span>
                </button>
              </div>
            </div>

            {/* Prompt & Optional Diagram */}
            <div className="space-y-4">
              <p className={`${fontSizeClass} font-medium text-slate-900 dark:text-slate-100`}>
                {currentQuestion.prompt}
              </p>

              {currentQuestion.imageUrl && (
                <div className="max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-3">
                  <img
                    src={currentQuestion.imageUrl}
                    alt={`Diagram soal nomor ${currentIndex + 1}`}
                    referrerPolicy="no-referrer"
                    className="max-h-64 w-full object-contain rounded"
                  />
                </div>
              )}
            </div>

            {/* Answer Controls by Question Type */}
            <div className="pt-2 space-y-3">
              {/* SINGLE CHOICE */}
              {currentQuestion.type === 'single_choice' && (
                <div className="space-y-2.5" role="radiogroup" aria-label="Pilihan jawaban">
                  {currentOptions.map((opt, displayIdx) => {
                    const displayLetter = String.fromCharCode(65 + displayIdx);
                    const selected = currentAnswer === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => handleAnswerChange(currentQuestion.id, opt.id)}
                        className={`flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-colors ${
                          selected
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-100'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold ${
                            selected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'
                          }`}
                        >
                          {displayLetter}
                        </span>
                        <span className={`${fontSizeClass} pt-0.5`}>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* MULTIPLE CHOICE (KOMPLEKS) */}
              {currentQuestion.type === 'multiple_choice' && (
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">
                    Pilih lebih dari satu jawaban yang menurut Anda benar:
                  </p>
                  {currentOptions.map((opt, displayIdx) => {
                    const displayLetter = String.fromCharCode(65 + displayIdx);
                    const selectedList = Array.isArray(currentAnswer) ? currentAnswer : [];
                    const checked = selectedList.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => {
                          const next = checked
                            ? selectedList.filter((id) => id !== opt.id)
                            : [...selectedList, opt.id];
                          handleAnswerChange(currentQuestion.id, next);
                        }}
                        className={`flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-colors ${
                          checked
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-100'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-bold ${
                            checked
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'
                          }`}
                        >
                          {checked ? '✓' : displayLetter}
                        </span>
                        <span className={`${fontSizeClass} pt-0.5`}>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* TRUE / FALSE */}
              {currentQuestion.type === 'true_false' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {[
                    { value: true, label: 'BENAR' },
                    { value: false, label: 'SALAH' },
                  ].map((item) => {
                    const selected = currentAnswer === item.value;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handleAnswerChange(currentQuestion.id, item.value)}
                        className={`rounded-xl border p-5 text-center font-bold tracking-wide transition-colors ${
                          selected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* MATCHING */}
              {currentQuestion.type === 'matching' && currentQuestion.matchingPairs && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">
                    Pilih pasangan jawaban yang tepat untuk setiap premis berikut:
                  </p>
                  {currentQuestion.matchingPairs.map((pair, idx) => {
                    const mapAnswer =
                      currentAnswer && typeof currentAnswer === 'object' && !Array.isArray(currentAnswer)
                        ? (currentAnswer as Record<string, string>)
                        : {};
                    return (
                      <div
                        key={pair.id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 p-4"
                      >
                        <div className="sm:col-span-6 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          <span className="font-mono text-xs text-slate-500 mr-2">
                            {idx + 1}.
                          </span>
                          {pair.left}
                        </div>
                        <div className="sm:col-span-6">
                          <select
                            aria-label={`Pasangan untuk ${pair.left}`}
                            value={mapAnswer[pair.id] || ''}
                            onChange={(e) => {
                              handleAnswerChange(currentQuestion.id, {
                                ...mapAnswer,
                                [pair.id]: e.target.value,
                              });
                            }}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                          >
                            <option value="">-- Pilih pasangan jawaban --</option>
                            {matchingRightChoices.map((choice) => (
                              <option key={choice} value={choice}>
                                {choice}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Prev / Next Controls */}
          <div className="relative z-20 mt-8 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-5">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => handleSelectQuestion(currentIndex - 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Soal Sebelumnya</span>
            </button>

            {currentIndex < orderedQuestions.length - 1 ? (
              <button
                type="button"
                onClick={() => handleSelectQuestion(currentIndex + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
              >
                <span>Soal Berikutnya</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setConfirmChecked(false);
                  setShowSubmitModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Selesaikan Ujian</span>
              </button>
            )}
          </div>
        </section>

        {/* Desktop Question Navigator & Status Sidebar */}
        <aside className="hidden lg:flex lg:col-span-4 xl:col-span-3 flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Peta Navigasi Soal
              </h2>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {answeredCount}/{orderedQuestions.length}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {orderedQuestions.map((q, idx) => {
                const answered = isQuestionAnswered(q, attempt.answers[q.id]);
                const flagged = attempt.flaggedQuestionIds.includes(q.id);
                const isCurrent = idx === currentIndex;

                let cls =
                  'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
                if (flagged) {
                  cls =
                    'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-200';
                } else if (answered) {
                  cls =
                    'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-600';
                }
                if (isCurrent) {
                  cls += ' ring-2 ring-indigo-600 ring-offset-1 dark:ring-offset-slate-900';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleSelectQuestion(idx)}
                    aria-label={`Nomor soal ${idx + 1}${answered ? ', sudah dijawab' : ', belum dijawab'}${
                      flagged ? ', ragu-ragu' : ''
                    }`}
                    className={`h-10 rounded-lg border font-mono text-xs font-bold transition-colors ${cls}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Clean Legend */}
            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-emerald-600 shrink-0" />
                <span>Dijawab ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-300 border border-amber-500 shrink-0" />
                <span>Ragu ({flaggedCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border border-slate-300 bg-white dark:bg-slate-800 shrink-0" />
                <span>Kosong ({unansweredCount})</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmChecked(false);
                setShowSubmitModal(true);
              }}
              className="w-full rounded-lg bg-slate-900 dark:bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-indigo-700"
            >
              Kumpulkan & Selesai Ujian
            </button>
          </div>

          {/* Camera & Audio Proctor Card */}
          {db.security.requireCameraMonitoring && (
            <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between font-semibold">
                <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Camera className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Kamera Pengawas</span>
                </span>
                <span
                  className={`font-semibold ${
                    cameraState !== 'active'
                      ? 'text-rose-600 dark:text-rose-400'
                      : cameraBehaviorStatus === 'focused'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {cameraState !== 'active'
                    ? 'Nonaktif'
                    : cameraBehaviorStatus === 'talking'
                    ? 'Mengobrol!'
                    : cameraBehaviorStatus === 'looking_away'
                    ? 'Menoleh!'
                    : 'Fokus'}
                </span>
              </div>

              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 flex items-center justify-center">
                <video
                  ref={proctorVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover -scale-x-100 ${
                    cameraState === 'active' ? 'block' : 'hidden'
                  }`}
                />
                {cameraState !== 'active' && (
                  <div className="flex flex-col items-center gap-1.5 px-3 text-center text-slate-400">
                    <CameraOff className="h-5 w-5" />
                    <span className="text-[11px]">
                      {cameraErrorMsg || 'Menyiapkan kamera pengawas...'}
                    </span>
                  </div>
                )}
              </div>

              {cameraState === 'active' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      {micActive ? (
                        <Mic className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <MicOff className="h-3 w-3 text-slate-400" />
                      )}
                      <span>{micActive ? 'Sensor Suara Aktif' : 'Mikrofon Tidak Aktif'}</span>
                    </span>
                    <span className="font-mono tabular-nums">{audioLevelPct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        audioLevelPct > 35 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${audioLevelPct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Hadapkan wajah ke layar. Menoleh kanan/kiri atau mengobrol dicatat sebagai pelanggaran.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCameraRetryNonce((n) => n + 1)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Aktifkan Ulang Kamera</span>
                </button>
              )}
            </div>
          )}

          {/* Integrity Monitor Card */}
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-slate-700 dark:text-slate-300">
                Pengawasan Integritas
              </span>
              <span
                className={`font-mono tabular-nums ${
                  attempt.violationCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {attempt.violationCount} / {db.security.maxViolationTolerance}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Jangan berpindah tab, mengecilkan jendela, menoleh berulang, atau menekan tombol pintasan terlarang selama ujian berlangsung.
            </p>
            {db.security.requireFullscreen && !document.fullscreenElement && (
              <button
                type="button"
                onClick={requestEnterFullscreen}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/60 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Aktifkan Layar Penuh</span>
              </button>
            )}
          </div>
        </aside>
      </main>

      {/* Mobile Navigator Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 flex w-72 flex-col bg-white dark:bg-slate-900 h-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <span className="text-sm font-bold">Navigasi Soal</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Tutup navigasi soal"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2 flex-1 content-start overflow-y-auto">
              {orderedQuestions.map((q, idx) => {
                const answered = isQuestionAnswered(q, attempt.answers[q.id]);
                const flagged = attempt.flaggedQuestionIds.includes(q.id);
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleSelectQuestion(idx)}
                    className={`h-10 rounded-lg border font-mono text-xs font-bold ${
                      flagged
                        ? 'border-amber-400 bg-amber-100 text-amber-900'
                        : answered
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                    } ${isCurrent ? 'ring-2 ring-indigo-600' : ''}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                setConfirmChecked(false);
                setShowSubmitModal(true);
              }}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white"
            >
              Selesaikan Ujian
            </button>
          </div>
        </div>
      )}

      {/* RED FULLSCREEN EXIT SHIELD OVERLAY */}
      {fullscreenBlockedOverlay && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/95 p-6 text-white"
        >
          <div className="max-w-md w-full rounded-xl border border-rose-500 bg-rose-900 p-6 space-y-4 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-rose-200" />
            <h2 className="text-xl font-bold">Mode Layar Penuh Terputus!</h2>
            <p className="text-sm text-rose-100 leading-relaxed">
              Soal disembunyikan sementara karena Anda keluar dari mode Fullscreen. Pelanggaran telah dicatat secara otomatis ke laporan pengawas.
            </p>
            <div className="font-mono text-xs bg-rose-950/70 rounded-lg py-2 px-3">
              Peringatan Keamanan: {attempt.violationCount} / {db.security.maxViolationTolerance}
            </div>
            <button
              type="button"
              onClick={() => {
                setWarningModal(null);
                requestEnterFullscreen();
              }}
              className="w-full rounded-lg bg-white px-5 py-3 text-sm font-bold text-rose-900 hover:bg-rose-50"
            >
              Aktifkan Kembali Layar Penuh & Lanjutkan
            </button>
          </div>
        </div>
      )}

      {/* ESCALATING ANTI-CHEAT WARNING MODAL */}
      {warningModal && !fullscreenBlockedOverlay && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
        >
          <div className="max-w-md w-full rounded-xl border border-rose-300 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-rose-100 p-2.5 text-rose-700 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-mono font-bold text-rose-700">
                  PERINGATAN KEAMANAN #{warningModal.count} DARI {warningModal.maxTolerance}
                </p>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {warningModal.type}
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {warningModal.detail}
            </p>

            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-900 dark:text-rose-200 space-y-1">
              <div>
                Waktu tercatat: <span className="font-mono font-semibold">{warningModal.timestamp}</span>
              </div>
              <div>
                {warningModal.count >= warningModal.maxTolerance
                  ? 'Ini adalah peringatan TERAKHIR. Pelanggaran berikutnya akan langsung mengunci dan mengumpulkan ujian Anda!'
                  : `Sisa toleransi sebelum ujian terkunci otomatis: ${
                      warningModal.maxTolerance - warningModal.count
                    }x pelanggaran lagi.`}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setWarningModal(null);
                if (warningModal.requiresFullscreenReturn) {
                  requestEnterFullscreen();
                }
              }}
              className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Saya Mengerti & Kembali ke Ujian
            </button>
          </div>
        </div>
      )}

      {/* TIERED SUBMIT CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
        >
          <div className="max-w-md w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {examPackage.category === 'Latihan Mandiri'
                  ? 'Konfirmasi Penyelesaian Latihan'
                  : 'Konfirmasi Penyelesaian Ujian'}
              </h2>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                aria-label="Tutup dialog selesai"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-center text-xs">
              <div>
                <div className="text-slate-500">Terjawab</div>
                <div className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
                  {answeredCount}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Ragu-ragu</div>
                <div className="font-mono text-base font-bold text-amber-600">
                  {flaggedCount}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Kosong</div>
                <div className="font-mono text-base font-bold text-rose-600">
                  {unansweredCount}
                </div>
              </div>
            </div>

            {minSubmitRemainingSeconds > 0 ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
                <div>
                  <div className="font-bold">Tombol Selesai Masih Terkunci</div>
                  <p className="mt-0.5">
                    Guru mengatur batas minimal waktu pengerjaan ({examPackage.minSubmitMinutes} menit). Anda baru dapat mengumpulkan dalam{' '}
                    <span className="font-mono font-bold tabular-nums">
                      {formatSecondsToClock(minSubmitRemainingSeconds)}
                    </span>
                    .
                  </p>
                </div>
              </div>
            ) : (
              <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-400 text-indigo-600"
                />
                <span className="font-medium">
                  {examPackage.category === 'Latihan Mandiri'
                    ? 'Saya yakin telah memeriksa semua jawaban dan bersedia menyelesaikan latihan sekarang.'
                    : 'Saya yakin telah memeriksa semua jawaban dan bersedia mengumpulkan ujian sekarang.'}
                </span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Periksa Lagi
              </button>
              <button
                type="button"
                disabled={minSubmitRemainingSeconds > 0 || !confirmChecked}
                onClick={() => {
                  setShowSubmitModal(false);
                  submitStudentExam(attempt.id);
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {examPackage.category === 'Latihan Mandiri'
                  ? 'Selesaikan Latihan'
                  : 'Kumpulkan Ujian'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
